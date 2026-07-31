// tools/asset-pipeline/extract-objects.mjs
//
// FILE B (overworldtile2.png) -> the overworld object atlas.
//
// What the source actually is (measured, see docs/asset-pipeline.md):
//   1024x1024 RGBA with GENUINE alpha — 50.3% fully transparent, 43.1% fully
//   opaque, 6.6% partial (ordinary antialiasing, not a halo). Composited over
//   magenta there is no green fringe, so NO colour-keying, despill or
//   background removal is required or performed. The green seen in a naive
//   preview is the RGB of pixels that are already alpha 0.
//
//   Objects sit on no grid at all, so they are found by connected-component
//   labelling rather than by slicing: 243 components, 121 of them >=120px,
//   sized 33..309 wide by 22..103 tall.
//
// Each object becomes an independently placeable sprite with a bottom-centre
// origin and a COLLISION FOOTPRINT covering only its base — so a tree blocks
// its trunk while the player walks behind its canopy.

import fs from 'node:fs';
import path from 'node:path';
import { readPng, writePng } from './lib/png.mjs';
import { createImage, blit, crop } from './lib/image.mjs';
import { SOURCES, OUT, TILE } from './lib/config.mjs';

/** Alpha at or above this counts as solid object body during labelling. */
const LABEL_ALPHA = 128;
/** Components smaller than this are speckle, not artwork. */
const MIN_COMPONENT_PIXELS = 120;
/** Transparent padding kept around each frame in the packed atlas. */
const FRAME_PADDING = 2;
const ATLAS_WIDTH = 1024;

/**
 * Collision footprint and behaviour per category.
 *   widthFrac  — fraction of sprite width the base occupies, centred
 *   heightFrac — fraction of sprite height, measured up from the bottom
 * A tree's canopy is deliberately excluded so the player can overlap it.
 */
const CATEGORY_RULES = {
  tree:     { widthFrac: 0.42, heightFrac: 0.16, solid: true },
  forest:   { widthFrac: 0.92, heightFrac: 0.30, solid: true },
  mountain: { widthFrac: 0.88, heightFrac: 0.42, solid: true },
  cliff:    { widthFrac: 1.00, heightFrac: 0.55, solid: true },
  rock:     { widthFrac: 0.82, heightFrac: 0.48, solid: true },
  fence:    { widthFrac: 1.00, heightFrac: 0.45, solid: true },
  structure:{ widthFrac: 0.85, heightFrac: 0.45, solid: true },
  bush:     { widthFrac: 0.70, heightFrac: 0.40, solid: false },
  prop:     { widthFrac: 0.70, heightFrac: 0.40, solid: false },
};

/** Labels 8-connected regions of alpha>=LABEL_ALPHA. Iterative, no recursion. */
function labelComponents(img) {
  const { width, height, data } = img;
  const labels = new Int32Array(width * height);
  const stack = new Int32Array(width * height);
  const components = [];
  let nextLabel = 0;

  for (let sy = 0; sy < height; sy++) {
    for (let sx = 0; sx < width; sx++) {
      const seed = sy * width + sx;
      if (labels[seed] !== 0 || data[seed * 4 + 3] < LABEL_ALPHA) continue;

      nextLabel++;
      let sp = 0;
      stack[sp++] = seed;
      labels[seed] = nextLabel;
      let minX = sx, maxX = sx, minY = sy, maxY = sy, area = 0;

      while (sp > 0) {
        const p = stack[--sp];
        const y = (p / width) | 0;
        const x = p - y * width;
        area++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;
            const ni = ny * width + nx;
            if (labels[ni] !== 0 || data[ni * 4 + 3] < LABEL_ALPHA) continue;
            labels[ni] = nextLabel;
            stack[sp++] = ni;
          }
        }
      }

      components.push({
        label: nextLabel,
        x: minX, y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        area,
      });
    }
  }
  return { labels, components };
}

/**
 * Colour make-up of a component, measured overall AND split into vertical
 * thirds.
 *
 * The vertical split is what separates a cliff from a forest block: both are
 * wide and both contain green, but a cliff is grass on TOP over a bare rock
 * face BELOW, whereas a forest block is foliage all the way down. A whole-
 * sprite average cannot tell them apart, and an earlier flat version of this
 * function filed most cliff pieces under `forest` and `mountain`.
 */
function analyseColor(img, labels, comp) {
  const bandHeight = comp.height / 3;
  const bands = [
    { green: 0, grey: 0, brown: 0, yellow: 0, total: 0 },
    { green: 0, grey: 0, brown: 0, yellow: 0, total: 0 },
    { green: 0, grey: 0, brown: 0, yellow: 0, total: 0 },
  ];

  for (let y = comp.y; y < comp.y + comp.height; y++) {
    const band = bands[Math.min(2, Math.floor((y - comp.y) / bandHeight))];
    for (let x = comp.x; x < comp.x + comp.width; x++) {
      const i = y * img.width + x;
      if (labels[i] !== comp.label) continue;
      const r = img.data[i * 4], g = img.data[i * 4 + 1], b = img.data[i * 4 + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      band.total++;
      if (g > r + 8 && g > b + 8) band.green++;
      else if (r > 130 && g > 110 && b < min + 90 && r - b > 55) band.yellow++;
      else if (max - min < 30) band.grey++;
      else if (r > b + 20 && g > b) band.brown++;
    }
  }

  const frac = (band, key) => (band.total ? band[key] / band.total : 0);
  const totalPixels = bands.reduce((sum, b) => sum + b.total, 0) || 1;
  const overall = key =>
    bands.reduce((sum, b) => sum + b[key], 0) / totalPixels;

  return {
    green: overall('green'),
    grey: overall('grey'),
    brown: overall('brown'),
    yellow: overall('yellow'),
    topGreen: frac(bands[0], 'green'),
    midGreen: frac(bands[1], 'green'),
    bottomGreen: frac(bands[2], 'green'),
    bottomGrey: frac(bands[2], 'grey'),
    bottomBrown: frac(bands[2], 'brown'),
  };
}

/**
 * Assigns a category from measured geometry plus banded colour make-up.
 *
 * The sheet groups objects by type in bands, but those bands mix categories
 * (the mountain band also holds forest blocks and cliff walls), so position
 * alone is unreliable. Every rule below was checked against the exported
 * contact sheet at tools/asset-pipeline/debug/objects-by-category.png — re-run
 * `node tools/asset-pipeline/extract-objects.mjs` and re-read that image after
 * changing anything here.
 */
function classify(comp, color) {
  const { width: w, height: h } = comp;
  const aspect = w / h;
  const foliage = color.green > 0.34;

  // Grass cap over an exposed rock face, and much wider than tall.
  const grassOverRock = color.topGreen > 0.30
    && color.bottomGreen < color.topGreen * 0.6
    && (color.bottomGrey + color.bottomBrown) > 0.30;
  if (grassOverRock && aspect > 1.2) return 'cliff';

  // Flowering ground cover: green plus a strong yellow/white bloom fraction.
  if (color.yellow > 0.12 && color.green > 0.15 && h < 70) return 'bush';

  // Rail fences: wide, low, wooden, and barely any foliage.
  if (aspect > 1.5 && h < 52 && color.brown > 0.18 && color.green < 0.30) return 'fence';

  if (foliage) {
    if (w >= 90 && aspect > 1.15) return 'forest';
    if (h >= 58 && aspect < 1.25) return 'tree';
    return 'bush';
  }

  // Peaked stone: a narrow grey summit widening downward.
  if (color.grey > 0.22 || color.brown > 0.25) {
    if (h >= 62 && w >= 60 && aspect < 1.6) return 'mountain';
    if (grassOverRock) return 'cliff';
    if (h >= 55 && aspect < 0.95) return 'prop';
    return 'rock';
  }
  return 'prop';
}

export function extractObjects({ log = console.log } = {}) {
  const sheet = readPng(SOURCES.objectSheet);

  // Confirm the transparency assumption instead of trusting it. If a future
  // sheet arrives flattened, this fails loudly rather than shipping objects
  // with opaque square backgrounds.
  let transparent = 0;
  for (let i = 0; i < sheet.width * sheet.height; i++) {
    if (sheet.data[i * 4 + 3] === 0) transparent++;
  }
  const transparentPct = (transparent / (sheet.width * sheet.height)) * 100;
  if (transparentPct < 5) {
    throw new Error(
      `${path.basename(SOURCES.objectSheet)} looks flattened (${transparentPct.toFixed(1)}% ` +
      'transparent). Objects need real alpha; add a background-removal step before packing.',
    );
  }
  log(`  source alpha check: ${transparentPct.toFixed(1)}% fully transparent — genuine alpha, no keying needed`);

  const { labels, components } = labelComponents(sheet);
  const kept = components
    .filter(c => c.area >= MIN_COMPONENT_PIXELS)
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));

  log(`  components: ${components.length} total, ${kept.length} above ${MIN_COMPONENT_PIXELS}px`);

  // ── Cut each component out, excluding pixels owned by a neighbour ─────────
  const counters = {};
  const objects = [];

  for (const comp of kept) {
    const color = analyseColor(sheet, labels, comp);
    const category = classify(comp, color);

    // Grow slightly to keep the soft antialiased rim, which is unlabelled
    // (alpha < LABEL_ALPHA) and therefore not claimed by any component.
    const pad = 2;
    const x0 = Math.max(0, comp.x - pad);
    const y0 = Math.max(0, comp.y - pad);
    const x1 = Math.min(sheet.width, comp.x + comp.width + pad);
    const y1 = Math.min(sheet.height, comp.y + comp.height + pad);
    const w = x1 - x0;
    const h = y1 - y0;

    const image = createImage(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = (y0 + y) * sheet.width + (x0 + x);
        // Keep own body and unclaimed soft edges; drop a neighbour's body.
        if (labels[si] !== 0 && labels[si] !== comp.label) continue;
        const d = (y * w + x) * 4;
        image.data[d] = sheet.data[si * 4];
        image.data[d + 1] = sheet.data[si * 4 + 1];
        image.data[d + 2] = sheet.data[si * 4 + 2];
        image.data[d + 3] = sheet.data[si * 4 + 3];
      }
    }

    counters[category] = (counters[category] ?? 0) + 1;
    const name = `${category}_${String(counters[category]).padStart(2, '0')}`;

    const rule = CATEGORY_RULES[category] ?? CATEGORY_RULES.prop;
    const footprintW = Math.max(8, Math.round(w * rule.widthFrac));
    const footprintH = Math.max(6, Math.round(h * rule.heightFrac));

    objects.push({
      name,
      category,
      image,
      width: w,
      height: h,
      solid: rule.solid,
      // Origin is bottom-centre: map authors place an object by the point where
      // it meets the ground, which is also what depth sorting keys off.
      origin: { x: 0.5, y: 1 },
      // Footprint is relative to the sprite's top-left, in pixels.
      footprint: {
        x: Math.round((w - footprintW) / 2),
        y: h - footprintH,
        width: footprintW,
        height: footprintH,
      },
      tileSpan: { x: Math.max(1, Math.round(w / TILE)), y: Math.max(1, Math.round(h / TILE)) },
      source: { x: comp.x, y: comp.y, width: comp.width, height: comp.height },
    });
  }

  // ── Shelf-pack into an atlas ─────────────────────────────────────────────
  const packed = [...objects].sort((a, b) => b.height - a.height);
  let cursorX = FRAME_PADDING;
  let cursorY = FRAME_PADDING;
  let shelfHeight = 0;
  for (const obj of packed) {
    if (cursorX + obj.width + FRAME_PADDING > ATLAS_WIDTH) {
      cursorX = FRAME_PADDING;
      cursorY += shelfHeight + FRAME_PADDING;
      shelfHeight = 0;
    }
    obj.frame = { x: cursorX, y: cursorY, w: obj.width, h: obj.height };
    cursorX += obj.width + FRAME_PADDING;
    shelfHeight = Math.max(shelfHeight, obj.height);
  }
  const atlasHeight = cursorY + shelfHeight + FRAME_PADDING;

  const atlas = createImage(ATLAS_WIDTH, atlasHeight);
  for (const obj of objects) blit(atlas, obj.image, obj.frame.x, obj.frame.y);

  fs.mkdirSync(OUT.atlases, { recursive: true });
  writePng(path.join(OUT.atlases, 'overworld-objects.png'), atlas.width, atlas.height, atlas.data);

  // Phaser "JSON Hash" atlas format.
  const frames = {};
  for (const obj of objects) {
    frames[obj.name] = {
      frame: obj.frame,
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: obj.width, h: obj.height },
      sourceSize: { w: obj.width, h: obj.height },
    };
  }
  fs.writeFileSync(
    path.join(OUT.atlases, 'overworld-objects.json'),
    `${JSON.stringify({
      frames,
      meta: {
        app: 'saga-asset-pipeline',
        image: 'overworld-objects.png',
        format: 'RGBA8888',
        size: { w: atlas.width, h: atlas.height },
        scale: '1',
      },
    }, null, 2)}\n`,
  );

  // Runtime metadata: category, collision footprint, origin, tile span.
  const manifest = {
    generatedFrom: path.basename(SOURCES.objectSheet),
    tileSize: TILE,
    count: objects.length,
    categories: counters,
    objects: objects.map(o => ({
      name: o.name,
      category: o.category,
      width: o.width,
      height: o.height,
      solid: o.solid,
      origin: o.origin,
      footprint: o.footprint,
      tileSpan: o.tileSpan,
    })),
  };
  fs.writeFileSync(
    path.join(OUT.atlases, 'overworld-objects.manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  log(`  overworld-objects: ${objects.length} sprites, atlas ${atlas.width}x${atlas.height}px`);
  log(`  categories: ${Object.entries(counters).map(([k, v]) => `${k}=${v}`).join(' ')}`);

  return { objects, manifest };
}

/** Writes a category-grouped contact sheet used to verify classification. */
export function writeObjectDebugSheet(objects) {
  fs.mkdirSync(OUT.debug, { recursive: true });
  const byCategory = {};
  for (const o of objects) (byCategory[o.category] ??= []).push(o);

  const GAP = 6;
  const rows = [];
  for (const [category, list] of Object.entries(byCategory)) {
    let row = [];
    let rowWidth = GAP;
    for (const obj of list) {
      if (rowWidth + obj.width + GAP > 1200 && row.length) {
        rows.push({ category, items: row });
        row = [];
        rowWidth = GAP;
      }
      row.push(obj);
      rowWidth += obj.width + GAP;
    }
    if (row.length) rows.push({ category, items: row });
  }

  const rowHeights = rows.map(r => Math.max(...r.items.map(o => o.height)) + GAP * 2);
  const totalHeight = rowHeights.reduce((a, b) => a + b, 0) + GAP;
  const sheet = createImage(1220, totalHeight, [22, 26, 34, 255]);

  let y = GAP;
  rows.forEach((row, index) => {
    let x = GAP;
    for (const obj of row.items) {
      blit(sheet, obj.image, x, y);
      // Footprint marker: a magenta bar showing exactly what will collide.
      const f = obj.footprint;
      for (let fx = 0; fx < f.width; fx++) {
        const px = x + f.x + fx;
        const py = y + f.y + f.height - 1;
        if (px < sheet.width && py < sheet.height) {
          const i = (py * sheet.width + px) * 4;
          sheet.data[i] = 255; sheet.data[i + 1] = 0; sheet.data[i + 2] = 200; sheet.data[i + 3] = 255;
        }
      }
      x += obj.width + GAP;
    }
    y += rowHeights[index];
  });

  const file = path.join(OUT.debug, 'objects-by-category.png');
  writePng(file, sheet.width, sheet.height, sheet.data);
  return file;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { objects } = extractObjects();
  const file = writeObjectDebugSheet(objects);
  console.log(`  debug contact sheet: ${path.relative(process.cwd(), file)}`);
  const order = {};
  for (const o of objects) (order[o.category] ??= []).push(`${o.name}(${o.width}x${o.height})`);
  for (const [cat, list] of Object.entries(order)) console.log(`\n${cat}:\n  ${list.join(' ')}`);
}
