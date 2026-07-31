// tools/asset-pipeline/preview-maps.mjs
//
// Verification helper (not part of `npm run assets`).
// Renders each generated Tiled map to a PNG exactly as the game layers it:
// tile layers in order, then objects y-sorted by their ground contact point.
//
// This catches autotile mistakes, object clumping and blocked routes without
// having to launch a browser.
//
// Run: node tools/asset-pipeline/preview-maps.mjs [--scale 0.25]

import fs from 'node:fs';
import path from 'node:path';
import { readPng, writePng } from './lib/png.mjs';
import { createImage, blit, crop, resample, fillRect } from './lib/image.mjs';
import { OUT, TILE } from './lib/config.mjs';

const scaleArg = process.argv.indexOf('--scale');
const SCALE = scaleArg > -1 ? Number(process.argv[scaleArg + 1]) : 0.25;
const showCollision = process.argv.includes('--collision');

const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));

const atlases = {
  'overworld-objects': {
    image: readPng(path.join(OUT.atlases, 'overworld-objects.png')),
    json: readJson(path.join(OUT.atlases, 'overworld-objects.json')),
    manifest: readJson(path.join(OUT.atlases, 'overworld-objects.manifest.json')),
  },
  structures: {
    image: readPng(path.join(OUT.atlases, 'structures.png')),
    json: readJson(path.join(OUT.atlases, 'structures.json')),
    manifest: readJson(path.join(OUT.atlases, 'structures.manifest.json')),
  },
};

const metaByFrame = {};
for (const atlas of Object.values(atlases)) {
  for (const obj of atlas.manifest.objects) metaByFrame[obj.name] = obj;
}

const tilesetImages = {
  'overworld-terrain': readPng(path.join(OUT.tilesets, 'overworld-terrain.png')),
  interior: readPng(path.join(OUT.tilesets, 'interior.png')),
};

const TILE_LAYER_ORDER = ['Ground', 'Terrain', 'Water', 'Paths', 'DecorationBelow', 'DecorationAbove', 'Foreground'];

function renderMap(file) {
  const map = readJson(path.join(OUT.maps, file));
  const W = map.width * TILE;
  const H = map.height * TILE;
  const canvas = createImage(W, H, [20, 30, 46, 255]);

  const tileset = map.tilesets[0];
  const sheet = tilesetImages[tileset.name];
  if (!sheet) throw new Error(`no image for tileset ${tileset.name}`);

  // Cache each tile once; a 60x40 map draws 2400 tiles from ~98 distinct ids.
  const tileCache = new Map();
  const tileImage = (gid) => {
    if (tileCache.has(gid)) return tileCache.get(gid);
    const localId = gid - tileset.firstgid;
    const sx = (localId % tileset.columns) * TILE;
    const sy = Math.floor(localId / tileset.columns) * TILE;
    const img = crop(sheet, sx, sy, TILE, TILE);
    tileCache.set(gid, img);
    return img;
  };

  for (const name of TILE_LAYER_ORDER) {
    const layer = map.layers.find(l => l.type === 'tilelayer' && l.name === name);
    if (!layer) continue;
    for (let i = 0; i < layer.data.length; i++) {
      const gid = layer.data[i];
      if (gid === 0) continue;
      const x = (i % layer.width) * TILE;
      const y = Math.floor(i / layer.width) * TILE;
      blit(canvas, tileImage(gid), x, y);
    }
  }

  // Objects, sorted by ground contact y so nearer things overlap further ones.
  const objectLayer = map.layers.find(l => l.type === 'objectgroup' && l.name === 'Objects');
  const placed = (objectLayer?.objects ?? []).map(o => {
    const props = Object.fromEntries((o.properties ?? []).map(p => [p.name, p.value]));
    return { x: o.x, y: o.y, atlas: props.atlas, frame: props.frame };
  }).sort((a, b) => a.y - b.y);

  for (const obj of placed) {
    const atlas = atlases[obj.atlas];
    const frameDef = atlas?.json.frames[obj.frame];
    if (!frameDef) continue;
    const { x: fx, y: fy, w, h } = frameDef.frame;
    const sprite = crop(atlas.image, fx, fy, w, h);
    blit(canvas, sprite, Math.round(obj.x - w / 2), Math.round(obj.y - h));
  }

  // NPCs as small markers.
  const npcLayer = map.layers.find(l => l.type === 'objectgroup' && l.name === 'NPCs');
  for (const npc of npcLayer?.objects ?? []) {
    fillRect(canvas, Math.round(npc.x - 10), Math.round(npc.y - 48), 20, 48, [230, 210, 90, 230]);
  }

  if (showCollision) {
    const collision = map.layers.find(l => l.type === 'objectgroup' && l.name === 'Collision');
    for (const rect of collision?.objects ?? []) {
      fillRect(canvas, rect.x, rect.y, rect.width, 3, [255, 60, 60, 220]);
      fillRect(canvas, rect.x, rect.y + rect.height - 3, rect.width, 3, [255, 60, 60, 220]);
      fillRect(canvas, rect.x, rect.y, 3, rect.height, [255, 60, 60, 220]);
      fillRect(canvas, rect.x + rect.width - 3, rect.y, 3, rect.height, [255, 60, 60, 220]);
    }
  }

  // Triggers and spawns, always drawn so routes can be checked.
  const triggers = map.layers.find(l => l.type === 'objectgroup' && l.name === 'Triggers');
  for (const t of triggers?.objects ?? []) {
    for (let i = 0; i < 4; i++) {
      fillRect(canvas, t.x + i, t.y + i, t.width - i * 2, 1, [120, 220, 255, 255]);
      fillRect(canvas, t.x + i, t.y + t.height - 1 - i, t.width - i * 2, 1, [120, 220, 255, 255]);
      fillRect(canvas, t.x + i, t.y + i, 1, t.height - i * 2, [120, 220, 255, 255]);
      fillRect(canvas, t.x + t.width - 1 - i, t.y + i, 1, t.height - i * 2, [120, 220, 255, 255]);
    }
  }
  const spawns = map.layers.find(l => l.type === 'objectgroup' && l.name === 'SpawnPoints');
  for (const s of spawns?.objects ?? []) {
    fillRect(canvas, Math.round(s.x - 8), Math.round(s.y - 8), 16, 16, [255, 90, 220, 255]);
  }

  const out = SCALE === 1
    ? canvas
    : resample(canvas, Math.round(W * SCALE), Math.round(H * SCALE));
  const outFile = path.join(OUT.debug, `preview-${path.basename(file, '.json')}.png`);
  fs.mkdirSync(OUT.debug, { recursive: true });
  writePng(outFile, out.width, out.height, out.data);
  console.log(`${file}: ${W}x${H} -> ${out.width}x${out.height}  ${path.relative(process.cwd(), outFile)}`);
}

for (const file of fs.readdirSync(OUT.maps).filter(f => f.endsWith('.json'))) {
  renderMap(file);
}
