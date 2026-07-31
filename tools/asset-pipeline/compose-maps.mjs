// tools/asset-pipeline/compose-maps.mjs
//
// Authors the game's tilemaps and writes them as Tiled 1.10 JSON.
//
// Structure follows the confirmed design: the travel map is a TRAVEL LAYER
// only — you cross it to get between places and random encounters happen on
// it — while towns, forests and interiors are separate field-scale maps.
//
// Geography follows docs/world-map-canon.md for western Elerion: Dawnkeep in
// the south-west, Everdawn Forest to its north, Eldric central, the Verdant
// River and Riverdale to the east, the Silverwall Mountains across the north
// with the Northwind Pass gap at Stonegate, Light's Sanctuary south-central,
// and Harborwatch on the south-east coast.

import fs from 'node:fs';
import path from 'node:path';
import { MapBuilder } from './lib/map-builder.mjs';
import { buildFromBlueprint } from './lib/blueprint.mjs';
import { DAWNKEEP_BLUEPRINT } from './mapdefs/dawnkeep.mjs';
import { OUT, TILE } from './lib/config.mjs';

const OBJ = 'overworld-objects';
const STRUCT = 'structures';

// Field fill. Only plain-grass cells and their mirrored variants belong here —
// see the note in slice-terrain.mjs about the shrub-bearing cells.
const GRASS = ['grass', 'grass_v1', 'grass_v2', 'grass_v3', 'grass_alt'];
// Sparse decoration scattered over the fill, including the shrub cells.
const FLOWERS = [
  'grass_flower_pink', 'grass_flower_white', 'grass_tuft', 'grass_pebbles',
  'grass_flower_pink_b', 'grass_flower_mixed', 'grass_flower_white_b',
  'grass_bush', 'grass_bush_b', 'grass_pebbles_b', 'grass_flower_yellow',
  'grass_flower_white_c',
  'grass_shrub_a', 'grass_shrub_b', 'grass_shrub_c',
  'grass_shrub_d', 'grass_shrub_e', 'grass_shrub_f',
];
const TALL_GRASS = ['tallgrass', 'tallgrass_b', 'tallgrass_c'];

const TREES = Array.from({ length: 21 }, (_, i) => `tree_${String(i + 1).padStart(2, '0')}`);
const FORESTS = Array.from({ length: 8 }, (_, i) => `forest_${String(i + 1).padStart(2, '0')}`);
const MOUNTAINS = Array.from({ length: 9 }, (_, i) => `mountain_${String(i + 1).padStart(2, '0')}`);
const CLIFFS = Array.from({ length: 9 }, (_, i) => `cliff_${String(i + 1).padStart(2, '0')}`);
const ROCKS = Array.from({ length: 38 }, (_, i) => `rock_${String(i + 1).padStart(2, '0')}`);
const BUSHES = Array.from({ length: 14 }, (_, i) => `bush_${String(i + 1).padStart(2, '0')}`);
const FENCES = Array.from({ length: 16 }, (_, i) => `fence_${String(i + 1).padStart(2, '0')}`);

/** Story flag ids, mirrored from src/game/data/story/story-events.ts. */
const FLAGS = {
  SERELLE_JOINED: 'serelle_joined',
  BOSS_VEYR_DEFEATED: 'boss_veyr_defeated',
};

// ─── Travel map: western Elerion ──────────────────────────────────────────────

function buildElerionWest(ctx) {
  const W = 60;
  const H = 40;
  const map = new MapBuilder({
    id: 'elerion_west',
    kind: 'travel',
    displayName: 'Western Elerion',
    width: W, height: H,
    tileset: ctx.terrain,
    tilesetJson: ctx.terrainJson,
    walkSpeed: 190,
  });

  map.fillGround(GRASS, 11);

  // ── Ocean frame ──────────────────────────────────────────────────────────
  // West and south coast, plus the Central Sea closing the east edge. The sea
  // is why Chapter 1 stays on this continent.
  map.paintRect('Water', 'water', 0, 0, 2, H);
  map.paintRect('Water', 'water', 0, H - 3, W, 3);
  map.paintRect('Water', 'water', W - 4, 0, 4, H);

  // ── Verdant River, north to south, with the Bridgeford gap ───────────────
  const RIVER_X = 41;
  const BRIDGE_Y = 19;
  map.paintRect('Water', 'water', RIVER_X, 4, 2, BRIDGE_Y - 4);
  map.paintRect('Water', 'water', RIVER_X, BRIDGE_Y + 3, 2, H - 3 - (BRIDGE_Y + 3));

  // ── Silverwall Mountains across the north, split by the Northwind Pass ────
  // Two rows of peaks over a cliff face reads as a real barrier; a single row
  // of sprites looked like scattered boulders when the map was first rendered.
  const PASS_X0 = 27;
  const PASS_X1 = 31;
  map.addCollisionRect(2, 0, PASS_X0 - 2, 5);
  map.addCollisionRect(PASS_X1 + 1, 0, W - 4 - (PASS_X1 + 1), 5);
  map.reserveRect(2, 0, W - 6, 6);
  for (const [x0, x1] of [[2, PASS_X0], [PASS_X1 + 1, W - 4]]) {
    for (let x = x0; x < x1; x += 2) {
      map.addObject(OBJ, CLIFFS[(x * 7) % CLIFFS.length], x, 4);
      map.addObject(OBJ, MOUNTAINS[(x * 3) % MOUNTAINS.length], x, 2 + (x % 2));
      if (x % 4 === 0) map.addObject(OBJ, MOUNTAINS[(x * 5) % MOUNTAINS.length], x + 1, 1);
    }
  }
  // Cliff walls line the pass itself so the corridor reads as a cut through rock.
  map.addObject(OBJ, CLIFFS[2], PASS_X0 - 1, 5);
  map.addObject(OBJ, CLIFFS[4], PASS_X1 + 1, 5);

  // ── Roads ────────────────────────────────────────────────────────────────
  // Routes are AXIS-ALIGNED with right-angle turns. The autotiler is 4-bit
  // cardinal, so a diagonal run staircases and renders as disconnected blobs;
  // right angles also match how top-down JRPG roads are conventionally drawn.
  // Painted at radius 1, giving a three-tile (192px) carriageway — wide enough
  // that travel never feels like threading a corridor.
  map.paintPath('Paths', 'road', [[9, 35], [9, 24], [20, 24], [20, 17], [28, 17]], 1);
  map.paintPath('Paths', 'road', [[28, 20], [28, 4]], 1);
  map.paintPath('Paths', 'road', [[28, 20], [45, 20]], 1);
  map.paintPath('Paths', 'road', [[45, 20], [45, 28], [51, 28]], 1);
  map.paintPath('Paths', 'road', [[9, 32], [22, 32]], 0);

  // Narrow forest track branching west off the main road.
  map.paintPath('Paths', 'path', [[20, 20], [13, 20], [13, 16]], 0);

  // ── Everdawn Forest ──────────────────────────────────────────────────────
  // The forest mass on the travel map is the outside of the walkable forest
  // field map; the track west leads to its entrance.
  map.scatterObjects(OBJ, FORESTS, { x: 3, y: 8, width: 14, height: 7 }, { spacing: 2, chance: 0.9, seed: 21 });
  map.scatterObjects(OBJ, TREES, { x: 3, y: 15, width: 11, height: 7 }, { spacing: 2, chance: 0.75, seed: 23 });
  map.addZone('everdawn_edge', 3, 8, 14, 14, {
    zoneId: 'western_forest_zone', displayName: 'Everdawn Forest',
  });

  // ── Thornwood: the corrupted patch east of Dawnkeep ──────────────────────
  map.addZone('thornwood', 13, 25, 14, 11, {
    zoneId: 'thornwood_zone', displayName: 'Thornwood',
  });

  // ── Northwind Pass encounter zone ────────────────────────────────────────
  map.addZone('northwind_pass', PASS_X0 - 1, 0, PASS_X1 - PASS_X0 + 3, 7, {
    zoneId: 'mountain_pass_zone', displayName: 'Northwind Pass',
  });

  // Everything not covered above is safe. Listed last: the loader returns the
  // FIRST zone containing the player, so specific zones must precede this.
  map.addZone('elerion_safe', 0, 0, W, H, {
    zoneId: 'elerion_safe', displayName: 'Western Elerion', type: 'safe',
  });

  // ── Landmarks ────────────────────────────────────────────────────────────
  // Settlements are clusters beside the road; the walkable versions of Dawnkeep
  // and Eldric are separate maps reached through the triggers below.
  map.addObject(STRUCT, 'cottage', 6, 33, { reserveTiles: { width: 3, height: 3 } });
  map.addObject(STRUCT, 'house_small', 13, 33, { reserveTiles: { width: 3, height: 3 } });
  map.addObject(STRUCT, 'house_wide', 5, 29, { reserveTiles: { width: 4, height: 3 } });
  map.addObject(STRUCT, 'sign_inn', 11, 34);

  // Eldric — the capital, still served by the legacy TownScene.
  map.addObject(STRUCT, 'town_hall', 24, 14, { reserveTiles: { width: 6, height: 5 } });
  map.addObject(STRUCT, 'house_stone', 33, 15, { reserveTiles: { width: 4, height: 4 } });
  map.addObject(STRUCT, 'house_wide', 23, 21, { reserveTiles: { width: 4, height: 3 } });

  // Riverdale, at the Bridgeford crossing.
  map.addObject(STRUCT, 'house_wide', 47, 18, { reserveTiles: { width: 4, height: 3 } });
  map.addObject(STRUCT, 'house_small', 47, 23, { reserveTiles: { width: 3, height: 3 } });

  // Stonegate, guarding the pass — set beside the road, not on it.
  map.addObject(STRUCT, 'house_stone', 33, 8, { reserveTiles: { width: 4, height: 4 } });

  // Light's Sanctuary and Harborwatch.
  map.addObject(STRUCT, 'house_stone', 21, 30, { reserveTiles: { width: 4, height: 4 } });
  map.addObject(STRUCT, 'house_wide', 51, 26, { reserveTiles: { width: 4, height: 3 } });
  map.addObject(STRUCT, 'shop', 51, 31, { reserveTiles: { width: 4, height: 4 } });

  // ── Scenery ──────────────────────────────────────────────────────────────
  // Density matters here: the first render of this map was mostly bare grass
  // and read as unfinished, so open country now carries steady tree and rock
  // cover with the roads kept clear by the reservation system.
  map.scatterObjects(OBJ, TREES, { x: 3, y: 6, width: 22, height: 16 }, { spacing: 3, chance: 0.5, seed: 35 });
  map.scatterObjects(OBJ, TREES, { x: 30, y: 6, width: 24, height: 12 }, { spacing: 3, chance: 0.45, seed: 37 });
  map.scatterObjects(OBJ, TREES, { x: 44, y: 22, width: 11, height: 13 }, { spacing: 3, chance: 0.5, seed: 39 });
  map.scatterObjects(OBJ, TREES, { x: 3, y: 25, width: 9, height: 10 }, { spacing: 3, chance: 0.45, seed: 43 });
  map.scatterObjects(OBJ, ROCKS, { x: 3, y: 5, width: W - 8, height: 31 }, { spacing: 5, chance: 0.4, seed: 31 });
  map.scatterObjects(OBJ, BUSHES, { x: 3, y: 5, width: W - 8, height: 31 }, { spacing: 4, chance: 0.35, seed: 33 });
  map.paintOrganicPatch('Terrain', TALL_GRASS, { x: 14, y: 26, width: 12, height: 9 }, { threshold: 0.5, seed: 45 });
  map.paintOrganicPatch('Terrain', TALL_GRASS, { x: 33, y: 22, width: 8, height: 12 }, { threshold: 0.52, seed: 47 });
  map.scatterGroundDecor(FLOWERS, 0.13, { seed: 41 });

  // ── Spawns ───────────────────────────────────────────────────────────────
  // Return spawns sit two tiles clear of their trigger and face away from it,
  // so arriving from a town never re-fires the entrance you just came out of.
  map.addSpawn('new_game', 9, 33, 'up');
  map.addSpawn('default', 9, 33, 'up');
  map.addSpawn('from_dawnkeep', 9, 33, 'up');
  map.addSpawn('from_everdawn', 13, 17, 'down');
  map.addSpawn('from_eldric', 28, 20, 'down');

  // ── Triggers ─────────────────────────────────────────────────────────────
  map.addTrigger('to_dawnkeep', 8, 35, 3, 1, {
    kind: 'map', activation: 'contact',
    targetMap: 'dawnkeep', targetSpawn: 'from_world', prompt: 'Dawnkeep',
  });
  map.addTrigger('to_everdawn', 12, 14, 3, 2, {
    kind: 'map', activation: 'contact',
    targetMap: 'everdawn_forest', targetSpawn: 'from_world', prompt: 'Everdawn Forest',
  });
  // Eldric still lives in the legacy TownScene; the scene routes by map id.
  map.addTrigger('to_eldric', 27, 17, 3, 2, {
    kind: 'map', activation: 'confirm',
    targetMap: 'lumen_town', prompt: 'Enter Eldric',
  });
  map.addTrigger('veyr_boss', PASS_X0, 1, 3, 2, {
    kind: 'battle', activation: 'confirm',
    prompt: 'Confront the Shadecaster',
    enemyIds: 'shadecaster_veyr',
    introDialogueId: 'boss_veyr_intro',
    outroDialogueId: 'boss_veyr_defeat',
    isBoss: true,
    backgroundColorHex: '#0d0820',
    requiresFlag: FLAGS.SERELLE_JOINED,
    consumedByFlag: FLAGS.BOSS_VEYR_DEFEATED,
  });

  return map;
}

// ─── Town map: Dawnkeep ───────────────────────────────────────────────────────
//
// Authored as an editable character grid rather than in code — see
// mapdefs/dawnkeep.mjs. Every square of the town is one character, so the
// layout can be read and rearranged directly, and the legend maps each
// character to a NAMED tile or atlas frame so replacement artwork drops in
// without touching the grid.

function buildDawnkeep(ctx) {
  return buildFromBlueprint(DAWNKEEP_BLUEPRINT, ctx);
}

// ─── Field map: Everdawn Forest ───────────────────────────────────────────────

function buildEverdawnForest(ctx) {
  const W = 48;
  const H = 36;
  const map = new MapBuilder({
    id: 'everdawn_forest',
    kind: 'field',
    displayName: 'Everdawn Forest',
    width: W, height: H,
    tileset: ctx.terrain,
    tilesetJson: ctx.terrainJson,
    walkSpeed: 175,
  });

  map.fillGround(GRASS, 81);

  // A trail from the southern entrance up to a northern clearing. Axis-aligned
  // with jogs — the 4-bit autotiler cannot express a diagonal run.
  const trail = [
    [24, 34], [24, 28], [17, 28], [17, 22], [24, 22],
    [24, 16], [31, 16], [31, 10], [24, 10], [24, 4],
  ];
  map.paintPath('Paths', 'path', trail, 0);

  // A stream across the middle of the wood, with a dry ford where the trail
  // crosses. Water tiles are solid in every variant, so the gap has to be a
  // real hole in the stream rather than something drawn on top of it.
  map.paintRect('Water', 'water', 0, 24, 15, 2, { reserve: true });
  map.paintRect('Water', 'water', 20, 24, 28, 2, { reserve: true });
  // Stepping stones either side sell the crossing.
  map.addObject(OBJ, ROCKS[4], 15, 24);
  map.addObject(OBJ, ROCKS[9], 19, 25);

  // Tall grass — the classic "encounters live here" surface. Noise-shaped so
  // the patches read as scrub rather than as obvious rectangles.
  map.paintOrganicPatch('Terrain', TALL_GRASS, { x: 6, y: 27, width: 12, height: 7 }, { threshold: 0.46, seed: 111 });
  map.paintOrganicPatch('Terrain', TALL_GRASS, { x: 28, y: 27, width: 14, height: 7 }, { threshold: 0.48, seed: 113 });
  map.paintOrganicPatch('Terrain', TALL_GRASS, { x: 6, y: 7, width: 11, height: 9 }, { threshold: 0.46, seed: 115 });
  map.paintOrganicPatch('Terrain', TALL_GRASS, { x: 33, y: 6, width: 11, height: 10 }, { threshold: 0.48, seed: 117 });
  map.paintOrganicPatch('Terrain', TALL_GRASS, { x: 18, y: 12, width: 10, height: 8 }, { threshold: 0.55, seed: 119 });

  // Dense forest walls around the edges, thinning toward the trail.
  map.scatterObjects(OBJ, FORESTS, { x: 0, y: 0, width: W, height: 4 }, { spacing: 2, chance: 0.95, seed: 91 });
  map.scatterObjects(OBJ, FORESTS, { x: 0, y: 3, width: 5, height: H - 3 }, { spacing: 2, chance: 0.92, seed: 93 });
  map.scatterObjects(OBJ, FORESTS, { x: W - 5, y: 3, width: 5, height: H - 3 }, { spacing: 2, chance: 0.92, seed: 95 });
  map.scatterObjects(OBJ, FORESTS, { x: 0, y: H - 3, width: 21, height: 3 }, { spacing: 2, chance: 0.92, seed: 97 });
  map.scatterObjects(OBJ, FORESTS, { x: 28, y: H - 3, width: 20, height: 3 }, { spacing: 2, chance: 0.92, seed: 99 });
  // Interior stands, so the middle of the wood is not an empty lawn.
  map.scatterObjects(OBJ, FORESTS, { x: 6, y: 5, width: 10, height: 6 }, { spacing: 3, chance: 0.6, seed: 100 });
  map.scatterObjects(OBJ, FORESTS, { x: 33, y: 18, width: 10, height: 6 }, { spacing: 3, chance: 0.6, seed: 102 });
  map.scatterObjects(OBJ, TREES, { x: 5, y: 4, width: W - 10, height: H - 8 }, { spacing: 3, chance: 0.6, seed: 101 });

  // Cliffs and boulders give the interior some structure to navigate around.
  map.addObject(OBJ, CLIFFS[1], 10, 19, { reserveTiles: { width: 4, height: 1 } });
  map.addObject(OBJ, CLIFFS[6], 37, 13, { reserveTiles: { width: 4, height: 1 } });
  map.scatterObjects(OBJ, ROCKS, { x: 6, y: 5, width: W - 12, height: H - 10 }, { spacing: 5, chance: 0.5, seed: 103 });
  map.scatterObjects(OBJ, BUSHES, { x: 6, y: 5, width: W - 12, height: H - 10 }, { spacing: 3, chance: 0.45, seed: 105 });
  map.scatterGroundDecor(FLOWERS, 0.16, { seed: 107 });

  // Encounters everywhere except the entrance clearing.
  map.addZone('everdawn_entrance', 20, 31, 9, 5, {
    zoneId: 'everdawn_safe', displayName: 'Forest Edge', type: 'safe',
  });
  map.addZone('everdawn_depths', 0, 0, W, 31, {
    zoneId: 'western_forest_zone', displayName: 'Everdawn Forest',
  });

  map.addSpawn('from_world', 24, 33, 'up');
  map.addSpawn('default', 24, 33, 'up');

  map.addTrigger('to_world', 22, H - 1, 5, 1, {
    kind: 'map', activation: 'contact',
    targetMap: 'elerion_west', targetSpawn: 'from_everdawn',
  });
  // Sits ON the trail, not beside it: the forest either side is dense enough
  // that an adjacent tile is usually walled in by tree footprints.
  map.addTrigger('forest_shrine_sign', 24, 6, 1, 1, {
    kind: 'sign', activation: 'confirm',
    prompt: 'Read the weathered marker', dialogueId: 'everdawn_marker',
  });

  return map;
}

// ─── Interior map: Dawnkeep Inn ───────────────────────────────────────────────

function buildDawnkeepInn(ctx) {
  const W = 20;
  const H = 15;
  const map = new MapBuilder({
    id: 'dawnkeep_inn',
    kind: 'interior',
    displayName: 'Dawnkeep Inn',
    width: W, height: H,
    tileset: ctx.interior,
    tilesetJson: ctx.interiorJson,
    walkSpeed: 160,
  });

  // Floor everywhere, then walls stamped over the border.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      map.setTile('Ground', x, y, (x + y) % 5 === 0 ? 'floor_wood_b' : 'floor_wood');
    }
  }
  // A stone entry hall inside the door.
  for (let y = H - 4; y < H - 1; y++) {
    for (let x = 8; x < 12; x++) map.setTile('Ground', x, y, 'floor_stone');
  }
  // Runner carpet up the middle.
  for (let y = 4; y < H - 4; y++) map.setTile('Terrain', 9, y, 'carpet');
  for (let y = 4; y < H - 4; y++) map.setTile('Terrain', 10, y, 'carpet');

  // Walls: a lit cap row along the top, plain wall below it, sides and bottom.
  for (let x = 0; x < W; x++) {
    map.setTile('Terrain', x, 0, 'wall_top');
    map.setTile('Terrain', x, 1, 'wall');
  }
  for (let y = 0; y < H; y++) {
    map.setTile('Terrain', 0, y, 'wall');
    map.setTile('Terrain', W - 1, y, 'wall');
  }
  for (let x = 0; x < W; x++) {
    if (x < 9 || x > 10) map.setTile('Terrain', x, H - 1, 'wall');
  }
  map.addCollisionRect(0, 0, W, 2);
  map.addCollisionRect(0, 0, 1, H);
  map.addCollisionRect(W - 1, 0, 1, H);
  map.addCollisionRect(0, H - 1, 9, 1);
  map.addCollisionRect(11, H - 1, W - 11, 1);

  // ── Furnishings ──────────────────────────────────────────────────────────
  map.addObject(STRUCT, 'counter', 4, 3, { reserveTiles: { width: 3, height: 1 } });
  map.addObject(STRUCT, 'shelf', 2, 2, { reserveTiles: { width: 2, height: 1 } });
  map.addObject(STRUCT, 'fireplace', 16, 3, { reserveTiles: { width: 2, height: 2 } });
  map.addObject(STRUCT, 'bed', 15, 8, { reserveTiles: { width: 1, height: 2 } });
  map.addObject(STRUCT, 'bed', 17, 8, { reserveTiles: { width: 1, height: 2 } });
  map.addObject(STRUCT, 'bed', 15, 12, { reserveTiles: { width: 1, height: 2 } });
  map.addObject(STRUCT, 'bed', 17, 12, { reserveTiles: { width: 1, height: 2 } });
  map.addObject(STRUCT, 'table', 4, 8, { reserveTiles: { width: 2, height: 1 } });
  map.addObject(STRUCT, 'chair', 3, 9);
  map.addObject(STRUCT, 'chair', 6, 9);
  map.addObject(STRUCT, 'table', 4, 12, { reserveTiles: { width: 2, height: 1 } });
  map.addObject(STRUCT, 'chair', 3, 13);
  map.addObject(STRUCT, 'barrel', 2, 6);
  map.addObject(STRUCT, 'pot', 18, 6);

  map.addNpc('innkeeper', 'innkeeper', 5, 4, {
    facing: 'down', label: 'Innkeeper', dialogueId: 'dawnkeep_innkeeper',
  });

  map.addSpawn('from_town', 10, 13, 'up');
  map.addSpawn('default', 10, 13, 'up');

  map.addTrigger('to_town', 9, H - 1, 2, 1, {
    kind: 'map', activation: 'contact',
    targetMap: 'dawnkeep', targetSpawn: 'from_inn',
  });
  map.addTrigger('inn_hearth', 16, 5, 2, 1, {
    kind: 'sign', activation: 'confirm',
    prompt: 'Warm yourself by the fire', dialogueId: 'inn_hearth',
  });

  map.addZone('inn_safe', 0, 0, W, H, {
    zoneId: 'inn_safe', displayName: 'Dawnkeep Inn', type: 'safe',
  });

  return map;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function composeMaps(ctx, { log = console.log } = {}) {
  fs.mkdirSync(OUT.maps, { recursive: true });

  const builders = [
    ['elerion-west', buildElerionWest],
    ['dawnkeep', buildDawnkeep],
    ['everdawn-forest', buildEverdawnForest],
    ['dawnkeep-inn', buildDawnkeepInn],
  ];

  const summary = [];
  for (const [file, build] of builders) {
    const map = build(ctx);
    const tiled = map.toTiled();
    fs.writeFileSync(
      path.join(OUT.maps, `${file}.json`),
      `${JSON.stringify(tiled)}\n`,
    );
    summary.push({
      file,
      id: map.id,
      kind: map.kind,
      tiles: `${map.width}x${map.height}`,
      pixels: `${map.width * TILE}x${map.height * TILE}`,
      objects: map.objects.length,
      triggers: map.triggers.length,
      zones: map.zones.length,
      npcs: map.npcs.length,
    });
    log(`  ${file}.json — ${map.width}x${map.height} tiles (${map.width * TILE}x${map.height * TILE}px), ` +
        `${map.objects.length} objects, ${map.triggers.length} triggers, ${map.npcs.length} NPCs`);
  }

  return summary;
}
