// src/game/data/maps/elerion-world-config.ts
//
// Layout configuration for the world of Elerion.
// Two-continent greybox foundation — placeholder visuals, real structure.
//
// All coordinates are in world-space pixels. Map is 4096 × 2304.
//
// Plan view (not to scale):
//
//   0                                                            4096
//   ┌────────────────────────────────────────────────────────────┐ 0
//   │   WESTERN CONTINENT          SEA       EASTERN CONTINENT   │
//   │  ▒▒ Evergreen Woods ▒▒                                     │
//   │                              ~ Lighthouse Isle    War      │ 600
//   │                              ~                    Fortress │
//   │  Forest Shrine              ~                              │
//   │                                                            │
//   │           ╔═══════╗ Mtn   ~ Merchant Isle      Black Reach │
//   │  Lumen   ║ Spine  ║ Gate                       ╔════════╗  │ 1000
//   │  (Cap)   ║  Mts.  ║ City  ─── Iron Bridge ───  ║ Citadel║  │
//   │   ●─road─╣  PASS  ╠─road─●  West/East ferry  ●─road─●   ║  │
//   │  Riverside ╚═══════╝       (placeholder)      Frontier Town│ 1100
//   │                                               River City  │
//   │                              ~ Storm Shrine                │
//   │ ▒ Thornwood ▒                                              │
//   │  (start area)                ~ Ruin Isle      Ancient Ruins│ 1800
//   │  Start Village                                             │
//   └────────────────────────────────────────────────────────────┘ 2304
//
// Movement chokepoints:
//   • Mountain Pass on Spine Mts. (x:1000-1200, gap y:1000-1150)
//   • Iron Bridge on Ironflow River (x:3150-3250, gap y:980-1080)
//   • Central Sea (x:1680-2480) blocks all foot travel between continents.
//
// Story flags (placeholder for future gating — initially all open for testing):
//   CHAPTER_2_MOUNTAIN_PASS_OPEN
//   CHAPTER_3_SEA_TRAVEL_UNLOCKED
//   CHAPTER_4_RIVER_CROSSING_OPEN
//   CHAPTER_6_FINAL_REGION_OPEN
//
// Existing scripted battle triggers preserved (Thornwood warden, Veyr boss);
// their flag gates (SERELLE_JOINED, THORNWOOD_CLEARED, BOSS_VEYR_DEFEATED) are
// unchanged — only the world-map positions have moved.

import type { WorldMapConfig } from '../../world/types/world-types';
import { STORY_FLAGS } from '../story/story-events';

// ─── Map dimensions and continental partitioning ──────────────────────────────

const MAP_W = 4096;
const MAP_H = 2304;

const OUTER_OCEAN  = 60;             // width of the impassable ocean rim
const WEST_X_START = 80;
const WEST_X_END   = 1680;           // western continent occupies x: 80–1680
const SEA_X_START  = 1680;
const SEA_X_END    = 2480;           // central sea occupies x: 1680–2480
const EAST_X_START = 2480;
const EAST_X_END   = 4016;           // eastern continent occupies x: 2480–4016

// Spine Mountains chokepoint
const MOUNTAIN_X    = 1000;
const MOUNTAIN_W    = 200;
const PASS_Y_START  = 1000;
const PASS_Y_END    = 1150;

// Ironflow River chokepoint
const RIVER_X        = 3150;
const RIVER_W        = 100;
const BRIDGE_Y_START = 980;
const BRIDGE_Y_END   = 1080;

// ─── Configuration ────────────────────────────────────────────────────────────

export const ELERION_WORLD_CONFIG: WorldMapConfig = {
  mapWidth:  MAP_W,
  mapHeight: MAP_H,

  // Player spawns at Start Village in the southwest of the Western continent.
  playerStartX: 250,
  playerStartY: 1850,

  // ── Regions (visual base terrain — drawn in array order) ───────────────────
  regions: [
    // Western continent landmass (broad plains base)
    {
      id: 'vergant_fields',
      displayName: 'Vergant Fields',
      x: WEST_X_START, y: OUTER_OCEAN,
      width: WEST_X_END - WEST_X_START,
      height: MAP_H - OUTER_OCEAN * 2,
      terrainKind: 'plains',
    },
    // Northern verdant woods band
    {
      id: 'evergreen_woods',
      displayName: 'Evergreen Woods',
      x: 100, y: 100, width: 880, height: 320,
      terrainKind: 'forest',
    },
    // Mid-west grove near Lumen
    {
      id: 'lumen_grove',
      displayName: 'Lumen Grove',
      x: 600, y: 700, width: 320, height: 220,
      terrainKind: 'forest',
    },
    // Southwest corrupted forest (Thornwood)
    {
      id: 'thornwood_region',
      displayName: 'Thornwood',
      x: 100, y: 1700, width: 720, height: 480,
      terrainKind: 'corrupted_forest',
    },
    // Spine Mountains — northern and southern walls flank the pass
    {
      id: 'spine_mts_north',
      displayName: 'Spine Mountains',
      x: MOUNTAIN_X, y: OUTER_OCEAN,
      width: MOUNTAIN_W,
      height: PASS_Y_START - OUTER_OCEAN,
      terrainKind: 'mountain',
    },
    {
      id: 'spine_mts_south',
      displayName: 'Spine Mountains',
      x: MOUNTAIN_X, y: PASS_Y_END,
      width: MOUNTAIN_W,
      height: (MAP_H - OUTER_OCEAN) - PASS_Y_END,
      terrainKind: 'mountain',
    },

    // ── Central sea islands ──
    { id: 'lighthouse_isle', displayName: 'Lighthouse Isle',
      x: 1860, y: 660, width: 160, height: 120, terrainKind: 'sand' },
    { id: 'merchant_isle',   displayName: 'Merchant Isle',
      x: 2050, y: 1060, width: 200, height: 140, terrainKind: 'sand' },
    { id: 'storm_isle',      displayName: 'Storm Shrine Isle',
      x: 2200, y: 1480, width: 160, height: 130, terrainKind: 'rocky' },
    { id: 'ruin_isle',       displayName: 'Ruin Isle',
      x: 1900, y: 1820, width: 150, height: 100, terrainKind: 'sand' },

    // Eastern continent landmass (rocky base)
    {
      id: 'greymarch_wilds',
      displayName: 'Greymarch Wilds',
      x: EAST_X_START, y: OUTER_OCEAN,
      width: EAST_X_END - EAST_X_START,
      height: MAP_H - OUTER_OCEAN * 2,
      terrainKind: 'rocky',
    },
    // Frontier dust band south-center of east continent
    {
      id: 'eastern_dustlands',
      displayName: 'Greymarch Dustlands',
      x: 2480, y: 1300,
      width: RIVER_X - 2480,
      height: MAP_H - 1300 - OUTER_OCEAN,
      terrainKind: 'dust',
    },
    // Ironflow River (paint sea-blue over the rocky base, leaves the river visible)
    {
      id: 'ironflow_river_n',
      displayName: 'Ironflow River',
      x: RIVER_X, y: OUTER_OCEAN,
      width: RIVER_W,
      height: BRIDGE_Y_START - OUTER_OCEAN,
      terrainKind: 'sea',
    },
    {
      id: 'ironflow_river_s',
      displayName: 'Ironflow River',
      x: RIVER_X, y: BRIDGE_Y_END,
      width: RIVER_W,
      height: (MAP_H - OUTER_OCEAN) - BRIDGE_Y_END,
      terrainKind: 'sea',
    },
    // Iron Bridge — rocky strip across the river gap
    {
      id: 'iron_bridge',
      displayName: 'Iron Bridge',
      x: RIVER_X, y: BRIDGE_Y_START,
      width: RIVER_W,
      height: BRIDGE_Y_END - BRIDGE_Y_START,
      terrainKind: 'rocky',
    },
    // Twilight Marches — dust beyond the river (overrides the rocky base)
    {
      id: 'twilight_marches',
      displayName: 'Twilight Marches',
      x: RIVER_X + RIVER_W, y: OUTER_OCEAN,
      width: EAST_X_END - (RIVER_X + RIVER_W),
      height: MAP_H - OUTER_OCEAN * 2,
      terrainKind: 'dust',
    },
    // Black Reach — far-east corruption belt (overrides dust)
    {
      id: 'black_reach',
      displayName: 'Black Reach',
      x: 3680, y: OUTER_OCEAN,
      width: EAST_X_END - 3680,
      height: 860,
      terrainKind: 'blight',
    },
  ],

  // ── Rivers (decorative, no collision) ───────────────────────────────────────
  rivers: [
    {
      id: 'verdant_river',
      width: 24,
      points: [
        { x: 720, y: 100 },
        { x: 750, y: 500 },
        { x: 770, y: 900 },
        { x: 740, y: 1300 },
        { x: 680, y: 1700 },
        { x: 640, y: 2200 },
      ],
    },
  ],

  // ── Roads ──────────────────────────────────────────────────────────────────
  roads: [
    // Western main road: Start Village → Lumen → Mountain Pass → West Port
    {
      id: 'west_main_road',
      width: 14,
      style: 'dirt',
      points: [
        { x: 260, y: 1850 },  // Start Village
        { x: 380, y: 1500 },  // Riverside lake village area
        { x: 520, y: 1180 },  // Lumen south gate
        { x: 800, y: 1080 },  // approach mountain pass
        { x: 1020, y: 1075 }, // pass entry (boss)
        { x: 1200, y: 1075 }, // pass exit
        { x: 1450, y: 1100 }, // approach West Port
        { x: 1580, y: 1150 }, // West Port
      ],
    },
    // West shrine branch (optional)
    {
      id: 'west_shrine_branch',
      width: 10,
      style: 'dirt',
      points: [
        { x: 380, y: 1100 },
        { x: 280, y: 700 },
        { x: 240, y: 280 },
      ],
    },
    // Eastern main road: East Port → Frontier → River City → War Fortress
    {
      id: 'east_main_road',
      width: 14,
      style: 'dirt',
      points: [
        { x: 2620, y: 1230 }, // East Port (Ashenveil)
        { x: 2880, y: 1180 },
        { x: 3080, y: 1080 }, // approach River City
        { x: 3160, y: 1030 }, // bridge entry
        { x: 3260, y: 1030 }, // bridge exit
        { x: 3440, y: 940 },
        { x: 3520, y: 620 },  // War Fortress
      ],
    },
    // East Ruins branch
    {
      id: 'east_ruins_branch',
      width: 12,
      style: 'dirt',
      points: [
        { x: 3300, y: 1080 },
        { x: 3460, y: 1300 },
        { x: 3580, y: 1550 }, // Ancient Ruins
      ],
    },
    // Citadel approach — stone road through Black Reach
    {
      id: 'citadel_road',
      width: 14,
      style: 'stone',
      points: [
        { x: 3520, y: 620 },
        { x: 3720, y: 420 },
        { x: 3860, y: 260 },  // Citadel
      ],
    },
  ],

  // ── Landmarks (visual labels only — actual triggers below) ─────────────────
  landmarks: [
    // Western continent
    { id: 'lm_start_village',  kind: 'village',  label: 'Start Village',
      x: 200, y: 1810, width: 110, height: 90 },
    { id: 'lm_lumen_capital',  kind: 'capital',  label: 'Lumen',
      x: 440, y: 1040, width: 160, height: 140 },
    { id: 'lm_riverside',      kind: 'village',  label: 'Riverside',
      x: 330, y: 1470, width: 90,  height: 70 },
    { id: 'lm_forest_shrine',  kind: 'shrine',   label: 'Forest Shrine',
      x: 210, y: 220, width: 90,  height: 80 },
    { id: 'lm_mountain_gate',  kind: 'gate',     label: 'Mountain Gate',
      x: 1020, y: 1020, width: 160, height: 110 },
    { id: 'lm_west_port',      kind: 'port',     label: 'West Port',
      x: 1530, y: 1110, width: 110, height: 90 },

    // Central sea islands
    { id: 'lm_lighthouse',     kind: 'island',   label: 'Lighthouse',
      x: 1880, y: 680, width: 110, height: 80 },
    { id: 'lm_merchant_isle',  kind: 'island',   label: 'Merchant Isle',
      x: 2080, y: 1090, width: 140, height: 90 },
    { id: 'lm_storm_shrine',   kind: 'island',   label: 'Storm Shrine',
      x: 2220, y: 1510, width: 110, height: 90 },
    { id: 'lm_ruin_isle',      kind: 'island',   label: 'Ruin Isle',
      x: 1920, y: 1830, width: 110, height: 80 },

    // Eastern continent
    { id: 'lm_east_port',      kind: 'port',     label: 'East Port (Ashenveil)',
      x: 2560, y: 1200, width: 130, height: 100 },
    { id: 'lm_frontier_town',  kind: 'town',     label: 'Frontier Town',
      x: 2830, y: 1170, width: 110, height: 90 },
    { id: 'lm_river_city',     kind: 'gate',     label: 'River City',
      x: 3060, y: 1000, width: 140, height: 110 },
    { id: 'lm_ancient_ruins',  kind: 'ruin',     label: 'Ancient Ruins',
      x: 3500, y: 1500, width: 130, height: 100 },
    { id: 'lm_war_fortress',   kind: 'fortress', label: 'War Fortress',
      x: 3450, y: 540, width: 140, height: 120 },
    { id: 'lm_dark_citadel',   kind: 'citadel',  label: 'Dark Citadel',
      x: 3800, y: 220, width: 160, height: 150 },
  ],

  // ── Solid obstacles ────────────────────────────────────────────────────────
  collisionRects: [
    // Outer ocean rim — full-map border the player cannot cross
    { x: 0,           y: 0,                width: MAP_W,      height: OUTER_OCEAN },
    { x: 0,           y: MAP_H - OUTER_OCEAN, width: MAP_W,   height: OUTER_OCEAN },
    { x: 0,           y: 0,                width: WEST_X_START, height: MAP_H },
    { x: EAST_X_END,  y: 0,                width: MAP_W - EAST_X_END, height: MAP_H },

    // Central sea — entire band between continents blocks foot travel
    { x: SEA_X_START, y: 0, width: SEA_X_END - SEA_X_START, height: MAP_H },

    // Spine Mountains — north and south flanks with the pass gap between
    { x: MOUNTAIN_X, y: 0,
      width: MOUNTAIN_W, height: PASS_Y_START },
    { x: MOUNTAIN_X, y: PASS_Y_END,
      width: MOUNTAIN_W, height: MAP_H - PASS_Y_END },

    // Ironflow River — north and south stretches with bridge gap between
    { x: RIVER_X, y: 0,
      width: RIVER_W, height: BRIDGE_Y_START },
    { x: RIVER_X, y: BRIDGE_Y_END,
      width: RIVER_W, height: MAP_H - BRIDGE_Y_END },
  ],

  // ── Scene transition triggers ──────────────────────────────────────────────
  triggers: [
    // Lumen capital entrance
    {
      id: 'lumen_town_entrance',
      x: 480, y: 1050, width: 80, height: 110,
      label: 'Enter Lumen',
      targetSceneKey: 'TownScene',
      targetLocationId: 'lumen_town',
    },
    // Thornwood scripted clearing (Grove Warden) — consumed after victory
    {
      id: 'thornwood_clearing',
      x: 320, y: 1900, width: 140, height: 110,
      label: 'Investigate Clearing',
      targetSceneKey: 'BattleScene',
      targetLocationId: 'thornwood',
      scriptedBattle: {
        enemyIds: ['grove_warden'],
        backgroundColorHex: '#0d1f10',
        introDialogueId: 'thornwood_warden_intro',
        outroDialogueId: 'thornwood_warden_defeat',
        isBoss: false,
        consumedByFlag: STORY_FLAGS.THORNWOOD_CLEARED,
      },
    },
    // Mountain Pass boss (was North Pass) — flag-gated by recruitment
    {
      id: 'mountain_pass_boss',
      x: 1040, y: 1020, width: 120, height: 110,
      label: 'Confront the Shadecaster',
      targetSceneKey: 'BattleScene',
      targetLocationId: 'mountain_pass',
      scriptedBattle: {
        enemyIds: ['shadecaster_veyr'],
        backgroundColorHex: '#0d0820',
        introDialogueId: 'boss_veyr_intro',
        outroDialogueId: 'boss_veyr_defeat',
        isBoss: true,
        requiresFlag: STORY_FLAGS.SERELLE_JOINED,
        consumedByFlag: STORY_FLAGS.BOSS_VEYR_DEFEATED,
      },
    },
    // East Port — Ashenveil town entrance (eastern arrival)
    {
      id: 'east_port_entrance',
      x: 2560, y: 1200, width: 130, height: 100,
      label: 'Enter Ashenveil',
      targetSceneKey: 'TownScene',
      targetLocationId: 'ashenveil_town',
    },
  ],

  // ── Encounter zones (most-specific first) ──────────────────────────────────
  zones: [
    {
      id: 'thornwood_zone',
      displayName: 'Thornwood',
      type: 'encounter',
      x: 100, y: 1680, width: 760, height: 560,
    },
    {
      id: 'mountain_pass_zone',
      displayName: 'Mountain Pass',
      type: 'encounter',
      x: 880, y: 980, width: 440, height: 200,
    },
    {
      id: 'western_forest_zone',
      displayName: 'Evergreen Woods',
      type: 'encounter',
      x: 100, y: 60, width: 880, height: 380,
    },
    {
      id: 'eastern_frontier_zone',
      displayName: 'Greymarch Frontier',
      type: 'encounter',
      x: EAST_X_START, y: 1100, width: RIVER_X - EAST_X_START, height: 1144,
    },
    {
      id: 'eastern_warfields_zone',
      displayName: 'Twilight Marches',
      type: 'encounter',
      x: RIVER_X + RIVER_W, y: 60,
      width: 430,
      height: 2184,
    },
    {
      id: 'blightlands_zone',
      displayName: 'Black Reach',
      type: 'encounter',
      x: 3680, y: 60, width: EAST_X_END - 3680, height: 920,
    },
    // Broad safe fallback so HUD shows a name everywhere else
    {
      id: 'elerion_safe',
      displayName: 'Elerion',
      type: 'safe',
      x: 0, y: 0, width: MAP_W, height: MAP_H,
    },
  ],

  // ── Sea routes (placeholder data only — ferry not yet implemented) ─────────
  seaRoutes: [
    {
      id: 'ferry_west_to_east',
      fromTriggerId: 'west_port_ferry',
      toX: 2620, toY: 1240,
      requiresFlag: STORY_FLAGS.CHAPTER_3_SEA_TRAVEL_UNLOCKED,
    },
    {
      id: 'ferry_east_to_west',
      fromTriggerId: 'east_port_ferry',
      toX: 1560, toY: 1140,
      requiresFlag: STORY_FLAGS.CHAPTER_3_SEA_TRAVEL_UNLOCKED,
    },
  ],

  // ── Fast travel placeholders (none wired up) ───────────────────────────────
  fastTravelNodes: [],
};
