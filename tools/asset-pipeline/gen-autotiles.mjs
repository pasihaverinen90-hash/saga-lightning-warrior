// tools/asset-pipeline/gen-autotiles.mjs
//
// Generates 16-variant autotile sets by compositing one material over another
// through a procedurally-built coverage mask.
//
// Why generated rather than traced from File A: the sheet's road, river and
// coast cells are illustrated *scenes* rather than connectable tiles. Measured
// edge-continuity between horizontally adjacent cells ranges 15..88 per channel,
// so laying them side by side does not produce a continuous road. Building the
// 16 neighbour cases from the sheet's own grass / dirt / water / sand materials
// guarantees every junction lines up, and makes a new surface (stone street,
// snow path, cave floor) one line of config rather than new artwork.
//
// Bitmask convention, shared with src/game/maps/systems/autotile.ts:
//   bit 0 (1) = north neighbour is the same material
//   bit 1 (2) = east
//   bit 2 (4) = south
//   bit 3 (8) = west
// so index 0 is an isolated patch and index 15 is fully surrounded.

import { createImage, blitMasked, fractalNoise, clamp255 } from './lib/image.mjs';
import { TILE } from './lib/config.mjs';

export const NORTH = 1;
export const EAST = 2;
export const SOUTH = 4;
export const WEST = 8;

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Coverage field: the material fills the tile but pulls back from every side
 * that is NOT the same material.
 *
 * A single field function covers roads, trails, rivers and seas alike; only the
 * inset differs. An earlier version used a second "arms reaching out from a
 * central blob" style for roads, which was wrong in two ways that only showed
 * up once maps were rendered: a fully-surrounded tile came out as a cross with
 * grass corners rather than solid road, so a three-tile-wide road rendered as a
 * string of beads; and stacked rows only touched via their narrow arms. Insets
 * from open sides produce a solid surface with a soft verge, which is what a
 * road actually looks like from above.
 *
 * Note this is 4-bit cardinal autotiling, so DIAGONAL runs staircase and read
 * as broken. Author routes as axis-aligned segments with right-angle turns —
 * which is also how classic top-down JRPG roads are drawn.
 */
function areaField(x, y, bits, { inset }) {
  let field = TILE; // fully covered until an open side pulls it back
  if (!(bits & NORTH)) field = Math.min(field, y - inset);
  if (!(bits & SOUTH)) field = Math.min(field, TILE - 1 - y - inset);
  if (!(bits & WEST)) field = Math.min(field, x - inset);
  if (!(bits & EAST)) field = Math.min(field, TILE - 1 - x - inset);
  return field;
}

/**
 * Builds one 16-tile set.
 *
 * @param {object} options
 * @param {object} options.base     Terrain the material sits on (e.g. grass).
 * @param {object} options.overlay  Material being drawn (e.g. dirt, water).
 * @param {string} options.name     Tile name prefix; tiles are `${name}_00..15`.
 * @param {number} options.inset    How far the material pulls back from an open
 *                                  side, in pixels. Small = wide surface.
 * @param {number[]} [options.fringeColor]  Optional shoreline/verge colour.
 * @returns {Array<{name: string, image: object, solid?: boolean, props?: object}>}
 */
export const AUTOTILE_VARIANTS = 3;

export function makeAutotileSet({
  base,
  overlay,
  name,
  inset = 9,
  noiseAmp = 4.5,
  noiseCell = 11,
  edgeSoftness = 1.4,
  fringeColor = null,
  fringeWidth = 2.6,
  solid = false,
  seed = 1,
}) {
  const tiles = [];

  for (let bits = 0; bits < 16; bits++) {
    // Several edge treatments per neighbour-mask. With a single variant, every
    // tile along a straight road shares identical edge noise and the run reads
    // as one scalloped shape stamped over and over — clearly visible once a
    // whole map was rendered. The map builder picks between these by position.
    for (let variant = 0; variant < AUTOTILE_VARIANTS; variant++) {
      const mask = new Float32Array(TILE * TILE);
      const fringe = new Float32Array(TILE * TILE);
      const noiseSeed = seed + bits * 31 + variant * 977;

      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          const wobble = (fractalNoise(x, y, noiseCell, noiseSeed) - 0.5) * 2 * noiseAmp;
          const value = areaField(x, y, bits, { inset }) + wobble;
          const i = y * TILE + x;
          mask[i] = smoothstep(-edgeSoftness, edgeSoftness, value);
          if (fringeColor) {
            // Band hugging the coverage boundary from the inside.
            fringe[i] = Math.max(0, 1 - Math.abs(value) / fringeWidth) * (value > -fringeWidth ? 1 : 0);
          }
        }
      }

      const image = blitMasked(base, overlay, mask);

      if (fringeColor) {
        for (let i = 0; i < TILE * TILE; i++) {
          const f = fringe[i] * 0.85;
          if (f <= 0.01) continue;
          for (let c = 0; c < 3; c++) {
            image.data[i * 4 + c] = clamp255(
              image.data[i * 4 + c] * (1 - f) + fringeColor[c] * f,
            );
          }
        }
      }

      tiles.push({
        name: `${name}_${String(bits).padStart(2, '0')}_${variant}`,
        image,
        // EVERY variant of a solid material blocks, including the shoreline
        // ones. Marking only the fully-surrounded variant solid left any river
        // or stream under three tiles wide completely walkable, because no cell
        // in it ever has all four neighbours. The land tile beside a shoreline
        // is still fully walkable, so the coast does not feel thickened.
        solid: solid === true,
        props: { autotile: name, bits },
      });
    }
  }

  return tiles;
}

/**
 * The autotile sets the game ships with, built from materials extracted by
 * slice-terrain.mjs. Adding a surface here is the supported way to introduce a
 * new walkable material without new artwork.
 */
export function buildAutotileSets(materials, shoreColor, { log = console.log } = {}) {
  const sets = [];

  // Main road — a small inset keeps the surface wide, with just enough verge
  // for the grass edge to read.
  sets.push(...makeAutotileSet({
    name: 'road',
    base: materials.grass,
    overlay: materials.dirt,
    inset: 5,
    noiseAmp: 4,
    seed: 3,
  }));

  // Narrow side trail — the "shortcut through the woods" surface. Same tiles,
  // much bigger inset, so a single painted cell becomes a ~30px track.
  sets.push(...makeAutotileSet({
    name: 'path',
    base: materials.grass,
    overlay: materials.dirt,
    inset: 17,
    noiseAmp: 5,
    seed: 5,
  }));

  // Water: sea and rivers, with a sand shoreline sampled from the source sheet.
  sets.push(...makeAutotileSet({
    name: 'water',
    base: materials.grass,
    overlay: materials.water,
    inset: 8,
    noiseAmp: 5,
    fringeColor: shoreColor,
    fringeWidth: 3.2,
    solid: true,
    seed: 7,
  }));

  // Beach / dry riverbed, for softening where water meets open ground.
  sets.push(...makeAutotileSet({
    name: 'sand',
    base: materials.grass,
    overlay: materials.sand,
    inset: 7,
    noiseAmp: 5.5,
    seed: 11,
  }));

  log(`  autotiles: ${sets.length} tiles — 4 sets (road, path, water, sand) ` +
      `x 16 masks x ${AUTOTILE_VARIANTS} variants`);
  return sets;
}
