// src/game/data/maps/elerion-world-config.ts
//
// Layout configuration for the world of Elerion.
// Two-continent greybox foundation — placeholder visuals, real structure.
//
// Map is 5120 × 2880 (grew from 4096 × 2304 in the macro-scale pass — the
// western start area was too cramped for the intended Suikoden II-style
// travel feel: Start Village → Lumen now winds across the lower-west
// continent rather than sitting a few seconds apart).
//
// Plan view (not to scale):
//
//   0                                                                  5120
//   ┌─────────────────────────────────────────────────────────────────────┐ 0
//   │   WESTERN CONTINENT             SEA            EASTERN CONTINENT    │
//   │                                                                     │
//   │ ▒▒ Evergreen Woods ▒▒                            War Fortress       │
//   │                                ~ Lighthouse                         │
//   │  Forest Shrine                ~                  Black Reach        │
//   │                                                  ╔════════╗         │
//   │                Lumen (Cap)  ║║ Bridgeford   ~~~  ║ Citadel║         │
//   │                    ●─road──╪╪═══════════── ~~~ ●─road─●  ║         │
//   │                            ║║       Spine     ~~~                  │
//   │                  ─road─    ║║       Mts.      ~~~ River City        │
//   │  ▒ Thornwood ▒             ║║──Pass── Gate City   Frontier Town     │
//   │                            ║║                                      │
//   │                            ║║                ~~~ Ancient Ruins      │
//   │                            ║║                                      │
//   │  Start Village (SW)        ▼▼  West Port                             │
//   └─────────────────────────────────────────────────────────────────────┘ 2880
//
// Movement chokepoints (collisionRects match regions exactly so the
// invisible wall lines up with the visible water/wall):
//   • Mountain Pass on Spine Mts. (x:1900-2120, gap y:1300-1500).
//   • Bridgeford on Verdant River (x:1450-1530, gap y:1000-1140).
//   • Iron Bridge on Ironflow River (x:3900-4000, gap y:1200-1320).
//   • Central Sea (x:2400-3200) blocks all foot travel between continents.
//
// Story flags (placeholders, none wired into triggers — map fully traversable
// for testing): CHAPTER_2_MOUNTAIN_PASS_OPEN, CHAPTER_3_SEA_TRAVEL_UNLOCKED,
// CHAPTER_4_RIVER_CROSSING_OPEN, CHAPTER_6_FINAL_REGION_OPEN.
//
// TODO: story/quest triggers will be redesigned later. The old 'Investigate
// Clearing' trigger was disabled in a prior pass; the Grove Warden enemy
// and dialogue data remain available for the new quest design.

import type { WorldMapConfig } from '../../world/types/world-types';
import { STORY_FLAGS } from '../story/story-events';

// ─── Map dimensions and continental partitioning ──────────────────────────────

const MAP_W = 5120;
const MAP_H = 2880;

const OUTER_OCEAN  = 60;
const WEST_X_START = 80;
const WEST_X_END   = 2400;            // western continent occupies x: 80–2400
const SEA_X_START  = 2400;
const SEA_X_END    = 3200;            // central sea occupies x: 2400–3200
const EAST_X_START = 3200;
const EAST_X_END   = 5040;            // eastern continent occupies x: 3200–5040

// Spine Mountains chokepoint (western continent, splits west land from east coast)
const MTN_X         = 1900;
const MTN_W         = 220;
const PASS_Y_START  = 1300;
const PASS_Y_END    = 1500;

// Verdant River chokepoint (western continent, splits Lumen side from Mountain Gate)
const VRIVER_X            = 1450;
const VRIVER_W            = 80;
const BRIDGEFORD_Y_START  = 1000;
const BRIDGEFORD_Y_END    = 1140;

// Ironflow River chokepoint (eastern continent)
const IRIVER_X          = 3900;
const IRIVER_W          = 100;
const IBRIDGE_Y_START   = 1200;
const IBRIDGE_Y_END     = 1320;

// ─── Configuration ────────────────────────────────────────────────────────────

export const ELERION_WORLD_CONFIG: WorldMapConfig = {
  mapWidth:  MAP_W,
  mapHeight: MAP_H,

  // Start Village in the SW corner of the western continent. Spawn sits just
  // north of Thornwood's encounter zone so the HUD-less game opens in a safe
  // area. Pushed deep into the corner so the journey to Lumen feels real.
  playerStartX: 200,
  playerStartY: 2740,

  // ── Regions ────────────────────────────────────────────────────────────────
  // Drawn in array order; later regions paint over earlier ones.
  // RIVER REGIONS (terrainKind 'sea') share coordinates with collisionRects
  // below — same source of truth so visible water and blocked area match.
  regions: [
    // Western continent plains base (covers the entire west land mass)
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
      x: 120, y: 140, width: 1100, height: 360,
      terrainKind: 'forest',
    },
    // Mid grove near Lumen
    {
      id: 'lumen_grove',
      displayName: 'Lumen Grove',
      x: 1200, y: 540, width: 320, height: 260,
      terrainKind: 'forest',
    },
    // Southwest corrupted forest
    {
      id: 'thornwood_region',
      displayName: 'Thornwood',
      x: 120, y: 2200, width: 900, height: 600,
      terrainKind: 'corrupted_forest',
    },
    // Spine Mountains — north and south flanks
    {
      id: 'spine_mts_north',
      displayName: 'Spine Mountains',
      x: MTN_X, y: OUTER_OCEAN,
      width: MTN_W,
      height: PASS_Y_START - OUTER_OCEAN,
      terrainKind: 'mountain',
    },
    {
      id: 'spine_mts_south',
      displayName: 'Spine Mountains',
      x: MTN_X, y: PASS_Y_END,
      width: MTN_W,
      height: (MAP_H - OUTER_OCEAN) - PASS_Y_END,
      terrainKind: 'mountain',
    },

    // Verdant River — vertical strip with Bridgeford gap.
    // The polyline-style river in the previous map had collision drifting
    // far from the visible water; the river is now a single-source-of-truth
    // pair of rects matching the collisionRects below exactly.
    {
      id: 'verdant_river_n',
      displayName: 'Verdant River',
      x: VRIVER_X, y: OUTER_OCEAN,
      width: VRIVER_W,
      height: BRIDGEFORD_Y_START - OUTER_OCEAN,
      terrainKind: 'sea',
    },
    {
      id: 'verdant_river_s',
      displayName: 'Verdant River',
      x: VRIVER_X, y: BRIDGEFORD_Y_END,
      width: VRIVER_W,
      height: (MAP_H - OUTER_OCEAN) - BRIDGEFORD_Y_END,
      terrainKind: 'sea',
    },
    // Bridgeford bridge surface — rocky span between the two river halves.
    {
      id: 'verdant_bridge',
      displayName: 'Bridgeford',
      x: VRIVER_X, y: BRIDGEFORD_Y_START,
      width: VRIVER_W,
      height: BRIDGEFORD_Y_END - BRIDGEFORD_Y_START,
      terrainKind: 'rocky',
    },

    // ── Central sea islands ──
    { id: 'lighthouse_isle', displayName: 'Lighthouse Isle',
      x: 2480, y: 760,  width: 170, height: 140, terrainKind: 'sand' },
    { id: 'merchant_isle',   displayName: 'Merchant Isle',
      x: 2680, y: 1280, width: 220, height: 160, terrainKind: 'sand' },
    { id: 'storm_isle',      displayName: 'Storm Shrine Isle',
      x: 2820, y: 1880, width: 180, height: 150, terrainKind: 'rocky' },
    { id: 'ruin_isle',       displayName: 'Ruin Isle',
      x: 2520, y: 2220, width: 160, height: 110, terrainKind: 'sand' },

    // Eastern continent rocky base
    {
      id: 'greymarch_wilds',
      displayName: 'Greymarch Wilds',
      x: EAST_X_START, y: OUTER_OCEAN,
      width: EAST_X_END - EAST_X_START,
      height: MAP_H - OUTER_OCEAN * 2,
      terrainKind: 'rocky',
    },
    // Frontier dust band south of the river
    {
      id: 'eastern_dustlands',
      displayName: 'Greymarch Dustlands',
      x: 3200, y: 1700,
      width: IRIVER_X - 3200,
      height: MAP_H - 1700 - OUTER_OCEAN,
      terrainKind: 'dust',
    },
    // Ironflow River (eastern) — same single-source-of-truth pattern
    {
      id: 'ironflow_river_n',
      displayName: 'Ironflow River',
      x: IRIVER_X, y: OUTER_OCEAN,
      width: IRIVER_W,
      height: IBRIDGE_Y_START - OUTER_OCEAN,
      terrainKind: 'sea',
    },
    {
      id: 'ironflow_river_s',
      displayName: 'Ironflow River',
      x: IRIVER_X, y: IBRIDGE_Y_END,
      width: IRIVER_W,
      height: (MAP_H - OUTER_OCEAN) - IBRIDGE_Y_END,
      terrainKind: 'sea',
    },
    {
      id: 'iron_bridge',
      displayName: 'Iron Bridge',
      x: IRIVER_X, y: IBRIDGE_Y_START,
      width: IRIVER_W,
      height: IBRIDGE_Y_END - IBRIDGE_Y_START,
      terrainKind: 'rocky',
    },
    // Twilight Marches east of the river (paints over rocky base)
    {
      id: 'twilight_marches',
      displayName: 'Twilight Marches',
      x: IRIVER_X + IRIVER_W, y: OUTER_OCEAN,
      width: EAST_X_END - (IRIVER_X + IRIVER_W),
      height: MAP_H - OUTER_OCEAN * 2,
      terrainKind: 'dust',
    },
    // Black Reach corruption belt in the far east
    {
      id: 'black_reach',
      displayName: 'Black Reach',
      x: 4640, y: OUTER_OCEAN,
      width: EAST_X_END - 4640,
      height: 1100,
      terrainKind: 'blight',
    },
  ],

  // ── Roads ──────────────────────────────────────────────────────────────────
  // Western main road winds ~3000 px from Start Village to Lumen so the trip
  // takes ~20 seconds at PLAYER_SPEED=150. Then continues east through
  // Bridgeford → Mountain Pass → West Port.
  roads: [
    {
      id: 'west_main_road',
      width: 10,
      style: 'dirt',
      points: [
        // Start Village → Lumen south gate winds ~3000 px so a road-following
        // journey at PLAYER_SPEED=150 takes ~20 s, the JRPG travel feel.
        { x: 200, y: 2780 },   // Start Village
        { x: 340, y: 2660 },
        { x: 500, y: 2540 },
        { x: 660, y: 2400 },
        { x: 820, y: 2240 },
        { x: 940, y: 2060 },
        { x: 820, y: 1900 },   // bend west
        { x: 640, y: 1800 },
        { x: 480, y: 1700 },
        { x: 380, y: 1540 },
        { x: 480, y: 1400 },   // bend east
        { x: 640, y: 1320 },
        { x: 820, y: 1240 },
        { x: 1000, y: 1140 },
        { x: 1180, y: 1040 },
        { x: 1320, y: 940 },
        { x: 1320, y: 880 },   // Lumen south gate
        // From Lumen east through Bridgeford → Mountain Gate → West Port
        { x: 1400, y: 980 },
        { x: 1490, y: 1070 },  // Bridgeford crossing (in the bridge gap)
        { x: 1620, y: 1200 },
        { x: 1780, y: 1340 },
        { x: 1920, y: 1410 },  // into Mountain Pass
        { x: 2120, y: 1410 },  // out of Mountain Pass
        { x: 2240, y: 1600 },
        { x: 2280, y: 1840 },  // West Port
      ],
    },
    // Optional shrine branch in the far NW
    {
      id: 'west_shrine_branch',
      width: 8,
      style: 'dirt',
      points: [
        { x: 540, y: 1080 },
        { x: 360, y: 700 },
        { x: 280, y: 360 },
      ],
    },
    // Eastern main road
    {
      id: 'east_main_road',
      width: 10,
      style: 'dirt',
      points: [
        { x: 3320, y: 1520 },   // East Port (Ashenveil)
        { x: 3520, y: 1460 },
        { x: 3700, y: 1380 },
        { x: 3840, y: 1280 },
        { x: 3950, y: 1260 },   // bridge entry
        { x: 4050, y: 1260 },   // bridge exit
        { x: 4200, y: 1100 },
        { x: 4280, y: 800 },    // War Fortress
      ],
    },
    // East ruins branch
    {
      id: 'east_ruins_branch',
      width: 8,
      style: 'dirt',
      points: [
        { x: 4060, y: 1320 },
        { x: 4220, y: 1560 },
        { x: 4380, y: 1820 },   // Ancient Ruins
      ],
    },
    // Citadel stone road
    {
      id: 'citadel_road',
      width: 10,
      style: 'stone',
      points: [
        { x: 4280, y: 800 },
        { x: 4520, y: 540 },
        { x: 4800, y: 320 },    // Citadel
      ],
    },
  ],

  // No decorative river polylines — the verdant river is now driven entirely
  // by regions + collisionRects (see above) for fair, matching collision.

  // ── Landmarks ──────────────────────────────────────────────────────────────
  landmarks: [
    // Western continent
    { id: 'lm_start_village',  kind: 'village',  label: 'Start Village',
      x: 140, y: 2740, width: 130, height: 110 },
    { id: 'lm_forest_shrine',  kind: 'shrine',   label: 'Forest Shrine',
      x: 240, y: 300, width: 90,  height: 80 },
    { id: 'lm_lumen_capital',  kind: 'capital',  label: 'Lumen',
      x: 1230, y: 700, width: 180, height: 160 },
    // Bridgeford — sits ON the bridge gap (y:1000-1140). Future quest hook:
    // repair the bridge, help the village, recruit a river scout / bridge
    // guard / healer, then unlock additional crossings.
    { id: 'lm_bridgeford',     kind: 'village',  label: 'Bridgeford',
      x: 1390, y: 990, width: 200, height: 160 },
    { id: 'lm_mountain_gate',  kind: 'gate',     label: 'Mountain Gate',
      x: 1900, y: 1340, width: 220, height: 160 },
    { id: 'lm_west_port',      kind: 'port',     label: 'West Port',
      x: 2220, y: 1800, width: 140, height: 110 },

    // Central sea islands
    { id: 'lm_lighthouse',     kind: 'island',   label: 'Lighthouse',
      x: 2490, y: 780, width: 130, height: 90 },
    { id: 'lm_merchant_isle',  kind: 'island',   label: 'Merchant Isle',
      x: 2700, y: 1300, width: 170, height: 110 },
    { id: 'lm_storm_shrine',   kind: 'island',   label: 'Storm Shrine',
      x: 2830, y: 1900, width: 130, height: 100 },
    { id: 'lm_ruin_isle',      kind: 'island',   label: 'Ruin Isle',
      x: 2540, y: 2240, width: 120, height: 80 },

    // Eastern continent
    { id: 'lm_east_port',      kind: 'port',     label: 'East Port (Ashenveil)',
      x: 3280, y: 1500, width: 140, height: 110 },
    { id: 'lm_frontier_town',  kind: 'town',     label: 'Frontier Town',
      x: 3580, y: 1390, width: 120, height: 100 },
    { id: 'lm_river_city',     kind: 'gate',     label: 'River City',
      x: 3800, y: 1180, width: 150, height: 120 },
    { id: 'lm_ancient_ruins',  kind: 'ruin',     label: 'Ancient Ruins',
      x: 4320, y: 1780, width: 130, height: 100 },
    { id: 'lm_war_fortress',   kind: 'fortress', label: 'War Fortress',
      x: 4220, y: 720, width: 150, height: 130 },
    { id: 'lm_dark_citadel',   kind: 'citadel',  label: 'Dark Citadel',
      x: 4760, y: 280, width: 170, height: 150 },
  ],

  // ── Solid obstacles ────────────────────────────────────────────────────────
  // River and mountain collision coordinates MATCH the matching regions above
  // so visible water/wall and the invisible block line up to the pixel.
  collisionRects: [
    // Outer ocean rim — full-map border the player cannot cross
    { x: 0,           y: 0,                    width: MAP_W,                  height: OUTER_OCEAN },
    { x: 0,           y: MAP_H - OUTER_OCEAN,  width: MAP_W,                  height: OUTER_OCEAN },
    { x: 0,           y: 0,                    width: WEST_X_START,           height: MAP_H },
    { x: EAST_X_END,  y: 0,                    width: MAP_W - EAST_X_END,     height: MAP_H },

    // Central sea — entire band between continents
    { x: SEA_X_START, y: 0,
      width: SEA_X_END - SEA_X_START, height: MAP_H },

    // Spine Mountains — matches spine_mts_* regions
    { x: MTN_X, y: 0,
      width: MTN_W, height: PASS_Y_START },
    { x: MTN_X, y: PASS_Y_END,
      width: MTN_W, height: MAP_H - PASS_Y_END },

    // Verdant River — matches verdant_river_* regions (NOT verdant_bridge,
    // which is the walkable rocky span across the gap)
    { x: VRIVER_X, y: 0,
      width: VRIVER_W, height: BRIDGEFORD_Y_START },
    { x: VRIVER_X, y: BRIDGEFORD_Y_END,
      width: VRIVER_W, height: MAP_H - BRIDGEFORD_Y_END },

    // Ironflow River — matches ironflow_river_* regions (NOT iron_bridge)
    { x: IRIVER_X, y: 0,
      width: IRIVER_W, height: IBRIDGE_Y_START },
    { x: IRIVER_X, y: IBRIDGE_Y_END,
      width: IRIVER_W, height: MAP_H - IBRIDGE_Y_END },
  ],

  // ── Scene transition triggers ──────────────────────────────────────────────
  triggers: [
    // Lumen capital entrance — south gate, on the road
    {
      id: 'lumen_town_entrance',
      x: 1280, y: 840, width: 90, height: 110,
      label: 'Enter Lumen',
      targetSceneKey: 'TownScene',
      targetLocationId: 'lumen_town',
    },
    // Mountain Pass boss — flag-gated by SERELLE_JOINED, consumed by win
    {
      id: 'mountain_pass_boss',
      x: 1990, y: 1380, width: 140, height: 130,
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
      x: 3280, y: 1500, width: 140, height: 110,
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
      x: 100, y: 2180, width: 940, height: 640,
    },
    {
      id: 'mountain_pass_zone',
      displayName: 'Mountain Pass',
      type: 'encounter',
      x: 1800, y: 1280, width: 440, height: 240,
    },
    {
      id: 'western_forest_zone',
      displayName: 'Evergreen Woods',
      type: 'encounter',
      x: 100, y: 60, width: 1140, height: 440,
    },
    {
      id: 'eastern_frontier_zone',
      displayName: 'Greymarch Frontier',
      type: 'encounter',
      x: EAST_X_START, y: 1400, width: IRIVER_X - EAST_X_START, height: 1420,
    },
    {
      id: 'eastern_warfields_zone',
      displayName: 'Twilight Marches',
      type: 'encounter',
      x: IRIVER_X + IRIVER_W, y: 60, width: 640, height: 2760,
    },
    {
      id: 'blightlands_zone',
      displayName: 'Black Reach',
      type: 'encounter',
      x: 4640, y: 60, width: EAST_X_END - 4640, height: 1140,
    },
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
      toX: 3280, toY: 1540,
      requiresFlag: STORY_FLAGS.CHAPTER_3_SEA_TRAVEL_UNLOCKED,
    },
    {
      id: 'ferry_east_to_west',
      fromTriggerId: 'east_port_ferry',
      toX: 2240, toY: 1820,
      requiresFlag: STORY_FLAGS.CHAPTER_3_SEA_TRAVEL_UNLOCKED,
    },
  ],

  fastTravelNodes: [],
};
