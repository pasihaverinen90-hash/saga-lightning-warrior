// tools/asset-pipeline/gen-structures.mjs
//
// Generates the artwork the supplied sheets do not contain: town buildings,
// interior floors and walls, and interior furniture.
//
// Files A and B are nature-only — grass, roads, water, trees, rocks, cliffs,
// fences. There is no house, no roof, no floorboard and no table anywhere in
// either sheet, so a town or an inn cannot be built from them. Rather than
// leave those maps as coloured rectangles, this stage draws a modular set
// procedurally in a palette SAMPLED FROM the two sheets, so the generated
// pieces sit next to the painted terrain without clashing.
//
// Everything here is deliberately simple and readable. It is meant to be
// replaced by real artwork later: swap the PNGs and keep the tile/frame names
// and no map data has to change.

import fs from 'node:fs';
import path from 'node:path';
import { readPng, writePng } from './lib/png.mjs';
import {
  createImage, blit, fillRect, strokeRect, addGrain, shade, mixColor,
  fractalNoise, hash2, clamp255, setPixel, makeSeamless,
} from './lib/image.mjs';
import { writeTileset } from './lib/tileset.mjs';
import { SOURCES, OUT, TILE } from './lib/config.mjs';

/**
 * Palette sampled from the source sheets so generated structures share the
 * artwork's colour temperature. Wood comes from the fence rails in File B,
 * stone from its boulders, and the warm accents from File A's road dirt.
 */
function samplePalette() {
  const objects = readPng(SOURCES.objectSheet);
  const terrain = readPng(SOURCES.terrainSheet);

  const meanOf = (img, x0, y0, w, h, predicate) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const i = (y * img.width + x) * 4;
        if (img.data[i + 3] < 200) continue;
        const px = [img.data[i], img.data[i + 1], img.data[i + 2]];
        if (predicate && !predicate(px)) continue;
        r += px[0]; g += px[1]; b += px[2]; n++;
      }
    }
    return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : null;
  };

  // Fence band in File B — warm weathered timber.
  const wood = meanOf(objects, 0, 760, 1024, 60, ([r, g, b]) => r > b + 25 && r > 90)
    ?? [138, 110, 72];
  // Boulder band in File B — cool grey stone.
  const stone = meanOf(objects, 520, 400, 500, 120, ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b) < 34 && r > 110)
    ?? [166, 166, 158];
  // Road dirt in File A — the warm mid-tone everything else is keyed against.
  const dirt = meanOf(terrain, 610, 268, 58, 58) ?? [166, 153, 59];

  // The fences this samples from are weathered and mossy, so the raw sample
  // comes out olive. Pulling it toward a warm brown keeps the tie to the source
  // palette while giving timber and floorboards the colour they should read as.
  const timber = mixColor(wood, [126, 88, 52], 0.55);

  return {
    wood: timber,
    woodDark: shade(timber, 0.66),
    woodLight: shade(timber, 1.22),
    stone,
    stoneDark: shade(stone, 0.7),
    stoneLight: shade(stone, 1.14),
    dirt,
    plaster: [232, 216, 186],
    plasterShade: [198, 180, 150],
    roof: [162, 74, 60],
    roofDark: [118, 50, 42],
    roofLight: [196, 104, 86],
    thatch: [186, 152, 84],
    thatchDark: [138, 108, 56],
    glass: [128, 172, 196],
    glassDark: [78, 112, 140],
    doorWood: [104, 70, 44],
    doorDark: [72, 46, 28],
    fabricRed: [150, 58, 58],
    fabricRedDark: [104, 38, 40],
    ember: [232, 150, 62],
  };
}

// ─── Building sprites ─────────────────────────────────────────────────────────

/** Overlapping roof tile courses, drawn from the eaves upward. */
function drawRoof(img, x, y, w, h, pal, style) {
  const isThatch = style === 'thatch';
  const base = isThatch ? pal.thatch : pal.roof;
  const dark = isThatch ? pal.thatchDark : pal.roofDark;
  const light = isThatch ? shade(pal.thatch, 1.15) : pal.roofLight;

  const courseH = isThatch ? 7 : 9;
  for (let cy = y + h - courseH; cy >= y; cy -= courseH) {
    // Higher courses read slightly lighter, giving the roof a soft gradient.
    const t = (cy - y) / Math.max(1, h);
    const rowColor = mixColor(light, base, t);
    fillRect(img, x, cy, w, courseH, rowColor);
    fillRect(img, x, cy + courseH - 2, w, 2, dark);
    if (!isThatch) {
      // Vertical joints, offset every other course.
      const offset = ((cy - y) / courseH) % 2 === 0 ? 0 : 10;
      for (let jx = x + offset; jx < x + w; jx += 20) {
        fillRect(img, jx, cy, 1, courseH - 2, shade(rowColor, 0.82));
      }
    }
  }
  // Ridge cap and eave shadow.
  fillRect(img, x, y, w, 4, dark);
  fillRect(img, x, y + h - 2, w, 2, shade(dark, 0.8));
}

function drawWindow(img, x, y, w, h, pal) {
  fillRect(img, x, y, w, h, pal.glassDark);
  fillRect(img, x + 2, y + 2, w - 4, h - 4, pal.glass);
  // Diagonal glint.
  for (let i = 0; i < Math.min(w, h) - 4; i++) {
    setPixel(img, x + 3 + i, y + h - 4 - i, 226, 240, 248, 190);
  }
  strokeRect(img, x, y, w, h, pal.woodDark, 2);
  fillRect(img, x, y + Math.floor(h / 2) - 1, w, 2, pal.woodDark);
  fillRect(img, x + Math.floor(w / 2) - 1, y, 2, h, pal.woodDark);
}

function drawDoor(img, x, y, w, h, pal) {
  fillRect(img, x, y, w, h, pal.doorDark);
  fillRect(img, x + 2, y, w - 4, h - 2, pal.doorWood);
  for (let px = x + 4; px < x + w - 4; px += 7) {
    fillRect(img, px, y + 3, 1, h - 6, shade(pal.doorWood, 0.8));
  }
  // Lintel and handle.
  fillRect(img, x - 2, y - 4, w + 4, 5, pal.woodDark);
  fillRect(img, x + w - 9, y + Math.floor(h / 2), 3, 3, [214, 190, 110]);
}

/**
 * Draws one building as a standalone sprite.
 *
 * Sprites rather than modular tiles: a house is placed as a single object with
 * a bottom-centre origin, which keeps town maps small and makes depth sorting
 * against the player trivial. Modular wall tiles would be needed only for
 * buildings the player can walk inside, and those are separate interior maps.
 */
function drawBuilding(pal, { tilesW, tilesH, roofStyle = 'tile', wall = 'plaster', doorTile = null, windows = 2 }) {
  const w = tilesW * TILE;
  const h = tilesH * TILE;
  const img = createImage(w, h);

  const roofH = Math.round(h * 0.42);
  const bodyY = roofH;
  const bodyH = h - roofH;
  const overhang = 6;

  // Ground shadow so the building sits on the map rather than floating.
  for (let y = h - 10; y < h; y++) {
    const t = (y - (h - 10)) / 10;
    for (let x = 6; x < w - 6; x++) setPixel(img, x, y, 26, 30, 22, Math.round(70 * (1 - t)));
  }

  // Body
  const wallColor = wall === 'stone' ? pal.stone : pal.plaster;
  const wallShade = wall === 'stone' ? pal.stoneDark : pal.plasterShade;
  fillRect(img, 4, bodyY, w - 8, bodyH - 6, wallColor);
  // Vertical shading toward the base.
  for (let y = bodyY; y < bodyY + bodyH - 6; y++) {
    const t = (y - bodyY) / Math.max(1, bodyH);
    for (let x = 4; x < w - 4; x++) {
      const i = (y * w + x) * 4;
      if (img.data[i + 3] === 0) continue;
      const f = 1 - t * 0.22;
      img.data[i] = clamp255(img.data[i] * f);
      img.data[i + 1] = clamp255(img.data[i + 1] * f);
      img.data[i + 2] = clamp255(img.data[i + 2] * f);
    }
  }

  if (wall === 'stone') {
    // Coursed stone blocks.
    for (let y = bodyY + 6; y < bodyY + bodyH - 8; y += 12) {
      fillRect(img, 6, y, w - 12, 1, wallShade);
      const offset = ((y - bodyY) / 12) % 2 === 0 ? 0 : 14;
      for (let x = 6 + offset; x < w - 8; x += 28) fillRect(img, x, y, 1, 12, wallShade);
    }
  } else {
    // Half-timbered framing.
    fillRect(img, 4, bodyY, w - 8, 4, pal.woodDark);
    fillRect(img, 4, bodyY + bodyH - 10, w - 8, 4, pal.woodDark);
    fillRect(img, 4, bodyY, 5, bodyH - 6, pal.woodDark);
    fillRect(img, w - 9, bodyY, 5, bodyH - 6, pal.woodDark);
    // Intermediate beams, but never through the doorway: the door is centred
    // by default, so a centre beam would run straight down it.
    if (tilesW >= 4) {
      for (const frac of [0.28, 0.72]) {
        fillRect(img, Math.round(w * frac) - 2, bodyY, 4, bodyH - 6, pal.woodDark);
      }
    }
  }

  strokeRect(img, 4, bodyY, w - 8, bodyH - 6, shade(wallShade, 0.75), 1);

  // Door, centred by default or on a nominated tile column.
  const doorW = Math.round(TILE * 0.62);
  const doorH = Math.round(bodyH * 0.56);
  const doorX = doorTile === null
    ? Math.round((w - doorW) / 2)
    : Math.round(doorTile * TILE + (TILE - doorW) / 2);
  const doorY = h - 6 - doorH;
  drawDoor(img, doorX, doorY, doorW, doorH, pal);

  // Windows, spread along the upper body and never overlapping the door.
  const winW = Math.round(TILE * 0.42);
  const winH = Math.round(TILE * 0.38);
  const winY = bodyY + Math.round(bodyH * 0.16);
  for (let i = 0; i < windows; i++) {
    const slot = (i + 1) / (windows + 1);
    const wx = Math.round(slot * w - winW / 2);
    if (wx + winW > doorX - 6 && wx < doorX + doorW + 6 && winY + winH > doorY) continue;
    drawWindow(img, wx, winY, winW, winH, pal);
  }

  // Roof last so its overhang sits above the walls.
  drawRoof(img, -overhang + 4, 0, w + overhang * 2 - 8, roofH + 6, pal, roofStyle);

  addGrain(img, wall === 'stone' ? 7 : 5, 3, 21 + tilesW);
  return img;
}

/** A hanging trade sign, placed beside shop and inn doors. */
function drawSign(pal, glyph) {
  const img = createImage(TILE, Math.round(TILE * 0.9));
  fillRect(img, 4, 2, TILE - 8, 30, pal.wood);
  strokeRect(img, 4, 2, TILE - 8, 30, pal.woodDark, 2);
  fillRect(img, Math.round(TILE / 2) - 2, 32, 4, 22, pal.woodDark);
  const ink = [58, 40, 24];
  if (glyph === 'bed') {
    fillRect(img, 12, 18, TILE - 24, 6, ink);
    fillRect(img, 12, 10, 10, 10, ink);
  } else if (glyph === 'coin') {
    for (let y = -7; y <= 7; y++) {
      for (let x = -7; x <= 7; x++) {
        if (x * x + y * y <= 49) setPixel(img, TILE / 2 + x, 17 + y, ink[0], ink[1], ink[2], 255);
      }
    }
  }
  addGrain(img, 5, 3, 44);
  return img;
}

// ─── Interior tiles ───────────────────────────────────────────────────────────

function floorBoards(pal, tint) {
  const img = createImage(TILE, TILE);
  const base = mixColor(pal.wood, tint, 0.35);
  fillRect(img, 0, 0, TILE, TILE, base);
  for (let y = 0; y < TILE; y += 16) {
    fillRect(img, 0, y, TILE, 1, shade(base, 0.72));
    // Staggered plank ends.
    const jointX = (y / 16) % 2 === 0 ? 20 : 44;
    fillRect(img, jointX, y, 1, 16, shade(base, 0.8));
  }
  addGrain(img, 8, 2, 61);
  return makeSeamless(img, 4);
}

function stoneFloor(pal) {
  const img = createImage(TILE, TILE);
  fillRect(img, 0, 0, TILE, TILE, pal.stone);
  for (let y = 0; y < TILE; y += 21) {
    for (let x = 0; x < TILE; x += 21) {
      const jitter = hash2(x, y, 5) * 12 - 6;
      fillRect(img, x + 1, y + 1, 19, 19, shade(pal.stone, 1 + jitter / 100));
    }
  }
  addGrain(img, 9, 2, 73);
  return makeSeamless(img, 4);
}

function plasterWall(pal, withSkirting) {
  const img = createImage(TILE, TILE);
  fillRect(img, 0, 0, TILE, TILE, pal.plaster);
  for (let y = 0; y < TILE; y++) {
    const t = y / TILE;
    for (let x = 0; x < TILE; x++) {
      const i = (y * TILE + x) * 4;
      const f = 0.88 + 0.12 * (1 - t);
      img.data[i] = clamp255(img.data[i] * f);
      img.data[i + 1] = clamp255(img.data[i + 1] * f);
      img.data[i + 2] = clamp255(img.data[i + 2] * f);
    }
  }
  if (withSkirting) fillRect(img, 0, TILE - 10, TILE, 10, pal.woodDark);
  addGrain(img, 5, 3, 87);
  return img;
}

/** Wall cap: the lit top edge of a wall run, seen from above. */
function wallTop(pal) {
  const img = createImage(TILE, TILE);
  fillRect(img, 0, 0, TILE, TILE, pal.stone);
  fillRect(img, 0, 0, TILE, 6, pal.stoneLight);
  fillRect(img, 0, TILE - 8, TILE, 8, pal.stoneDark);
  for (let x = 0; x < TILE; x += 16) fillRect(img, x, 6, 1, TILE - 14, pal.stoneDark);
  addGrain(img, 7, 2, 95);
  return img;
}

function carpet(pal) {
  const img = createImage(TILE, TILE);
  fillRect(img, 0, 0, TILE, TILE, pal.fabricRed);
  for (let y = 0; y < TILE; y += 6) fillRect(img, 0, y, TILE, 1, pal.fabricRedDark);
  addGrain(img, 6, 3, 101);
  return makeSeamless(img, 5);
}

// ─── Interior furniture sprites ───────────────────────────────────────────────

function furniture(pal, kind) {
  const specs = {
    table:     [TILE * 2, TILE],
    chair:     [TILE, TILE],
    bed:       [TILE, TILE * 2],
    counter:   [TILE * 3, TILE],
    shelf:     [TILE * 2, TILE],
    barrel:    [TILE, TILE],
    fireplace: [TILE * 2, TILE + 20],
    pot:       [TILE, TILE],
    stairs:    [TILE * 2, TILE],
  };
  const [w, h] = specs[kind];
  const img = createImage(w, h);

  // Shared contact shadow.
  const shadow = (x0, w0) => {
    for (let x = x0; x < x0 + w0; x++) {
      for (let y = h - 7; y < h; y++) {
        setPixel(img, x, y, 24, 20, 16, Math.round(80 * (1 - (y - (h - 7)) / 7)));
      }
    }
  };

  switch (kind) {
    case 'table': {
      shadow(6, w - 12);
      fillRect(img, 10, h - 26, 8, 20, pal.woodDark);
      fillRect(img, w - 18, h - 26, 8, 20, pal.woodDark);
      fillRect(img, 4, 14, w - 8, 26, pal.wood);
      fillRect(img, 4, 14, w - 8, 5, pal.woodLight);
      strokeRect(img, 4, 14, w - 8, 26, pal.woodDark, 2);
      break;
    }
    case 'chair': {
      shadow(14, w - 28);
      fillRect(img, 18, 8, 28, 30, pal.wood);
      fillRect(img, 18, 8, 28, 5, pal.woodLight);
      fillRect(img, 20, 38, 6, 16, pal.woodDark);
      fillRect(img, 38, 38, 6, 16, pal.woodDark);
      strokeRect(img, 18, 8, 28, 30, pal.woodDark, 2);
      break;
    }
    case 'bed': {
      shadow(6, w - 12);
      fillRect(img, 6, 10, w - 12, h - 22, pal.wood);
      strokeRect(img, 6, 10, w - 12, h - 22, pal.woodDark, 3);
      fillRect(img, 10, 16, w - 20, 34, [236, 232, 220]);       // pillow
      fillRect(img, 10, 50, w - 20, h - 68, pal.fabricRed);      // blanket
      fillRect(img, 10, 50, w - 20, 4, pal.fabricRedDark);
      break;
    }
    case 'counter': {
      shadow(4, w - 8);
      fillRect(img, 2, 12, w - 4, h - 24, pal.wood);
      fillRect(img, 0, 6, w, 10, pal.woodLight);
      strokeRect(img, 0, 6, w, 10, pal.woodDark, 2);
      for (let x = 12; x < w - 8; x += 22) fillRect(img, x, 20, 2, h - 34, pal.woodDark);
      break;
    }
    case 'shelf': {
      shadow(6, w - 12);
      fillRect(img, 6, 4, w - 12, h - 12, pal.woodDark);
      fillRect(img, 10, 8, w - 20, h - 22, pal.wood);
      for (let y = 8; y < h - 16; y += 18) {
        fillRect(img, 10, y, w - 20, 3, pal.woodDark);
        for (let x = 14; x < w - 22; x += 12) {
          const tone = hash2(x, y, 3);
          fillRect(img, x, y - 11, 8, 11, mixColor(pal.fabricRed, pal.glass, tone));
        }
      }
      break;
    }
    case 'barrel': {
      shadow(12, w - 24);
      fillRect(img, 14, 12, w - 28, h - 22, pal.wood);
      fillRect(img, 12, 18, w - 24, 5, pal.woodDark);
      fillRect(img, 12, h - 24, w - 24, 5, pal.woodDark);
      fillRect(img, 14, 12, w - 28, 5, pal.woodLight);
      break;
    }
    case 'fireplace': {
      shadow(2, w - 4);
      fillRect(img, 0, 0, w, h - 6, pal.stone);
      strokeRect(img, 0, 0, w, h - 6, pal.stoneDark, 3);
      for (let y = 6; y < h - 12; y += 14) {
        fillRect(img, 3, y, w - 6, 1, pal.stoneDark);
      }
      const hx = Math.round(w * 0.24);
      fillRect(img, hx, Math.round(h * 0.34), w - hx * 2, h - Math.round(h * 0.34) - 12, [32, 24, 20]);
      // Embers.
      for (let i = 0; i < 26; i++) {
        const ex = hx + 6 + Math.floor(hash2(i, 1, 9) * (w - hx * 2 - 12));
        const ey = h - 26 + Math.floor(hash2(i, 2, 9) * 12);
        const glow = mixColor(pal.ember, [255, 232, 150], hash2(i, 3, 9));
        fillRect(img, ex, ey, 3, 3, glow);
      }
      break;
    }
    case 'pot': {
      shadow(18, w - 36);
      fillRect(img, 18, 26, w - 36, h - 34, pal.dirt);
      fillRect(img, 14, 22, w - 28, 8, shade(pal.dirt, 1.1));
      for (let i = 0; i < 40; i++) {
        const gx = 20 + Math.floor(hash2(i, 4, 12) * (w - 40));
        const gy = 6 + Math.floor(hash2(i, 5, 12) * 18);
        fillRect(img, gx, gy, 4, 5, [58 + Math.floor(hash2(i, 6, 12) * 40), 120, 48]);
      }
      break;
    }
    case 'stairs': {
      shadow(2, w - 4);
      for (let s = 0; s < 4; s++) {
        const sy = h - 12 - s * 12;
        fillRect(img, 2 + s * 4, sy, w - 4 - s * 8, 12, shade(pal.stone, 1 + s * 0.05));
        fillRect(img, 2 + s * 4, sy, w - 4 - s * 8, 2, pal.stoneLight);
      }
      break;
    }
  }

  addGrain(img, 5, 2, 131);
  return img;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function generateStructures({ log = console.log } = {}) {
  const pal = samplePalette();
  log(`  palette sampled: wood rgb(${pal.wood}) stone rgb(${pal.stone}) dirt rgb(${pal.dirt})`);

  // ── Buildings + interior furniture, packed as one object atlas ────────────
  const buildingSpecs = [
    { name: 'house_small',  tilesW: 3, tilesH: 3, wall: 'plaster', windows: 2 },
    { name: 'house_wide',   tilesW: 4, tilesH: 3, wall: 'plaster', windows: 2 },
    { name: 'house_tall',   tilesW: 3, tilesH: 4, wall: 'plaster', windows: 2 },
    { name: 'house_stone',  tilesW: 4, tilesH: 4, wall: 'stone',   windows: 2 },
    { name: 'cottage',      tilesW: 3, tilesH: 3, wall: 'plaster', windows: 1, roofStyle: 'thatch' },
    { name: 'inn',          tilesW: 5, tilesH: 4, wall: 'plaster', windows: 3 },
    { name: 'shop',         tilesW: 4, tilesH: 4, wall: 'plaster', windows: 2 },
    { name: 'town_hall',    tilesW: 6, tilesH: 5, wall: 'stone',   windows: 3 },
  ];

  const sprites = [];
  for (const spec of buildingSpecs) {
    sprites.push({
      name: spec.name,
      category: 'building',
      image: drawBuilding(pal, spec),
      solid: true,
      // A building blocks its ENTIRE body, unlike a tree where only the trunk
      // collides. There is no walking behind a house: the player approaches the
      // door from the tile below it, where the entrance trigger sits.
      footprintFrac: { width: 0.96, height: 1.0 },
    });
  }
  sprites.push({ name: 'sign_inn', category: 'prop', image: drawSign(pal, 'bed'), solid: true, footprintFrac: { width: 0.5, height: 0.25 } });
  sprites.push({ name: 'sign_shop', category: 'prop', image: drawSign(pal, 'coin'), solid: true, footprintFrac: { width: 0.5, height: 0.25 } });

  for (const kind of ['table', 'chair', 'bed', 'counter', 'shelf', 'barrel', 'fireplace', 'pot', 'stairs']) {
    sprites.push({
      name: kind,
      category: 'furniture',
      image: furniture(pal, kind),
      solid: kind !== 'stairs',
      footprintFrac: { width: 0.92, height: kind === 'bed' ? 0.9 : 0.55 },
    });
  }

  // Shelf-pack.
  const PAD = 2;
  const ATLAS_W = 1024;
  const ordered = [...sprites].sort((a, b) => b.image.height - a.image.height);
  let cx = PAD, cy = PAD, shelf = 0;
  for (const s of ordered) {
    if (cx + s.image.width + PAD > ATLAS_W) { cx = PAD; cy += shelf + PAD; shelf = 0; }
    s.frame = { x: cx, y: cy, w: s.image.width, h: s.image.height };
    cx += s.image.width + PAD;
    shelf = Math.max(shelf, s.image.height);
  }
  const atlas = createImage(ATLAS_W, cy + shelf + PAD);
  for (const s of sprites) blit(atlas, s.image, s.frame.x, s.frame.y);

  fs.mkdirSync(OUT.atlases, { recursive: true });
  writePng(path.join(OUT.atlases, 'structures.png'), atlas.width, atlas.height, atlas.data);

  const frames = {};
  for (const s of sprites) {
    frames[s.name] = {
      frame: s.frame,
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: s.image.width, h: s.image.height },
      sourceSize: { w: s.image.width, h: s.image.height },
    };
  }
  fs.writeFileSync(
    path.join(OUT.atlases, 'structures.json'),
    `${JSON.stringify({
      frames,
      meta: { app: 'saga-asset-pipeline', image: 'structures.png', format: 'RGBA8888', size: { w: atlas.width, h: atlas.height }, scale: '1' },
    }, null, 2)}\n`,
  );

  fs.writeFileSync(
    path.join(OUT.atlases, 'structures.manifest.json'),
    `${JSON.stringify({
      generated: true,
      note: 'Procedurally generated: Files A and B contain no buildings or furniture. Replace the PNG and keep frame names to swap in real art.',
      tileSize: TILE,
      count: sprites.length,
      objects: sprites.map(s => {
        const fw = Math.round(s.image.width * s.footprintFrac.width);
        const fh = Math.round(s.image.height * s.footprintFrac.height);
        return {
          name: s.name,
          category: s.category,
          width: s.image.width,
          height: s.image.height,
          solid: s.solid,
          origin: { x: 0.5, y: 1 },
          footprint: {
            x: Math.round((s.image.width - fw) / 2),
            y: s.image.height - fh,
            width: fw,
            height: fh,
          },
          tileSpan: { x: Math.round(s.image.width / TILE), y: Math.round(s.image.height / TILE) },
        };
      }),
    }, null, 2)}\n`,
  );

  // ── Interior tileset ─────────────────────────────────────────────────────
  const interiorTiles = [
    { name: 'floor_wood',    image: floorBoards(pal, [150, 116, 78]) },
    { name: 'floor_wood_b',  image: floorBoards(pal, [126, 96, 64]) },
    { name: 'floor_stone',   image: stoneFloor(pal) },
    { name: 'carpet',        image: carpet(pal) },
    { name: 'wall',          image: plasterWall(pal, true), solid: true },
    { name: 'wall_plain',    image: plasterWall(pal, false), solid: true },
    { name: 'wall_top',      image: wallTop(pal), solid: true },
  ];
  const interior = writeTileset({ name: 'interior', outDir: OUT.tilesets, tiles: interiorTiles });
  fs.writeFileSync(
    path.join(OUT.tilesets, 'interior.manifest.json'),
    `${JSON.stringify({
      generated: true,
      tileSize: TILE,
      tileCount: interior.tileCount,
      columns: interior.columns,
      indexByName: interior.indexByName,
      floors: ['floor_wood', 'floor_wood_b', 'floor_stone', 'carpet'],
      walls: ['wall', 'wall_plain', 'wall_top'],
    }, null, 2)}\n`,
  );

  log(`  structures: ${sprites.length} sprites, atlas ${atlas.width}x${atlas.height}px`);
  log(`  interior: ${interior.tileCount} tiles`);

  return { palette: pal, sprites, interior };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.mkdirSync(OUT.tilesets, { recursive: true });
  generateStructures();
}
