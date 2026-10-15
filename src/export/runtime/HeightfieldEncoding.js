export function vertexGridUv(index, resolution) {
  if (!Number.isInteger(resolution) || resolution < 2) throw new Error('Vertex-grid resolution must be at least 2.');
  if (!Number.isInteger(index) || index < 0 || index >= resolution) throw new Error('Vertex-grid index is out of range.');
  return index / (resolution - 1);
}

export function vertexGridWorldCoordinate(center, size, index, resolution) {
  return center + (vertexGridUv(index, resolution) - 0.5) * size;
}

export function decodePackedHeight01(pixels, pixelIndex) {
  const offset = pixelIndex * 4;
  return (pixels[offset] * 65536 + pixels[offset + 1] * 256 + pixels[offset + 2]) / 16777215;
}

// WebGL readRenderTargetPixels returns row zero from the render target's
// bottom edge. That is exactly the runtime contract's -Z to +Z row order, so
// Unity RAW data is packed without a vertical flip.
export function encodeUnityRaw16FromPackedPixels(pixels, width, height) {
  if (!(pixels instanceof Uint8Array) || pixels.length !== width * height * 4) {
    throw new Error('Packed height pixels must be an RGBA Uint8Array matching the supplied dimensions.');
  }
  const raw = new Uint8Array(width * height * 2);
  const view = new DataView(raw.buffer);
  for (let index = 0; index < width * height; index++) {
    const value = Math.round(decodePackedHeight01(pixels, index) * 65535);
    view.setUint16(index * 2, value, true);
  }
  return raw;
}

export function encodeCryEngineRaw16FromPackedPixels(
  pixels, width, height, sourceHeightScale, cryEngineMaxHeight,
) {
  if (!(pixels instanceof Uint8Array) || pixels.length !== width * height * 4) {
    throw new Error('Packed height pixels must be an RGBA Uint8Array matching the supplied dimensions.');
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width !== height || width < 2) {
    throw new Error('CryEngine RAW heightmaps must be square grids with at least 2 samples per side.');
  }
  if (!Number.isFinite(sourceHeightScale) || sourceHeightScale <= 0
      || !Number.isFinite(cryEngineMaxHeight) || cryEngineMaxHeight <= 0) {
    throw new Error('Source and CryEngine height scales must be finite positive numbers.');
  }

  const raw = new Uint8Array(width * height * 2);
  const view = new DataView(raw.buffer);

  // CryEngine's Editor RAW loader applies RotateOrt(3); its saved RAW path
  // applies RotateOrt(1). Together with the Editor heightmap's swapped X/Y
  // world mapping, the equivalent conversion from the app's X/Z grid is a
  // row reversal.
  for (let y = 0; y < height; y++) {
    const sourceRow = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const pixelIndex = sourceRow * width + x;
      const heightMeters = decodePackedHeight01(pixels, pixelIndex) * sourceHeightScale;
      const normalized = Math.max(0, Math.min(1, heightMeters / cryEngineMaxHeight));
      view.setUint16((y * width + x) * 2, Math.round(normalized * 65535), true);
    }
  }
  return raw;
}
