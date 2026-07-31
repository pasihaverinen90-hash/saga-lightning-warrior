// tools/asset-pipeline/lib/config.mjs
// Shared constants and paths for every pipeline stage.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repository root, derived from this file's location. */
export const ROOT = path.resolve(here, '..', '..', '..');

/**
 * Source art. These files are READ ONLY — the pipeline never writes to them.
 * To relocate the originals (e.g. into an `art-src/` folder) change only these
 * two paths; nothing else in the pipeline references them.
 */
export const SOURCES = {
  terrainSheet: path.join(ROOT, 'overworldtile1.png'),
  objectSheet:  path.join(ROOT, 'overworldtile2.png'),
};

export const OUT = {
  root:     path.join(ROOT, 'public', 'assets'),
  tilesets: path.join(ROOT, 'public', 'assets', 'tilesets'),
  atlases:  path.join(ROOT, 'public', 'assets', 'atlases'),
  sprites:  path.join(ROOT, 'public', 'assets', 'sprites'),
  maps:     path.join(ROOT, 'public', 'assets', 'maps'),
  debug:    path.join(ROOT, 'tools', 'asset-pipeline', 'debug'),
};

/**
 * Logical tile size for every map in the game.
 *
 * 64px chosen because:
 *   - File A cells measure 82-83px, so 83→64 is a mild 0.77 downscale that
 *     keeps the painted detail rather than mushing it.
 *   - File B objects are used at native size; a tree there is ~50x95px, which
 *     lands at ~0.8 x 1.5 tiles — correct top-down JRPG proportion with no
 *     rescaling and therefore no resampling softness on the objects.
 *   - At 1280x720 the camera shows 20 x 11.25 tiles at zoom 1.0, close to
 *     classic SNES-era JRPG framing.
 */
export const TILE = 64;

/** Tiles per row in generated tileset images. */
export const TILESET_COLUMNS = 16;

/**
 * Inset applied to every File A cell before resampling.
 *
 * The sheet has black separator lines baked between cells which bleed 1-2px
 * into the artwork. Cropping 3px off each side removes the dark fringe at the
 * cost of ~7% of the cell — invisible for terrain, and far preferable to a
 * dark rim appearing on every tile edge.
 */
export const CELL_INSET = 3;

/** Edge band width used by makeSeamless() on tiling base materials. */
export const SEAM_MARGIN = 12;

export function ensureDirs(fs) {
  for (const dir of Object.values(OUT)) fs.mkdirSync(dir, { recursive: true });
}
