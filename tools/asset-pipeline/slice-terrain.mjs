// tools/asset-pipeline/slice-terrain.mjs
//
// FILE A (overworldtile1.png) -> the overworld terrain tileset.
//
// What the source actually is (measured, see docs/asset-pipeline.md):
//   1254x1254, RGB, NO alpha channel. Black separator lines are drawn between
//   cells and bleed 1-2px into the artwork. 14 usable columns of 82-83px plus
//   a cropped 60px column that is discarded. TEN rows of NON-UNIFORM height
//   (83, 82, 81, 82, 124, 167, 122, 177, 127, 182) because rows 4-9 hold
//   artwork drawn taller than its ground footprint.
//
// Consequences handled here:
//   - The grid is DETECTED, never assumed (lib/sheet-grid.mjs).
//   - Every cell is inset-cropped to remove separator bleed.
//   - Rows 0-3 are true ground tiles and are addressed by grid cell.
//   - Tall rows (water, cliffs) are addressed by explicit pixel rectangles,
//     because their cell height spans two visual sub-rows.
//   - Base materials are made seamless; every other grass-backed tile is
//     edge-conformed to the grass base so a field shows no grid banding.
//
// Objects (trees, rocks, fences...) are NOT taken from this sheet: File A draws
// them over opaque grass. File B supplies the same categories with real alpha.

import fs from 'node:fs';
import path from 'node:path';
import { readPng } from './lib/png.mjs';
import {
  crop, resample, makeSeamless, conformEdges, seamError, tintToward, mirror, inpaint, addGrain,
} from './lib/image.mjs';
import { detectSheetGrid } from './lib/sheet-grid.mjs';
import { writeTileset } from './lib/tileset.mjs';
import { SOURCES, OUT, TILE, CELL_INSET, SEAM_MARGIN } from './lib/config.mjs';

/**
 * Ground tiles addressed by detected grid cell `[col, row]`.
 * Only rows 0-3 appear here — they are the sheet's true ~82px tile rows.
 * `base: true` marks a plain-grass variant used as a field filler.
 */
const GRID_TILES = [
  // Column 0 of rows 0 and 1 are the ONLY plain grass cells in the sheet.
  // Columns 1-3 look like grass at a glance but each carries a shrub clump in
  // the middle; using them as field fill tiled a visible lattice of bushes
  // across every map, so they are decoration and are scattered sparsely.
  { name: 'grass',           cell: [0, 0], base: true },
  { name: 'grass_alt',       cell: [0, 1], base: true },
  { name: 'grass_shrub_a',   cell: [1, 0] },
  { name: 'grass_shrub_b',   cell: [2, 0] },
  { name: 'grass_shrub_c',   cell: [3, 0] },
  { name: 'grass_shrub_d',   cell: [1, 1] },
  { name: 'grass_shrub_e',   cell: [2, 1] },
  { name: 'grass_shrub_f',   cell: [3, 1] },

  // Tall grass / crop rows — the natural "encounters happen here" surface.
  { name: 'tallgrass',       cell: [4, 0], props: { encounterHint: true } },
  { name: 'tallgrass_b',     cell: [5, 0], props: { encounterHint: true } },
  { name: 'tallgrass_c',     cell: [6, 0], props: { encounterHint: true } },

  // Bare earth patches on grass — scuffed ground beside roads and buildings.
  { name: 'dirt_patch',      cell: [7, 0] },
  { name: 'dirt_patch_b',    cell: [4, 1] },
  { name: 'dirt_patch_c',    cell: [5, 1] },
  { name: 'dirt_patch_d',    cell: [6, 1] },
  { name: 'dirt_patch_e',    cell: [7, 1] },

  // Grass decoration. Centred motifs, so edge-conforming is lossless here.
  { name: 'grass_flower_pink',   cell: [8, 0] },
  { name: 'grass_flower_white',  cell: [9, 0] },
  { name: 'grass_tuft',          cell: [10, 0] },
  { name: 'grass_pebbles',       cell: [11, 0] },
  { name: 'grass_flower_pink_b', cell: [12, 0] },
  { name: 'grass_flower_mixed',  cell: [13, 0] },
  { name: 'grass_flower_white_b', cell: [8, 1] },
  { name: 'grass_bush',          cell: [9, 1] },
  { name: 'grass_bush_b',        cell: [10, 1] },
  { name: 'grass_pebbles_b',     cell: [11, 1] },
  { name: 'grass_flower_yellow', cell: [12, 1] },
  { name: 'grass_flower_white_c', cell: [13, 1] },
];

/**
 * Tiles addressed by explicit source rectangle, for the tall rows where one
 * grid cell spans two visual sub-rows. Coordinates are sheet pixels and were
 * read off the detected grid (cols start 9,93,177,... rows start ...,466,...,758).
 */
const RECT_TILES = [
  // Row 7 (y 758..934) is water. Its top ~110px is open sea; the bottom band
  // is the coastline. Sample the open sea only.
  { name: 'water',   rect: { x: 14, y: 764, w: 72, h: 72 }, material: true, solid: true },
  { name: 'water_b', rect: { x: 98, y: 764, w: 72, h: 72 }, material: true, solid: true },

  // Row 5 (y 466..632) bottom sub-row holds the cliff / rock wall face.
  // Sampled below y=566: above that the cell still shows the grassy cliff top.
  { name: 'cliff',   rect: { x: 772, y: 566, w: 70, h: 64 }, material: true, solid: true },
  { name: 'cliff_b', rect: { x: 856, y: 566, w: 70, h: 64 }, material: true, solid: true },

];

/**
 * Region searched for a clean road-surface sample: the grass, bare-earth and
 * road rows (0-3), minus the separator margins.
 *
 * The window is deliberately small. The sheet never draws a large unbroken area
 * of road surface — roads are narrow bands with grass on both sides — so the
 * bigger the window, the more foliage it is forced to include. Measured on the
 * supplied sheet: 56px window = 19.8% foliage, 48px = 11.3%, 40px = 2.8%.
 * 40px upscales to the 64px tile, which a fine-grained dirt texture tolerates.
 */
const DIRT_SEARCH = { x: 10, y: 7, w: 1170, h: 331, size: 40 };

/**
 * Dirt in this artwork runs red > green > blue. Anything where green catches up
 * to red is foliage or the grass-blended fringe, not road surface. An earlier
 * stricter test (`g > r + 8`) passed olive fringe pixels through, leaving the
 * sample 51% olive and putting a green smudge in every road tile.
 */
function isNotDirt(r, g, b) {
  return g >= r - 4 || (r < 70 && g < 70 && b < 70);
}

/**
 * Finds the cleanest square of bare road surface in the sheet's road rows.
 *
 * The road cells are illustrated road *segments* — a band of dirt with grass on
 * either side — so a hand-picked rectangle very easily includes grass. A fixed
 * rect used here originally came out 23% green, and because every generated
 * road tile is composited from this one sample, that grass repeated as a green
 * blob in the middle of every road tile across every map. Searching for the
 * least-green window removes the guesswork and survives a change of sheet.
 */
function findDirtPatch(sheet) {
  const { x: sx, y: sy, w, h, size } = DIRT_SEARCH;
  const impure = (x, y) => {
    const i = (y * sheet.width + x) * 4;
    return isNotDirt(sheet.data[i], sheet.data[i + 1], sheet.data[i + 2]);
  };

  let best = null;
  for (let y = sy; y <= sy + h - size; y += 2) {
    for (let x = sx; x <= sx + w - size; x += 2) {
      let n = 0;
      for (let dy = 0; dy < size; dy += 2) {
        for (let dx = 0; dx < size; dx += 2) if (impure(x + dx, y + dy)) n++;
      }
      if (!best || n < best.n) best = { x, y, n };
    }
  }
  const samples = (size / 2) ** 2;
  return { rect: { x: best.x, y: best.y, w: size, h: size }, impurity: best.n / samples };
}

/**
 * Finds the sheet's beach/shore colour by averaging tan pixels inside the water
 * row. Colour-signature detection rather than a fixed rectangle, because the
 * shore band is a thin irregular ring around the island cells.
 */
function sampleShoreColor(sheet, rows) {
  const waterRow = rows[7];
  let r = 0, g = 0, b = 0, n = 0;
  const yEnd = waterRow.start + waterRow.size;
  for (let y = waterRow.start; y < yEnd; y++) {
    for (let x = 0; x < sheet.width; x++) {
      const i = (y * sheet.width + x) * 4;
      const R = sheet.data[i], G = sheet.data[i + 1], B = sheet.data[i + 2];
      if (R > 150 && G > 120 && B < R - 40 && B < 150) { r += R; g += G; b += B; n++; }
    }
  }
  if (!n) return [175, 160, 82]; // measured fallback for the supplied sheet
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

export function sliceTerrain({ log = console.log } = {}) {
  const sheet = readPng(SOURCES.terrainSheet);
  const { cols, rows } = detectSheetGrid(sheet);

  if (cols.length < 14 || rows.length < 8) {
    throw new Error(
      `terrain sheet grid detection failed: got ${cols.length} cols / ${rows.length} rows`,
    );
  }

  /** Crops a detected grid cell with separator inset applied. */
  function cropCell(colIndex, rowIndex) {
    const col = cols[colIndex];
    const row = rows[rowIndex];
    if (!col || !row) throw new Error(`terrain cell [${colIndex},${rowIndex}] out of range`);
    return crop(
      sheet,
      col.start + CELL_INSET,
      row.start + CELL_INSET,
      col.size - CELL_INSET * 2,
      row.size - CELL_INSET * 2,
    );
  }

  // ── Base grass: resample, then make genuinely tileable ────────────────────
  // Raw cells measure a ~22-unit per-channel vertical edge mismatch, which
  // reads as grid banding across a field. makeSeamless removes it.
  const rawGrass = resample(cropCell(0, 0), TILE, TILE);
  const grassBase = makeSeamless(rawGrass, SEAM_MARGIN);
  log(`  grass seam: ${JSON.stringify(seamError(rawGrass))} -> ${JSON.stringify(seamError(grassBase))}`);

  const tiles = [];

  for (const def of GRID_TILES) {
    const [colIndex, rowIndex] = def.cell;
    const resampled = resample(cropCell(colIndex, rowIndex), TILE, TILE);
    // Plain-grass variants must tile against themselves as well as against
    // the base; decorated tiles only need to match the base border ring.
    const seamless = def.base ? makeSeamless(resampled, SEAM_MARGIN) : resampled;
    const image = def.name === 'grass' ? grassBase : conformEdges(seamless, grassBase, 10);
    tiles.push({ name: def.name, image, solid: false, props: def.props });
  }

  const materials = {};
  for (const def of RECT_TILES) {
    const { x, y, w, h } = def.rect;
    const image = makeSeamless(resample(crop(sheet, x, y, w, h), TILE, TILE), SEAM_MARGIN);
    tiles.push({ name: def.name, image, solid: !!def.solid });
    if (def.material) materials[def.name] = image;
  }

  // Road surface: located by search, then inpainted to remove the foliage that
  // survives even in the cleanest available window.
  const dirtPatch = findDirtPatch(sheet);
  const dirtRaw = crop(sheet, dirtPatch.rect.x, dirtPatch.rect.y, dirtPatch.rect.w, dirtPatch.rect.h);
  const dirtClean = inpaint(dirtRaw, isNotDirt);
  // A little grain restores the bite lost upscaling a 40px sample to 64px.
  const dirt = addGrain(makeSeamless(resample(dirtClean, TILE, TILE), SEAM_MARGIN), 6, 2, 53);
  tiles.push({ name: 'dirt', image: dirt, solid: false });
  materials.dirt = dirt;
  log(`  dirt sample: ${dirtPatch.rect.x},${dirtPatch.rect.y} ` +
      `(${(dirtPatch.impurity * 100).toFixed(1)}% foliage before inpainting)`);

  materials.grass = grassBase;

  // Mirrored copies of the base grass. Mirroring a seamless tile preserves its
  // edges, so these butt against each other and against the original with no
  // seam, while breaking up the repetition a single fill tile would show.
  const grassVariantNames = ['grass'];
  const mirrors = [
    ['grass_v1', { horizontal: true }],
    ['grass_v2', { vertical: true }],
    ['grass_v3', { horizontal: true, vertical: true }],
  ];
  for (const [name, flips] of mirrors) {
    tiles.push({ name, image: mirror(grassBase, flips), solid: false });
    grassVariantNames.push(name);
  }
  grassVariantNames.push('grass_alt');

  // Beach colour, found by scanning the water row for tan pixels rather than
  // guessing a rectangle: the shore band is only ~20px tall and a fixed rect
  // lands in open sea. Measured rgb(175,160,82) on the supplied sheet.
  const shoreColor = sampleShoreColor(sheet, rows);

  // Sand is derived from the road dirt rather than synthesised, because in this
  // artwork the two are nearly the same material (dirt rgb(166,153,59) vs shore
  // rgb(175,160,82)). Shifting real texture keeps the brush detail that a
  // procedural noise fill would lose.
  const sand = tintToward(materials.dirt, shoreColor);
  tiles.push({ name: 'sand', image: sand, solid: false });
  materials.sand = sand;

  log(`  terrain base tiles: ${tiles.length}`);
  log(`  shore colour sampled from sheet: rgb(${shoreColor.join(',')})`);

  return {
    tiles,
    materials,
    shoreColor,
    groups: {
      grassVariants: grassVariantNames,
      decorVariants: GRID_TILES
        .filter(t => !t.base && !t.props?.encounterHint && !t.name.startsWith('dirt_patch'))
        .map(t => t.name),
      dirtPatches: GRID_TILES.filter(t => t.name.startsWith('dirt_patch')).map(t => t.name),
      tallGrass: GRID_TILES.filter(t => t.props?.encounterHint).map(t => t.name),
    },
  };
}

/** Writes the terrain tileset and its runtime manifest. */
export function writeTerrainTileset({ tiles, groups, shoreColor }) {
  const result = writeTileset({ name: 'overworld-terrain', outDir: OUT.tilesets, tiles });
  const manifest = {
    generatedFrom: path.basename(SOURCES.terrainSheet),
    tileSize: TILE,
    tileCount: result.tileCount,
    columns: result.columns,
    indexByName: result.indexByName,
    shoreColor,
    ...groups,
  };
  fs.writeFileSync(
    path.join(OUT.tilesets, 'overworld-terrain.manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return { result, manifest };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.mkdirSync(OUT.tilesets, { recursive: true });
  const terrain = sliceTerrain();
  const { result } = writeTerrainTileset(terrain);
  console.log(`  overworld-terrain: ${result.tileCount} tiles, ${result.width}x${result.height}px`);
}
