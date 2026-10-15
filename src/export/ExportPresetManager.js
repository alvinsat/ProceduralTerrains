import { UnityPreset } from './presets/UnityPreset.js';
import { UnrealPreset } from './presets/UnrealPreset.js';
import { GodotPreset } from './presets/GodotPreset.js';
import { BlenderPreset } from './presets/BlenderPreset.js';
import { ThreePreset } from './presets/ThreePreset.js';
import { CryEnginePreset } from './presets/CryEnginePreset.js';
import { createRuntimeTerrainDocumentFile } from './runtime/RuntimeTerrainDocument.js';

export const EXPORT_PRESETS = [UnityPreset, UnrealPreset, GodotPreset, BlenderPreset, ThreePreset, CryEnginePreset];
export const EXPORT_PRESET_OPTIONS = [{ value: 'custom', label: 'Custom export' }, ...EXPORT_PRESETS.map(({ id, label }) => ({ value: id, label }))];

export function getExportPreset(id) {
  return EXPORT_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function applyExportPreset(options, id) {
  const preset = getExportPreset(id);
  const reset = {
    ...options,
    heightRes: null,
    heightmapVertexGrid: false,
    runtimeDocumentPath: null,
  };
  if (!preset) return { ...reset, exportPresetId: 'custom', packageRoot: null, packagePaths: null, heightmapRawPath: null };
  return {
    ...reset, ...preset.defaults, exportPresetId: preset.id,
    packageRoot: preset.layout.root, packagePaths: preset.layout.paths,
    heightmapRawPath: preset.layout.heightmapRawPath ?? null,
    runtimeDocumentPath: preset.layout.runtimeDocumentPath ?? null,
  };
}

export function createProductionFiles(options, context) {
  const preset = getExportPreset(options.exportPresetId);
  if (!preset) return {};
  const root = preset.layout.root;
  const encode = (value) => new TextEncoder().encode(value);
  if (preset.layout.runtimeDocumentPath) {
    const runtime = createRuntimeTerrainDocumentFile(context, options);
    const readme = preset.id === 'unity'
      ? `${preset.label}\n\nExtract this Terrain folder inside a Unity project's Assets folder.\nThe Procedural Terrains Unity package imports project.ptrterrain automatically.\n`
      : `${preset.label}\n\nInstall the Procedural Terrains Blender extension, then choose File > Import > Procedural Terrains (.zip/.ptrterrain).\nThe extension validates project.ptrterrain and builds editable Blender meshes with baked materials.\n`;
    return {
      [preset.layout.runtimeDocumentPath]: runtime.bytes,
      [`${root}/README.txt`]: encode(readme),
    };
  }
  const terrainSize = Number(context.boardSize) || 0;
  if (preset.id === 'cryengine') {
    const resolution = Number(options.heightRes);
    const maxHeight = Number(options.cryEngineMaxHeight);
    const metadata = {
      app: 'Procedural Terrains',
      version: 1,
      preset: preset.id,
      generatedAt: new Date().toISOString(),
      engine: 'CRYENGINE 5.7 Sandbox',
      heightmap: {
        path: preset.layout.heightmapRawPath,
        width: resolution,
        height: resolution,
        encoding: 'unsigned 16-bit integer',
        byteOrder: 'little-endian',
        sampleLayout: 'vertex grid, including both terrain edges',
        heightScaleMeters: maxHeight,
        sourceHeightRangeMeters: Number(context.heightScale) || 0,
      },
      terrain: {
        worldSizeMeters: terrainSize,
        unitSizeMeters: terrainSize / resolution,
        coordinateSystem: 'CryEngine X/Y horizontal, Z up',
      },
    };
    const readme = [
      'CRYENGINE 5.7 Heightmap',
      '',
      'Extract this archive and import CryEngine/heightmap.raw using Sandbox > Terrain > Import Heightmap.',
      'The RAW file contains unsigned 16-bit little-endian samples and has no embedded dimensions or scale.',
      `Required heightmap dimensions: ${resolution} x ${resolution}.`,
      `Required terrain MaxHeight: ${maxHeight} m.`,
      `Terrain world size: ${terrainSize} m x ${terrainSize} m.`,
      `Terrain unit size: ${terrainSize / resolution} m per sample.`,
      '',
      'Before importing, make sure the target level heightmap Width/Height and MaxHeight match these settings.',
      'CryEngine rejects a RAW file whose byte length does not match the current heightmap dimensions.',
      'The Editor importer applies the level MaxHeight as the vertical scale; this archive does not change level settings.',
      'The row-orientation conversion is inferred from Editor source; verify it with an asymmetric test terrain before production use.',
      'You can use Sandbox > Terrain > Import Heightmap, or run manipulate.py in the Editor and select the extracted RAW file in the native file picker.',
      'The current Editor Python terrain API does not support supplying the RAW path directly or importing it headlessly.',
      '',
    ].join('\n');
    return {
      [`${preset.layout.root}/terrain.json`]: encode(JSON.stringify(metadata, null, 2)),
      [`${preset.layout.root}/README.txt`]: encode(readme),
    };
  }

  const metadata = {
    app: 'Procedural Terrains', version: 1, preset: preset.id,
    generatedAt: new Date().toISOString(), seed: context.seed,
    worldSizeMeters: terrainSize, heightRangeMeters: Number(context.heightScale) || 0,
    coordinateSystem: preset.id === 'unreal' ? 'Unreal centimeters (Z-up import)' : 'Y-up meters',
    files: preset.layout.paths,
  };
  const readme = `${preset.label}\n\nImport the files in this folder using your engine's terrain import workflow.\nWorld size: ${terrainSize} m. Height range: ${metadata.heightRangeMeters} m.\n`;
  return {
    [`${root}/terrain.json`]: encode(JSON.stringify(metadata, null, 2)),
    [`${root}/README.txt`]: encode(readme),
  };
}
