// tools/asset-pipeline/validate-maps.mjs
//
// Structural validation of the generated maps. Run after `npm run assets`.
//
// This checks the things a playthrough would catch only by luck, and checks
// them exhaustively rather than along one path: that no spawn point is buried
// inside scenery, that every trigger can actually be stood in, and that every
// map-to-map link points at something that exists. A trigger walled in behind
// a tree is invisible until a player happens to walk there.
//
// Mirrors the runtime collision rules in src/game/maps/map-loader.ts:
// solid tiles from tileset properties, plus the base footprint of every solid
// object from the atlas manifests.

import fs from 'node:fs';
import path from 'node:path';
import { OUT, TILE } from './lib/config.mjs';

const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));

/** Map ids the game registers. Kept in step with src/game/maps/map-registry.ts. */
const REGISTERED = ['elerion_west', 'dawnkeep', 'everdawn_forest', 'dawnkeep_inn'];
/** Ids handled by the legacy TownScene rather than a tilemap. */
const LEGACY_TOWNS = ['lumen_town', 'ashenveil_town'];

const FILE_BY_ID = {
  elerion_west: 'elerion-west',
  dawnkeep: 'dawnkeep',
  everdawn_forest: 'everdawn-forest',
  dawnkeep_inn: 'dawnkeep-inn',
};

const objectMeta = {};
for (const name of ['overworld-objects', 'structures']) {
  for (const o of readJson(path.join(OUT.atlases, `${name}.manifest.json`)).objects) {
    objectMeta[o.name] = o;
  }
}

const props = list => Object.fromEntries((list ?? []).map(p => [p.name, p.value]));
const layer = (map, name) => map.layers.find(l => l.name === name);

function buildSolidGrid(map) {
  const grid = new Uint8Array(map.width * map.height);
  const tileset = map.tilesets[0];

  const solidGids = new Set();
  for (const t of tileset.tiles ?? []) {
    if (props(t.properties).solid === true) solidGids.add(tileset.firstgid + t.id);
  }

  const markRect = (x, y, w, h) => {
    const minX = Math.floor(x / TILE);
    const minY = Math.floor(y / TILE);
    const maxX = Math.ceil((x + w) / TILE) - 1;
    const maxY = Math.ceil((y + h) / TILE) - 1;
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
        grid[ty * map.width + tx] = 1;
      }
    }
  };

  for (const l of map.layers) {
    if (l.type !== 'tilelayer') continue;
    for (let i = 0; i < l.data.length; i++) {
      if (solidGids.has(l.data[i])) grid[i] = 1;
    }
  }

  for (const o of layer(map, 'Collision')?.objects ?? []) {
    markRect(o.x, o.y, o.width, o.height);
  }

  for (const o of layer(map, 'Objects')?.objects ?? []) {
    const p = props(o.properties);
    const meta = objectMeta[p.frame];
    if (!meta || !meta.solid) continue;
    const left = o.x - meta.width * meta.origin.x;
    const top = o.y - meta.height * meta.origin.y;
    markRect(left + meta.footprint.x, top + meta.footprint.y, meta.footprint.width, meta.footprint.height);
  }

  return grid;
}

const isSolid = (grid, map, tx, ty) =>
  tx < 0 || ty < 0 || tx >= map.width || ty >= map.height || grid[ty * map.width + tx] === 1;

/** Flood fill of walkable tiles from a starting tile. */
function reachableFrom(grid, map, startX, startY) {
  const seen = new Uint8Array(map.width * map.height);
  if (isSolid(grid, map, startX, startY)) return seen;
  const stack = [[startX, startY]];
  seen[startY * map.width + startX] = 1;
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (isSolid(grid, map, nx, ny)) continue;
      const i = ny * map.width + nx;
      if (seen[i]) continue;
      seen[i] = 1;
      stack.push([nx, ny]);
    }
  }
  return seen;
}

const problems = [];
const note = (mapId, message) => problems.push(`${mapId}: ${message}`);

console.log('Validating generated maps\n');

for (const mapId of REGISTERED) {
  const file = path.join(OUT.maps, `${FILE_BY_ID[mapId]}.json`);
  if (!fs.existsSync(file)) { note(mapId, `map file missing: ${file}`); continue; }
  const map = readJson(file);
  const grid = buildSolidGrid(map);

  const spawns = layer(map, 'SpawnPoints')?.objects ?? [];
  const triggers = layer(map, 'Triggers')?.objects ?? [];
  const npcs = layer(map, 'NPCs')?.objects ?? [];
  const zones = layer(map, 'EncounterZones')?.objects ?? [];

  if (spawns.length === 0) note(mapId, 'has no spawn points');

  // Spawn coordinates are centre-x / feet-y; the tile the player stands in is
  // the one just above the feet line.
  const spawnTile = s => [Math.floor(s.x / TILE), Math.floor((s.y - 1) / TILE)];

  for (const s of spawns) {
    const [tx, ty] = spawnTile(s);
    if (isSolid(grid, map, tx, ty)) note(mapId, `spawn "${s.name}" is inside solid geometry at tile ${tx},${ty}`);
  }

  // Everything must be reachable from the map's primary arrival point.
  const primary = spawns.find(s => s.name === 'default') ?? spawns[0];
  if (primary) {
    const [px, py] = spawnTile(primary);
    const seen = reachableFrom(grid, map, px, py);
    const anyReachable = (x, y, w, h) => {
      const minX = Math.floor(x / TILE), minY = Math.floor(y / TILE);
      const maxX = Math.ceil((x + w) / TILE) - 1, maxY = Math.ceil((y + h) / TILE) - 1;
      for (let ty = minY; ty <= maxY; ty++) {
        for (let tx = minX; tx <= maxX; tx++) {
          if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
          if (seen[ty * map.width + tx]) return true;
        }
      }
      return false;
    };

    for (const t of triggers) {
      if (!anyReachable(t.x, t.y, t.width, t.height)) {
        note(mapId, `trigger "${t.name}" is unreachable from spawn "${primary.name}"`);
      }
    }
    for (const s of spawns) {
      const [tx, ty] = spawnTile(s);
      if (!isSolid(grid, map, tx, ty) && !seen[ty * map.width + tx]) {
        note(mapId, `spawn "${s.name}" is walled off from spawn "${primary.name}"`);
      }
    }
    // An NPC you cannot walk up to is an NPC that does not exist.
    for (const n of npcs) {
      if (!anyReachable(n.x - TILE, n.y - TILE * 2, TILE * 2, TILE * 2)) {
        note(mapId, `NPC "${n.name}" has no reachable adjacent tile`);
      }
    }
  }

  // Link integrity.
  for (const t of triggers) {
    const p = props(t.properties);
    if (p.kind !== 'map') continue;
    const target = p.targetMap;
    if (!target) { note(mapId, `trigger "${t.name}" is kind=map with no targetMap`); continue; }
    if (LEGACY_TOWNS.includes(target)) continue;
    if (!REGISTERED.includes(target)) {
      note(mapId, `trigger "${t.name}" targets unknown map "${target}"`);
      continue;
    }
    const targetMap = readJson(path.join(OUT.maps, `${FILE_BY_ID[target]}.json`));
    const targetSpawns = (layer(targetMap, 'SpawnPoints')?.objects ?? []).map(s => s.name);
    if (p.targetSpawn && !targetSpawns.includes(p.targetSpawn)) {
      note(mapId, `trigger "${t.name}" targets spawn "${p.targetSpawn}" which does not exist on "${target}" (has: ${targetSpawns.join(', ')})`);
    }
  }

  const solidCount = grid.reduce((a, b) => a + b, 0);
  const walkable = map.width * map.height - solidCount;
  console.log(
    `  ${mapId.padEnd(16)} ${String(map.width).padStart(2)}x${String(map.height).padStart(2)} ` +
    `walkable ${String(walkable).padStart(5)}/${map.width * map.height}  ` +
    `spawns ${spawns.length}  triggers ${triggers.length}  zones ${zones.length}  npcs ${npcs.length}`,
  );
}

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log('  ✗', p);
  process.exit(1);
}
console.log('\nAll maps valid.');
