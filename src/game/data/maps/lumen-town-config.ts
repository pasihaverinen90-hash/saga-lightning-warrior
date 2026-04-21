// src/game/data/maps/lumen-town-config.ts
// Lumen City — large walled capital, 2800 × 2400 world-space.
//
// District columns:
//   LEFT WALL │ outer-W │ W-road │ inner-W │ AVENUE │ inner-E │ E-road │ outer-E │ RIGHT WALL
//   x=0–100   │ 100–660 │660–740 │ 740–1220│1220–1580│1580–2060│2060–2140│2140–2700│ 2700–2800
//
// Row bands (top → bottom):
//   y=0        ████████████████████████████████████  top wall
//   y=80       [outer-W fl.1] [VAUN MANSION] [outer-E fl.1]   (mansion flanks row 1)
//   y=250      [outer-W fl.2]                [outer-E fl.2]   (mansion flanks row 2)
//   y=420      [NW block] [inner-W blk] [forecourt] [inner-E blk] [NE block]
//   y=600      ═══════════════ upper cross-alley (y 620–670) ═══════════════
//   y=720      [outer-W B] [inner-W B]  [SHOP]  [inner-E B]  [outer-E B]  [CITY HALL]
//   y=944      ──────────────────────────────────────────────────────────
//   y=1000     [W-lower]                                       [E-lower]
//   y=1120     ═══════════════ lower cross-alley (y 1150–1200) ══════════════
//   y=1215     [outer-W C] [inner-W C wide] [avenue] [inner-E C wide] [outer-E C]
//   y=1325     ──────────────────────────────────────────────────────────
//   y=1360     ════════════════ main east–west cross street ════════════
//   y=1440     ─────────────────────────────────────────────────────────
//   y=1460     [SW row]                                        [SE row] [outer-E D1]
//   y=1600     ──────────────────────────────────────────────────────────
//   y=1640     [INN]                                           [outer-E D2]
//   y=2160     [sign]  ·  ·  ·  ·  [guard]
//   y=2320     ████ south wall ██ [SOUTH GATE] ██ south wall ████
//   y=2400

import type { TownMapConfig } from '../../town/types/town-types';
import { STORY_FLAGS } from '../story/story-events';

export const LUMEN_TOWN_CONFIG: TownMapConfig = {
  displayName:  'Lumen City',
  mapWidth:  2800,
  mapHeight: 2400,

  playerEntryX: 1372,
  playerEntryY: 2250,

  // ── Collision rectangles ─────────────────────────────────────────────────────
  collisionRects: [
    // ── Perimeter ────────────────────────────────────────────────────────────
    { x:    0, y:    0, width: 2800, height:   80 },  // top wall
    { x:    0, y:    0, width:  100, height: 2400 },  // left wall
    { x: 2700, y:    0, width:  100, height: 2400 },  // right wall

    // ── Landmark ─────────────────────────────────────────────────────────────
    { x:  700, y:   80, width: 1400, height:  340 },  // Vaun Mansion

    // ── Active buildings ─────────────────────────────────────────────────────
    { x:  160, y:  720, width:  240, height:  224 },  // Item Shop (west)
    { x: 2360, y:  720, width:  240, height:  224 },  // City Hall (east)
    { x:  160, y: 1640, width:  240, height:  224 },  // Inn (south-west)

    // ── South boundary with gate gap (x 1220–1580) ───────────────────────────
    { x:    0, y: 2320, width: 1220, height:   80 },  // south-left wall
    { x: 1580, y: 2320, width: 1220, height:   80 },  // south-right wall

    // ── Zone A: Mansion left flank (y 100–420) ───────────────────────────────
    { x:  110, y:  100, width:  160, height:  150 },
    { x:  280, y:  100, width:  150, height:  150 },
    { x:  445, y:  100, width:  185, height:  150 },
    { x:  110, y:  270, width:  160, height:  120 },
    { x:  280, y:  270, width:  150, height:  120 },
    { x:  445, y:  270, width:  185, height:  120 },

    // ── Zone A: Mansion right flank (y 100–420) ──────────────────────────────
    { x: 2150, y:  100, width:  160, height:  150 },
    { x: 2325, y:  100, width:  150, height:  150 },
    { x: 2490, y:  100, width:  175, height:  150 },
    { x: 2150, y:  270, width:  160, height:  120 },
    { x: 2325, y:  270, width:  150, height:  120 },
    { x: 2490, y:  270, width:  175, height:  120 },

    // ── Existing upper blocks (y 440–620) ────────────────────────────────────
    { x:  120, y:  440, width:  140, height:  160 },  // NW block
    { x:  280, y:  440, width:  140, height:  160 },
    { x:  440, y:  440, width:  180, height:  160 },
    { x:  760, y:  440, width:  140, height:  180 },  // inner-W block
    { x:  920, y:  440, width:  140, height:  180 },
    { x: 1060, y:  440, width:  140, height:  180 },
    { x: 1600, y:  440, width:  140, height:  180 },  // inner-E block
    { x: 1760, y:  440, width:  140, height:  180 },
    { x: 1900, y:  440, width:  130, height:  180 },
    { x: 2160, y:  440, width:  140, height:  160 },  // NE block
    { x: 2320, y:  440, width:  140, height:  160 },
    { x: 2480, y:  440, width:  160, height:  160 },

    // ── Zone B: Active-building band (y 720–944) ─────────────────────────────
    { x:  415, y:  720, width:  115, height:  224 },  // outer-W beside Shop
    { x:  545, y:  720, width:  105, height:  224 },
    { x: 2150, y:  720, width:  100, height:  224 },  // outer-E beside City Hall
    { x: 2260, y:  720, width:   90, height:  224 },
    { x:  755, y:  720, width:  140, height:  224 },  // inner-W band
    { x:  908, y:  720, width:  140, height:  224 },
    { x: 1062, y:  720, width:  140, height:  224 },
    { x: 1595, y:  720, width:  140, height:  224 },  // inner-E band
    { x: 1748, y:  720, width:  140, height:  224 },
    { x: 1902, y:  720, width:  140, height:  224 },

    // ── Existing lower blocks (y 1000–1120) ──────────────────────────────────
    { x:  120, y: 1000, width:  130, height:  120 },  // west-lower block
    { x:  270, y: 1000, width:  130, height:  120 },
    { x:  420, y: 1000, width:  200, height:  120 },
    { x: 2160, y: 1000, width:  120, height:  120 },  // east-lower block
    { x: 2300, y: 1000, width:  130, height:  120 },
    { x: 2450, y: 1000, width:  210, height:  120 },

    // ── Zone C: Mid-city band (y 1215–1325) ──────────────────────────────────
    { x:  110, y: 1215, width:  155, height:  110 },  // outer-W
    { x:  278, y: 1215, width:  145, height:  110 },
    { x:  438, y: 1215, width:  195, height:  110 },
    { x:  750, y: 1215, width:  210, height:  110 },  // inner-W wide halls
    { x:  975, y: 1215, width:  210, height:  110 },
    { x: 1590, y: 1215, width:  215, height:  110 },  // inner-E wide halls
    { x: 1820, y: 1215, width:  215, height:  110 },
    { x: 2150, y: 1215, width:  155, height:  110 },  // outer-E
    { x: 2318, y: 1215, width:  155, height:  110 },
    { x: 2488, y: 1215, width:  172, height:  110 },

    // ── Existing south rows (y 1460–1590) ────────────────────────────────────
    { x:  420, y: 1460, width:  100, height:  130 },  // SW row
    { x:  540, y: 1460, width:  100, height:  130 },
    { x: 1800, y: 1460, width:  100, height:  130 },  // SE row
    { x: 1920, y: 1460, width:  120, height:  130 },

    // ── Zone D: Outer-E south rows (y 1470–1800) ─────────────────────────────
    { x: 2150, y: 1470, width:  155, height:  130 },
    { x: 2318, y: 1470, width:  145, height:  130 },
    { x: 2478, y: 1470, width:  182, height:  130 },
    { x: 2150, y: 1650, width:  155, height:  150 },
    { x: 2318, y: 1650, width:  145, height:  150 },
    { x: 2478, y: 1650, width:  182, height:  150 },
  ],

  // ── Interactables ─────────────────────────────────────────────────────────────
  interactables: [
    {
      id: 'inn_entrance', type: 'building_inn',
      x: 280, y: 1864, activationRadius: 52,
      label: 'Enter the Hearthstone Inn',
    },
    {
      id: 'shop_entrance', type: 'building_shop',
      x: 280, y: 944, activationRadius: 52,
      label: 'Visit Item Shop',
    },
    {
      id: 'save_crystal', type: 'save_crystal',
      x: 1400, y: 1380, activationRadius: 48,
      label: 'Save Journey',
    },
    {
      id: 'thornwood_warning_sign', type: 'sign',
      x: 1400, y: 2160, activationRadius: 44,
      label: 'Danger Notice',
      dialogueId: 'thornwood_warning_sign',
      dialogueOverrides: [
        { requiredFlag: STORY_FLAGS.THORNWOOD_CLEARED, dialogueId: 'thornwood_warning_cleared' },
      ],
    },
    {
      id: 'villager_1', type: 'npc',
      x: 900, y: 1500, activationRadius: 52,
      label: 'Talk',
      dialogueId: 'villager_rumor',
      dialogueOverrides: [
        { requiredFlag: STORY_FLAGS.BOSS_VEYR_DEFEATED, dialogueId: 'villager_rumor_boss_cleared' },
        { requiredFlag: STORY_FLAGS.THORNWOOD_CLEARED,  dialogueId: 'villager_rumor_cleared' },
      ],
    },
    {
      id: 'serelle_town', type: 'npc',
      x: 1400, y: 490, activationRadius: 56,
      label: 'Talk to Serelle',
      dialogueId: 'serelle_join_event',
      hideWhenFlag: STORY_FLAGS.SERELLE_JOINED,
    },
    {
      id: 'guard_south', type: 'npc',
      x: 1660, y: 2200, activationRadius: 50,
      label: 'Talk',
      dialogueId: 'guard_patrol',
      dialogueOverrides: [
        { requiredFlag: STORY_FLAGS.BOSS_VEYR_DEFEATED, dialogueId: 'guard_patrol_boss_cleared' },
        { requiredFlag: STORY_FLAGS.THORNWOOD_CLEARED,  dialogueId: 'guard_patrol_cleared' },
      ],
    },
    {
      id: 'lumen_mayor', type: 'npc',
      x: 2480, y: 944, activationRadius: 52,
      label: 'Talk to Official',
      dialogueId: 'lumen_mayor',
    },
  ],

  // ── Exit trigger ─────────────────────────────────────────────────────────────
  exit: {
    x: 1220, y: 2320,
    width: 360, height: 60,
    targetLocationId: 'border_fields',
    worldReturnX: 2660,
    worldReturnY: 1065,
  },

  // ── Shop stock ────────────────────────────────────────────────────────────────
  shopStock: ['herb_tonic', 'clearwater_drop'],

  // ── Visual layout ─────────────────────────────────────────────────────────────
  layout: {
    plaza:    { x:  100, y:  420, width: 2600, height: 1900 },
    road:     { x:  100, y: 1360, width: 2600, height:   80 },
    exitPath: { x: 1220, y: 1440, width:  360, height:  880 },

    inn:       { x:  160, y: 1640, width: 240, height: 224 },
    shop:      { x:  160, y:  720, width: 240, height: 224 },
    hall:      { x: 2360, y:  720, width: 240, height: 224 },
    hallLabel: 'City Hall',

    lampPostsX: [],
    redFlowers:  [],
    blueFlowers: [],
    barrels:     [],

    // ── City-scale features ────────────────────────────────────────────────────
    mansion:  { x: 700, y: 80, width: 1400, height: 340, label: 'Vaun Mansion' },
    cityGate: { wallY: 2320, gateX: 1220, gateWidth: 360 },
    fountain: { x: 1400, y: 1380 },

    trees: [
      // Mansion forecourt (clear of outer-flank buildings)
      [1100, 490], [1700, 490],
      // W-road and E-road between upper alley and building row
      [ 700,  680], [2100,  680],
      // W-road and E-road between lower alley and Zone C
      [ 700, 1280], [2100, 1280],
      // South section flanking avenue
      [ 200, 1980], [ 380, 2020],
      [2420, 1980], [2600, 2020],
    ] as Array<[number, number]>,

    marketStalls: [
      // Outer zones at cross street
      [ 200, 1390], [ 400, 1390],
      [2400, 1390], [2600, 1390],
      // South of cross street in inner-zone open band
      [ 850, 1480], [1060, 1480],
      [1740, 1480], [1960, 1480],
    ] as Array<[number, number]>,

    lampPosts: [
      // Mansion forecourt / avenue north
      [1210,  540], [1590,  540],
      // West parallel road (intersections + midpoints)
      [ 700,  640], [ 700,  960], [ 700, 1150], [ 700, 1280],
      // East parallel road
      [2100,  640], [2100,  960], [2100, 1150], [2100, 1280],
      // Main cross street
      [ 380, 1340], [ 680, 1340], [ 980, 1340],
      [1820, 1340], [2120, 1340], [2420, 1340],
      // South avenue
      [1210, 1820], [1590, 1820],
      [1210, 2180], [1590, 2180],
    ] as Array<[number, number]>,

    additionalRoads: [
      { x: 1220, y:  420, width:  360, height:  940 },  // main avenue (north section)
      { x:  660, y:  420, width:   80, height:  940 },  // west parallel road
      { x: 2060, y:  420, width:   80, height:  940 },  // east parallel road
      { x:  100, y:  620, width: 2600, height:   50 },  // upper cross-alley
      { x:  100, y: 1150, width: 2600, height:   50 },  // lower cross-alley
    ],

    extraBuildings: [
      // ── Zone A: Mansion left flank, row 1 (y 100–250) ─────────────────────
      { x:  110, y:  100, width: 160, height: 150, colorBody: 0xc8a870, colorRoof: 0x8a5a30, style: 'tall' },
      { x:  280, y:  100, width: 150, height: 150, colorBody: 0xb86040, colorRoof: 0x783818 },
      { x:  445, y:  100, width: 185, height: 150, colorBody: 0x9a9080, colorRoof: 0x686058, style: 'tall' },
      // ── Zone A: Mansion left flank, row 2 (y 270–390) ─────────────────────
      { x:  110, y:  270, width: 160, height: 120, colorBody: 0x8a9070, colorRoof: 0x586040 },
      { x:  280, y:  270, width: 150, height: 120, colorBody: 0xc09060, colorRoof: 0x7a5030 },
      { x:  445, y:  270, width: 185, height: 120, colorBody: 0xc8a870, colorRoof: 0x8a5a30 },
      // ── Zone A: Mansion right flank, row 1 (y 100–250) ────────────────────
      { x: 2150, y:  100, width: 160, height: 150, colorBody: 0xc8a870, colorRoof: 0x8a5a30 },
      { x: 2325, y:  100, width: 150, height: 150, colorBody: 0xb86040, colorRoof: 0x783818, style: 'tall' },
      { x: 2490, y:  100, width: 175, height: 150, colorBody: 0x9a9080, colorRoof: 0x686058 },
      // ── Zone A: Mansion right flank, row 2 (y 270–390) ────────────────────
      { x: 2150, y:  270, width: 160, height: 120, colorBody: 0xc09060, colorRoof: 0x7a5030, style: 'tall' },
      { x: 2325, y:  270, width: 150, height: 120, colorBody: 0x8a9070, colorRoof: 0x586040 },
      { x: 2490, y:  270, width: 175, height: 120, colorBody: 0xc8a870, colorRoof: 0x8a5a30 },

      // ── Existing upper blocks (y 440–620) ─────────────────────────────────
      { x:  120, y:  440, width: 140, height: 160, colorBody: 0xc8a870, colorRoof: 0x8a5a30 },
      { x:  280, y:  440, width: 140, height: 160, colorBody: 0xb86040, colorRoof: 0x783818 },
      { x:  440, y:  440, width: 180, height: 160, colorBody: 0x9a9080, colorRoof: 0x686058 },
      { x:  760, y:  440, width: 140, height: 180, colorBody: 0x8a9070, colorRoof: 0x586040 },
      { x:  920, y:  440, width: 140, height: 180, colorBody: 0xc8a870, colorRoof: 0x8a5a30 },
      { x: 1060, y:  440, width: 140, height: 180, colorBody: 0xb86040, colorRoof: 0x783818 },
      { x: 1600, y:  440, width: 140, height: 180, colorBody: 0x9a9080, colorRoof: 0x686058 },
      { x: 1760, y:  440, width: 140, height: 180, colorBody: 0xc09060, colorRoof: 0x7a5030 },
      { x: 1900, y:  440, width: 130, height: 180, colorBody: 0x8a9070, colorRoof: 0x586040 },
      { x: 2160, y:  440, width: 140, height: 160, colorBody: 0xc8a870, colorRoof: 0x8a5a30 },
      { x: 2320, y:  440, width: 140, height: 160, colorBody: 0xb86040, colorRoof: 0x783818 },
      { x: 2480, y:  440, width: 160, height: 160, colorBody: 0x9a9080, colorRoof: 0x686058 },

      // ── Zone B: Outer-W beside Shop (y 720–944) ───────────────────────────
      { x:  415, y:  720, width: 115, height: 224, colorBody: 0xb86040, colorRoof: 0x783818, style: 'tall' },
      { x:  545, y:  720, width: 105, height: 224, colorBody: 0x8a9070, colorRoof: 0x586040 },
      // ── Zone B: Inner-W band (y 720–944) ──────────────────────────────────
      { x:  755, y:  720, width: 140, height: 224, colorBody: 0xc09060, colorRoof: 0x7a5030 },
      { x:  908, y:  720, width: 140, height: 224, colorBody: 0x8898b0, colorRoof: 0x506070, style: 'tall' },
      { x: 1062, y:  720, width: 140, height: 224, colorBody: 0xc8a870, colorRoof: 0x8a5a30 },
      // ── Zone B: Inner-E band (y 720–944) ──────────────────────────────────
      { x: 1595, y:  720, width: 140, height: 224, colorBody: 0x9a9080, colorRoof: 0x686058, style: 'tall' },
      { x: 1748, y:  720, width: 140, height: 224, colorBody: 0xc09060, colorRoof: 0x7a5030 },
      { x: 1902, y:  720, width: 140, height: 224, colorBody: 0xb86040, colorRoof: 0x783818 },
      // ── Zone B: Outer-E beside City Hall (y 720–944) ──────────────────────
      { x: 2150, y:  720, width: 100, height: 224, colorBody: 0xc8a870, colorRoof: 0x8a5a30, style: 'tall' },
      { x: 2260, y:  720, width:  90, height: 224, colorBody: 0x9a9080, colorRoof: 0x686058 },

      // ── Existing lower blocks (y 1000–1120) ───────────────────────────────
      { x:  120, y: 1000, width: 130, height: 120, colorBody: 0xc09060, colorRoof: 0x7a5030 },
      { x:  270, y: 1000, width: 130, height: 120, colorBody: 0xc8a870, colorRoof: 0x8a5a30 },
      { x:  420, y: 1000, width: 200, height: 120, colorBody: 0x8898b0, colorRoof: 0x506070 },
      { x: 2160, y: 1000, width: 120, height: 120, colorBody: 0xc09060, colorRoof: 0x7a5030 },
      { x: 2300, y: 1000, width: 130, height: 120, colorBody: 0x8a9070, colorRoof: 0x586040 },
      { x: 2450, y: 1000, width: 210, height: 120, colorBody: 0xc8a870, colorRoof: 0x8a5a30 },

      // ── Zone C: Outer-W mid-city (y 1215–1325) ────────────────────────────
      { x:  110, y: 1215, width: 155, height: 110, colorBody: 0xc8a870, colorRoof: 0x8a5a30 },
      { x:  278, y: 1215, width: 145, height: 110, colorBody: 0xb86040, colorRoof: 0x783818 },
      { x:  438, y: 1215, width: 195, height: 110, colorBody: 0x9a9080, colorRoof: 0x686058, style: 'wide' },
      // ── Zone C: Inner-W wide market halls (y 1215–1325) ───────────────────
      { x:  750, y: 1215, width: 210, height: 110, colorBody: 0xc09060, colorRoof: 0x7a5030, style: 'wide' },
      { x:  975, y: 1215, width: 210, height: 110, colorBody: 0x8a9070, colorRoof: 0x586040, style: 'wide' },
      // ── Zone C: Inner-E wide market halls (y 1215–1325) ───────────────────
      { x: 1590, y: 1215, width: 215, height: 110, colorBody: 0xc8a870, colorRoof: 0x8a5a30, style: 'wide' },
      { x: 1820, y: 1215, width: 215, height: 110, colorBody: 0x8898b0, colorRoof: 0x506070, style: 'wide' },
      // ── Zone C: Outer-E mid-city (y 1215–1325) ────────────────────────────
      { x: 2150, y: 1215, width: 155, height: 110, colorBody: 0xc8a870, colorRoof: 0x8a5a30 },
      { x: 2318, y: 1215, width: 155, height: 110, colorBody: 0xb86040, colorRoof: 0x783818 },
      { x: 2488, y: 1215, width: 172, height: 110, colorBody: 0x9a9080, colorRoof: 0x686058, style: 'wide' },

      // ── Existing south rows (y 1460–1590) ─────────────────────────────────
      { x:  420, y: 1460, width: 100, height: 130, colorBody: 0xb86040, colorRoof: 0x783818 },
      { x:  540, y: 1460, width: 100, height: 130, colorBody: 0xc09060, colorRoof: 0x7a5030 },
      { x: 1800, y: 1460, width: 100, height: 130, colorBody: 0x8898b0, colorRoof: 0x506070 },
      { x: 1920, y: 1460, width: 120, height: 130, colorBody: 0xb86040, colorRoof: 0x783818 },

      // ── Zone D: Outer-E south, row 1 (y 1470–1600) ────────────────────────
      { x: 2150, y: 1470, width: 155, height: 130, colorBody: 0xc8a870, colorRoof: 0x8a5a30, style: 'tall' },
      { x: 2318, y: 1470, width: 145, height: 130, colorBody: 0xb86040, colorRoof: 0x783818 },
      { x: 2478, y: 1470, width: 182, height: 130, colorBody: 0xc09060, colorRoof: 0x7a5030 },
      // ── Zone D: Outer-E south, row 2 (y 1650–1800) ────────────────────────
      { x: 2150, y: 1650, width: 155, height: 150, colorBody: 0x9a9080, colorRoof: 0x686058 },
      { x: 2318, y: 1650, width: 145, height: 150, colorBody: 0xc8a870, colorRoof: 0x8a5a30, style: 'tall' },
      { x: 2478, y: 1650, width: 182, height: 150, colorBody: 0x8a9070, colorRoof: 0x586040 },
    ],
  },
};
