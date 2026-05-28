// src/game/data/maps/elerion-world-config.ts
//
// Layout configuration for the world of Elerion (5120 × 2880).
// Canonical-name aligned: visible labels follow the reference image at
// docs/reference/world-map-overview.png; see docs/world-map-canon.md for
// the canonical place-names table.
//
// IMPORTANT: technical ids (e.g. `lumen_town`, `lm_start_village`,
// `vergant_fields`) are kept stable even though their visible names have
// been replaced with canon names. Don't rename ids without a SAVE_VERSION
// bump and a full audit.
//
// Western continent layout (canonical names):
//   - Frostnorth Tundra band along the very top (snow strip).
//   - Silverwall Mountains form the horizontal top barrier, split by a
//     north-south Northwind Pass at x:1100-1300. Stonegate sits at the
//     pass. The NW snow cluster (`northwind_peaks`) is part of the
//     Silverwall range; its label is hidden as a sub-cluster.
//   - Everdawn Forest mid-west, threaded by the main road.
//   - Verdant River runs N→S with a gentle bend south of the Bridgeford
//     bridge (the river crossing at Riverdale, east of Eldric).
//   - Dawnkeep (start village) deep SW.
//   - Eldric — the central capital, west of the river.
//   - Harborwatch on the SE coast of the western continent.
//   - Highland Ruins on the west coast, Light's Sanctuary mid-south.
//
// Central sea: structurally five island placeholders distributed N→S.
// Visible canon labels: Whisper Isle, Tempest Isles, Saint's Isle.
// The two non-canon island placeholders (`lighthouse_isle`, `merchant_atoll`)
// keep their geometry but their labels are hidden — reserved for future
// side content.
//
// Eastern continent layout (canonical names):
//   - Dreadshore on the west coast (arrival port).
//   - Riverrun at the Ironflow River crossing (Iron Bridge).
//   - Warfortress beyond the river.
//   - Twilight Grove — eastern dark/corrupted forest.
//   - Greymarsh Wilds — broader eastern wild region (base terrain).
//   - Black Citadel in the far NE.
//
// Collision invariants (single source of truth — visible water/wall = block):
//   - River regions (terrainKind 'sea') and their matching collisionRects
//     share coordinates exactly. The Bridgeford / Iron Bridge gaps have
//     no collision and are painted as walkable rocky spans.
//   - Mountain regions and their matching collisionRects share coords.
//
// Travel chokepoints:
//   - Bridgeford bridge (Verdant River, x:1400-1480, gap y:1040-1180).
//   - Iron Bridge (Ironflow River, x:3900-4000, gap y:1200-1320).
//   - Northwind Pass (Silverwall Mts top band, gap x:1100-1300, y:280-500).
//   - Central Sea (x:2300-3200) blocks all foot travel between continents.
//
// TODO: story/quest triggers will be redesigned later. The old 'Investigate
// Clearing' (Grove Warden) trigger is disabled. Enemy + dialogue data remain
// available for the next quest design.

import type { WorldMapConfig } from '../../world/types/world-types';
import { STORY_FLAGS } from '../story/story-events';

// ─── Map dimensions and continental partitioning ──────────────────────────────

const MAP_W = 5120;
const MAP_H = 2880;

const OUTER_OCEAN  = 60;
const WEST_X_START = 80;
const WEST_X_END   = 2300;            // western continent x: 80–2300
const SEA_X_START  = 2300;
const SEA_X_END    = 3200;            // central sea x: 2300–3200
const EAST_X_START = 3200;
const EAST_X_END   = 5040;            // eastern continent x: 3200–5040

// Frostnorth Tundra strip (top, full western continent)
const TUNDRA_Y_START = OUTER_OCEAN;
const TUNDRA_Y_END   = 280;

// Silverwall Mountains — horizontal top band, with Northwind Pass through it.
const MTN_BAND_Y_START = TUNDRA_Y_END;     // 280
const MTN_BAND_Y_END   = 500;
const PASS_X_START     = 1100;
const PASS_X_END       = 1300;
// Northwind Peaks NW sub-cluster of Silverwall (west of the pass, extends below the top band)
const NORTHWIND_X      = 120;
const NORTHWIND_Y      = MTN_BAND_Y_START;
const NORTHWIND_W      = 580;
const NORTHWIND_H      = 420;

// Verdant River — vertical N→S strip with Bridgeford gap and a small bend
// south of the bridge so the river isn't a perfect rectangle.
const VRIVER_X            = 1400;
const VRIVER_W            = 80;
const BRIDGEFORD_Y_START  = 1040;
const BRIDGEFORD_Y_END    = 1180;
const VRIVER_BEND_Y_START = 2040;
const VRIVER_BEND_Y_END   = 2120;
const VRIVER_SOUTH_X      = 1320;          // river shifts west after the bend
const VRIVER_BEND_X       = 1320;          // bend connector spans 1320–1480
const VRIVER_BEND_W       = 160;

// Ironflow River chokepoint (eastern continent)
const IRIVER_X          = 3900;
const IRIVER_W          = 100;
const IBRIDGE_Y_START   = 1200;
const IBRIDGE_Y_END     = 1320;

// ─── Configuration ────────────────────────────────────────────────────────────

export const ELERION_WORLD_CONFIG: WorldMapConfig = {
  mapWidth:  MAP_W,
  mapHeight: MAP_H,

  // Dawnkeep (start village) in the SW corner. Spawn just north of the
  // corrupted-forest edge so the game opens in a safe area.
  playerStartX: 220,
  playerStartY: 2740,

  // ── Regions ────────────────────────────────────────────────────────────────
  // Painted in array order; later regions paint over earlier ones.
  // River and mountain regions share coordinates with collisionRects below.
  regions: [
    // Western continent plains base
    {
      id: 'vergant_fields',
      displayName: 'Verdant Fields',
      x: WEST_X_START, y: OUTER_OCEAN,
      width: WEST_X_END - WEST_X_START,
      height: MAP_H - OUTER_OCEAN * 2,
      terrainKind: 'plains',
    },
    // Frostnorth Tundra snow band along the top
    {
      id: 'northern_tundra',
      displayName: 'Frostnorth Tundra',
      x: WEST_X_START, y: TUNDRA_Y_START,
      width: WEST_X_END - WEST_X_START,
      height: TUNDRA_Y_END - TUNDRA_Y_START,
      terrainKind: 'snow',
    },
    // Northwind Peaks — NW snowy sub-cluster of Silverwall Mountains
    {
      id: 'northwind_peaks',
      displayName: '',
      x: NORTHWIND_X, y: NORTHWIND_Y,
      width: NORTHWIND_W, height: NORTHWIND_H,
      terrainKind: 'mountain',
    },
    // Silverwall Mountains — top band west of the pass
    {
      id: 'spine_band_west',
      displayName: 'Silverwall Mountains',
      x: NORTHWIND_X + NORTHWIND_W, y: MTN_BAND_Y_START,
      width: PASS_X_START - (NORTHWIND_X + NORTHWIND_W),
      height: MTN_BAND_Y_END - MTN_BAND_Y_START,
      terrainKind: 'mountain',
    },
    // Silverwall Mountains — top band east of the pass
    {
      id: 'spine_band_east',
      displayName: 'Silverwall Mountains',
      x: PASS_X_END, y: MTN_BAND_Y_START,
      width: WEST_X_END - PASS_X_END - 100,   // leaves a coastal sliver
      height: MTN_BAND_Y_END - MTN_BAND_Y_START,
      terrainKind: 'mountain',
    },

    // Western forests
    {
      id: 'evergreen_forest',
      displayName: 'Everdawn Forest',
      x: 200, y: 800, width: 620, height: 540,
      terrainKind: 'forest',
    },
    {
      id: 'lumen_grove',
      displayName: '',
      x: 780, y: 1300, width: 340, height: 260,
      terrainKind: 'forest',
    },
    {
      id: 'thornwood_region',
      displayName: '',
      x: 120, y: 2300, width: 920, height: 540,
      terrainKind: 'corrupted_forest',
    },

    // ── Verdant River — five segments (with one bend south of Bridgeford) ──
    // North half (top of map to Bridgeford gap)
    {
      id: 'verdant_river_n',
      displayName: 'Verdant River',
      x: VRIVER_X, y: 0,
      width: VRIVER_W, height: BRIDGEFORD_Y_START,
      terrainKind: 'sea',
    },
    // Bridgeford bridge surface (walkable rocky span across the gap)
    {
      id: 'verdant_bridge',
      displayName: 'Bridgeford',
      x: VRIVER_X, y: BRIDGEFORD_Y_START,
      width: VRIVER_W,
      height: BRIDGEFORD_Y_END - BRIDGEFORD_Y_START,
      terrainKind: 'rocky',
    },
    // South-upper segment (Bridgeford to bend)
    {
      id: 'verdant_river_s1',
      displayName: 'Verdant River',
      x: VRIVER_X, y: BRIDGEFORD_Y_END,
      width: VRIVER_W,
      height: VRIVER_BEND_Y_START - BRIDGEFORD_Y_END,
      terrainKind: 'sea',
    },
    // Bend connector — horizontal stretch where the river shifts west
    {
      id: 'verdant_river_bend',
      displayName: 'Verdant River',
      x: VRIVER_BEND_X, y: VRIVER_BEND_Y_START,
      width: VRIVER_BEND_W,
      height: VRIVER_BEND_Y_END - VRIVER_BEND_Y_START,
      terrainKind: 'sea',
    },
    // South-lower segment (post-bend, shifted west)
    {
      id: 'verdant_river_s2',
      displayName: 'Verdant River',
      x: VRIVER_SOUTH_X, y: VRIVER_BEND_Y_END,
      width: VRIVER_W,
      height: MAP_H - VRIVER_BEND_Y_END,
      terrainKind: 'sea',
    },

    // ── Central sea islands (5 distributed N→S to match reference) ──
    { id: 'whisper_isle',    displayName: 'Whisper Isle',
      x: 2460, y: 380,  width: 160, height: 110, terrainKind: 'sand' },
    { id: 'lighthouse_isle', displayName: 'Lighthouse Isle',
      x: 2700, y: 840,  width: 140, height: 110, terrainKind: 'sand' },
    { id: 'merchant_atoll',  displayName: 'Merchant Atoll',
      x: 2460, y: 1320, width: 220, height: 160, terrainKind: 'sand' },
    { id: 'storm_isle',      displayName: 'Saint’s Isle',
      x: 2760, y: 1820, width: 180, height: 140, terrainKind: 'rocky' },
    { id: 'tempest_spire',   displayName: 'Tempest Isles',
      x: 2480, y: 2280, width: 160, height: 120, terrainKind: 'sand' },

    // Eastern continent rocky base
    {
      id: 'greymarch_wilds',
      displayName: 'Greymarsh Wilds',
      x: EAST_X_START, y: OUTER_OCEAN,
      width: EAST_X_END - EAST_X_START,
      height: MAP_H - OUTER_OCEAN * 2,
      terrainKind: 'rocky',
    },
    // Frontier dust band south of the river
    {
      id: 'eastern_dustlands',
      displayName: '',
      x: EAST_X_START, y: 1700,
      width: IRIVER_X - EAST_X_START,
      height: MAP_H - 1700 - OUTER_OCEAN,
      terrainKind: 'dust',
    },
    // Ironflow River (eastern) — same single-source-of-truth pattern
    {
      id: 'ironflow_river_n',
      displayName: '',
      x: IRIVER_X, y: OUTER_OCEAN,
      width: IRIVER_W,
      height: IBRIDGE_Y_START - OUTER_OCEAN,
      terrainKind: 'sea',
    },
    {
      id: 'ironflow_river_s',
      displayName: '',
      x: IRIVER_X, y: IBRIDGE_Y_END,
      width: IRIVER_W,
      height: (MAP_H - OUTER_OCEAN) - IBRIDGE_Y_END,
      terrainKind: 'sea',
    },
    {
      id: 'iron_bridge',
      displayName: '',
      x: IRIVER_X, y: IBRIDGE_Y_START,
      width: IRIVER_W,
      height: IBRIDGE_Y_END - IBRIDGE_Y_START,
      terrainKind: 'rocky',
    },
    // Twilight Marches east of the river
    {
      id: 'twilight_marches',
      displayName: '',
      x: IRIVER_X + IRIVER_W, y: OUTER_OCEAN,
      width: EAST_X_END - (IRIVER_X + IRIVER_W),
      height: MAP_H - OUTER_OCEAN * 2,
      terrainKind: 'dust',
    },
    // Twilight Grove (eastern dark forest) south-central
    {
      id: 'blackwoods',
      displayName: 'Twilight Grove',
      x: 4040, y: 1800, width: 540, height: 460,
      terrainKind: 'corrupted_forest',
    },
    // Black Reach corruption belt — far NE
    {
      id: 'black_reach',
      displayName: '',
      x: 4620, y: OUTER_OCEAN,
      width: EAST_X_END - 4620,
      height: 1100,
      terrainKind: 'blight',
    },
  ],

  // ── Roads ──────────────────────────────────────────────────────────────────
  roads: [
    // West main road: Dawnkeep → Eldric south gate (~3300 px @ 150 px/s ≈ 22s)
    {
      id: 'west_main_road',
      width: 10,
      style: 'dirt',
      points: [
        { x: 200, y: 2780 },    // Dawnkeep
        { x: 340, y: 2680 },
        { x: 520, y: 2580 },
        { x: 680, y: 2460 },
        { x: 840, y: 2320 },
        { x: 920, y: 2140 },
        { x: 820, y: 1960 },    // bend west
        { x: 660, y: 1820 },
        { x: 500, y: 1720 },
        { x: 380, y: 1560 },
        { x: 320, y: 1380 },    // climbing through Evergreen edge
        { x: 380, y: 1200 },
        { x: 520, y: 1080 },
        { x: 680, y:  990 },
        { x: 860, y:  920 },
        { x: 1080, y: 880 },    // Eldric south gate
        // Eldric → Riverdale (Bridgeford bridge) → Stonegate region
        { x: 1240, y: 1000 },
        { x: 1380, y: 1080 },
        { x: 1480, y: 1100 },   // Bridgeford bridge crossing
        { x: 1640, y: 1200 },
        { x: 1820, y: 1380 },
        { x: 2000, y: 1580 },
        { x: 2120, y: 1820 },   // Harborwatch
      ],
    },
    // North branch from Eldric up through the Northwind Pass to Frostnorth Tundra
    {
      id: 'mountain_pass_road',
      width: 8,
      style: 'dirt',
      points: [
        { x: 1080, y: 880 },    // Eldric north
        { x: 1120, y: 660 },
        { x: 1180, y: 500 },    // pass entry
        { x: 1180, y: 380 },    // Stonegate
        { x: 1180, y: 200 },    // into Frostnorth Tundra
      ],
    },
    // Western shrine branch (reserved side-content; landmark label hidden)
    {
      id: 'west_shrine_branch',
      width: 8,
      style: 'dirt',
      points: [
        { x: 420, y: 1180 },
        { x: 380, y:  920 },
        { x: 380, y:  720 },
      ],
    },
    // Eastern main road (unchanged shape, just preserved)
    {
      id: 'east_main_road',
      width: 10,
      style: 'dirt',
      points: [
        { x: 3320, y: 1520 },   // Dreadshore
        { x: 3520, y: 1460 },
        { x: 3700, y: 1380 },
        { x: 3840, y: 1280 },
        { x: 3950, y: 1260 },   // bridge entry
        { x: 4050, y: 1260 },   // bridge exit
        { x: 4200, y: 1100 },
        { x: 4280, y: 800 },    // Warfortress
      ],
    },
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

  // ── Landmarks (visual + label, no collision; triggers below for entries) ───
  landmarks: [
    // Western continent
    { id: 'lm_start_village',   kind: 'village',  label: 'Dawnkeep',
      x: 140, y: 2740, width: 130, height: 110 },
    { id: 'lm_highland_ruins',  kind: 'ruin',     label: 'Highland Ruins',
      x: 140, y: 1660, width: 110, height: 90 },
    { id: 'lm_forest_shrine',   kind: 'shrine',   label: '',
      x: 320, y: 660,  width: 110, height: 90 },
    { id: 'lm_lumen_capital',   kind: 'capital',  label: 'Eldric',
      x: 1000, y: 720, width: 180, height: 160 },
    { id: 'lm_saints_sanctuary',kind: 'shrine',   label: 'Light’s Sanctuary',
      x: 880, y: 2440, width: 130, height: 110 },
    { id: 'lm_bridgeford',      kind: 'village',  label: 'Riverdale',
      x: 1390, y: 1020, width: 200, height: 160 },
    { id: 'lm_mountain_gate',   kind: 'gate',     label: 'Stonegate',
      x: 1100, y: 300,  width: 200, height: 200 },
    { id: 'lm_west_port',       kind: 'port',     label: 'Harborwatch',
      x: 2080, y: 1800, width: 140, height: 120 },

    // Central sea islands
    { id: 'lm_whisper',     kind: 'island',  label: 'Whisper Isle',
      x: 2470, y: 400,  width: 130, height: 90 },
    { id: 'lm_lighthouse',  kind: 'island',  label: '',
      x: 2710, y: 860,  width: 120, height: 90 },
    { id: 'lm_merchant',    kind: 'island',  label: '',
      x: 2490, y: 1340, width: 170, height: 130 },
    { id: 'lm_storm',       kind: 'island',  label: 'Saint’s Isle',
      x: 2780, y: 1840, width: 130, height: 110 },
    { id: 'lm_tempest',     kind: 'island',  label: 'Tempest Isles',
      x: 2500, y: 2300, width: 120, height: 100 },

    // Eastern continent
    { id: 'lm_east_port',      kind: 'port',     label: 'Dreadshore',
      x: 3280, y: 1500, width: 140, height: 110 },
    { id: 'lm_frontier_town',  kind: 'town',     label: '',
      x: 3580, y: 1380, width: 120, height: 100 },
    { id: 'lm_river_city',     kind: 'gate',     label: 'Riverrun',
      x: 3800, y: 1180, width: 150, height: 120 },
    { id: 'lm_ancient_ruins',  kind: 'ruin',     label: '',
      x: 4320, y: 1780, width: 130, height: 100 },
    { id: 'lm_war_fortress',   kind: 'fortress', label: 'Warfortress',
      x: 4220, y: 720,  width: 150, height: 130 },
    { id: 'lm_dark_citadel',   kind: 'citadel',  label: 'Black Citadel',
      x: 4760, y: 280,  width: 170, height: 150 },
  ],

  // ── Solid obstacles ────────────────────────────────────────────────────────
  // River and mountain coords match regions above (single source of truth).
  collisionRects: [
    // Outer ocean rim
    { x: 0,           y: 0,                    width: MAP_W,                  height: OUTER_OCEAN },
    { x: 0,           y: MAP_H - OUTER_OCEAN,  width: MAP_W,                  height: OUTER_OCEAN },
    { x: 0,           y: 0,                    width: WEST_X_START,           height: MAP_H },
    { x: EAST_X_END,  y: 0,                    width: MAP_W - EAST_X_END,     height: MAP_H },

    // Central sea — entire band between continents
    { x: SEA_X_START, y: 0,
      width: SEA_X_END - SEA_X_START, height: MAP_H },

    // Northwind Peaks (matches region)
    { x: NORTHWIND_X, y: NORTHWIND_Y,
      width: NORTHWIND_W, height: NORTHWIND_H },
    // Silverwall Mountains top band — west of pass (matches region)
    { x: NORTHWIND_X + NORTHWIND_W, y: MTN_BAND_Y_START,
      width: PASS_X_START - (NORTHWIND_X + NORTHWIND_W),
      height: MTN_BAND_Y_END - MTN_BAND_Y_START },
    // Silverwall Mountains top band — east of pass (matches region)
    { x: PASS_X_END, y: MTN_BAND_Y_START,
      width: WEST_X_END - PASS_X_END - 100,
      height: MTN_BAND_Y_END - MTN_BAND_Y_START },

    // Verdant River — 4 collision rects matching the 4 river regions
    // (NOT the bridge, which is walkable rocky terrain)
    // North half
    { x: VRIVER_X, y: 0,
      width: VRIVER_W, height: BRIDGEFORD_Y_START },
    // South-upper (Bridgeford to bend)
    { x: VRIVER_X, y: BRIDGEFORD_Y_END,
      width: VRIVER_W, height: VRIVER_BEND_Y_START - BRIDGEFORD_Y_END },
    // Bend connector
    { x: VRIVER_BEND_X, y: VRIVER_BEND_Y_START,
      width: VRIVER_BEND_W, height: VRIVER_BEND_Y_END - VRIVER_BEND_Y_START },
    // South-lower (post-bend, shifted west)
    { x: VRIVER_SOUTH_X, y: VRIVER_BEND_Y_END,
      width: VRIVER_W, height: MAP_H - VRIVER_BEND_Y_END },

    // Ironflow River — matches regions (NOT iron_bridge)
    { x: IRIVER_X, y: 0,
      width: IRIVER_W, height: IBRIDGE_Y_START },
    { x: IRIVER_X, y: IBRIDGE_Y_END,
      width: IRIVER_W, height: MAP_H - IBRIDGE_Y_END },
  ],

  // ── Scene transition triggers ──────────────────────────────────────────────
  triggers: [
    // Lumen capital entrance — south gate
    {
      id: 'lumen_town_entrance',
      x: 1060, y: 870, width: 90, height: 110,
      label: 'Enter Eldric',
      targetSceneKey: 'TownScene',
      targetLocationId: 'lumen_town',
    },
    // Mountain Pass boss (Shadecaster Veyr) — flag-gated by SERELLE_JOINED
    {
      id: 'mountain_pass_boss',
      x: 1140, y: 360, width: 140, height: 130,
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
    // East Port — Ashenveil town entrance
    {
      id: 'east_port_entrance',
      x: 3280, y: 1500, width: 140, height: 110,
      label: 'Enter Dreadshore',
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
      x: 100, y: 2280, width: 960, height: 580,
    },
    {
      id: 'mountain_pass_zone',
      displayName: 'Northwind Pass',
      type: 'encounter',
      x: 1060, y: 280, width: 280, height: 440,
    },
    {
      id: 'western_forest_zone',
      displayName: 'Everdawn Forest',
      type: 'encounter',
      x: 180, y: 780, width: 660, height: 560,
    },
    {
      id: 'northern_tundra_zone',
      displayName: 'Frostnorth Tundra',
      type: 'encounter',
      x: 80, y: 60, width: WEST_X_END - 80, height: TUNDRA_Y_END - 60,
    },
    {
      id: 'eastern_frontier_zone',
      displayName: 'Greymarsh Frontier',
      type: 'encounter',
      x: EAST_X_START, y: 1400, width: IRIVER_X - EAST_X_START, height: 1420,
    },
    {
      id: 'eastern_warfields_zone',
      displayName: 'Twilight Grove',
      type: 'encounter',
      x: IRIVER_X + IRIVER_W, y: 60, width: 620, height: 2760,
    },
    {
      id: 'blightlands_zone',
      displayName: 'Black Reach',
      type: 'encounter',
      x: 4620, y: 60, width: EAST_X_END - 4620, height: 1140,
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
      toX: 2080, toY: 1820,
      requiresFlag: STORY_FLAGS.CHAPTER_3_SEA_TRAVEL_UNLOCKED,
    },
  ],

  fastTravelNodes: [],
};
