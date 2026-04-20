// src/game/data/maps/lumen-town-config.ts
// Lumen City — large walled capital, 2800 × 2400 world-space.
//
// District structure (not to scale):
//
//   LEFT WALL │ outer-W │ W-road │ inner-W │ AVENUE │ inner-E │ E-road │ outer-E │ RIGHT WALL
//   x=0–100   │ 100–660 │660–740 │ 740–1220│1220–1580│1580–2060│2060–2140│2140–2700│ 2700–2800
//
//   y=0        ██████████████████████████████████████████████  top wall
//   y=80       ██████████████ [VAUN MANSION x=700–2100] ██████
//   y=420      [NW block] [inner-W block] [forecourt] [inner-E block] [NE block]
//              buildings  buildings  Serelle★   buildings   buildings
//   y=600      ───────────────────────────────────────────────────────
//   y=720      [SHOP]  gap  ·  gap  ·  [gap]  ·  gap  ·  gap  [CITY HALL]
//   y=944      ────────────────────────────────────────────────────────
//   y=1000     [W-lower block]                          [E-lower block]
//   y=1120     ────────────────────────────────────────────────────────
//   y=1360     ════════════════ main east–west cross street ════════════
//   y=1440     [market stalls] [fountain / save ✦] [market stalls]
//   y=1460     [SW row]                                    [SE row]
//   y=1640     [INN]
//   y=2160     [sign]  ·  ·  ·  ·  [guard]
//   y=2320     ████ south wall ██ [SOUTH GATE] ██ south wall ████
//   y=2400

import type { TownMapConfig } from '../../town/types/town-types';
import { STORY_FLAGS } from '../story/story-events';

export const LUMEN_TOWN_CONFIG: TownMapConfig = {
  displayName:  'Lumen City',
  mapWidth:  2800,
  mapHeight: 2400,

  // Player spawns just inside the south gate when arriving from the world map.
  playerEntryX: 1372,   // top-left; centre on the main avenue (cx=1400)
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

    // ── Extra building blocks ─────────────────────────────────────────────────
    // North-west block (y 440–600)
    { x:  120, y:  440, width: 140, height: 160 },
    { x:  280, y:  440, width: 140, height: 160 },
    { x:  440, y:  440, width: 180, height: 160 },
    // West-lower block (y 1000–1120)
    { x:  120, y: 1000, width: 130, height: 120 },
    { x:  270, y: 1000, width: 130, height: 120 },
    { x:  420, y: 1000, width: 200, height: 120 },
    // South-west row (y 1460–1590, east of Inn)
    { x:  420, y: 1460, width: 100, height: 130 },
    { x:  540, y: 1460, width: 100, height: 130 },
    // Inner-west block (y 440–620, between W-road and avenue)
    { x:  760, y:  440, width: 140, height: 180 },
    { x:  920, y:  440, width: 140, height: 180 },
    { x: 1060, y:  440, width: 140, height: 180 },
    // Inner-east block (y 440–620, between avenue and E-road)
    { x: 1600, y:  440, width: 140, height: 180 },
    { x: 1760, y:  440, width: 140, height: 180 },
    { x: 1900, y:  440, width: 130, height: 180 },
    // North-east block (y 440–600)
    { x: 2160, y:  440, width: 140, height: 160 },
    { x: 2320, y:  440, width: 140, height: 160 },
    { x: 2480, y:  440, width: 160, height: 160 },
    // East-lower block (y 1000–1120)
    { x: 2160, y: 1000, width: 120, height: 120 },
    { x: 2300, y: 1000, width: 130, height: 120 },
    { x: 2450, y: 1000, width: 210, height: 120 },
    // South-east row (y 1460–1590)
    { x: 1800, y: 1460, width: 100, height: 130 },
    { x: 1920, y: 1460, width: 120, height: 130 },
  ],

  // ── Interactables ─────────────────────────────────────────────────────────────
  interactables: [
    // ── Inn entrance (south-west building) ──────────────────────────────────
    {
      id:               'inn_entrance',
      type:             'building_inn',
      x: 280, y: 1864,
      activationRadius: 52,
      label:            'Enter the Hearthstone Inn',
    },

    // ── Shop entrance (west district) ────────────────────────────────────────
    {
      id:               'shop_entrance',
      type:             'building_shop',
      x: 280, y: 944,
      activationRadius: 52,
      label:            'Visit Item Shop',
    },

    // ── Save crystal (market square fountain) ────────────────────────────────
    {
      id:               'save_crystal',
      type:             'save_crystal',
      x: 1400, y: 1380,
      activationRadius: 48,
      label:            'Save Journey',
    },

    // ── Thornwood warning sign (near south gate) ─────────────────────────────
    {
      id:               'thornwood_warning_sign',
      type:             'sign',
      x: 1400, y: 2160,
      activationRadius: 44,
      label:            'Danger Notice',
      dialogueId:       'thornwood_warning_sign',
      dialogueOverrides: [
        { requiredFlag: STORY_FLAGS.THORNWOOD_CLEARED, dialogueId: 'thornwood_warning_cleared' },
      ],
    },

    // ── Villager NPC (market square west side) ───────────────────────────────
    {
      id:               'villager_1',
      type:             'npc',
      x: 900, y: 1500,
      activationRadius: 52,
      label:            'Talk',
      dialogueId:       'villager_rumor',
      dialogueOverrides: [
        { requiredFlag: STORY_FLAGS.BOSS_VEYR_DEFEATED, dialogueId: 'villager_rumor_boss_cleared' },
        { requiredFlag: STORY_FLAGS.THORNWOOD_CLEARED,  dialogueId: 'villager_rumor_cleared' },
      ],
    },

    // ── Serelle (join event; stands in Vaun Mansion forecourt) ───────────────
    {
      id:               'serelle_town',
      type:             'npc',
      x: 1400, y: 490,
      activationRadius: 56,
      label:            'Talk to Serelle',
      dialogueId:       'serelle_join_event',
      hideWhenFlag:     STORY_FLAGS.SERELLE_JOINED,
    },

    // ── Guard NPC (near south gate) ──────────────────────────────────────────
    {
      id:               'guard_south',
      type:             'npc',
      x: 1660, y: 2200,
      activationRadius: 50,
      label:            'Talk',
      dialogueId:       'guard_patrol',
      dialogueOverrides: [
        { requiredFlag: STORY_FLAGS.BOSS_VEYR_DEFEATED, dialogueId: 'guard_patrol_boss_cleared' },
        { requiredFlag: STORY_FLAGS.THORNWOOD_CLEARED,  dialogueId: 'guard_patrol_cleared' },
      ],
    },

    // ── City official (outside City Hall, east district) ─────────────────────
    {
      id:               'lumen_mayor',
      type:             'npc',
      x: 2480, y: 944,
      activationRadius: 52,
      label:            'Talk to Official',
      dialogueId:       'lumen_mayor',
    },
  ],

  // ── Exit trigger ─────────────────────────────────────────────────────────────
  exit: {
    x: 1220, y: 2320,
    width:  360, height: 60,
    targetLocationId: 'border_fields',
    // World-map coordinates — independent of town interior size.
    worldReturnX: 2660,
    worldReturnY: 1065,
  },

  // ── Shop stock ────────────────────────────────────────────────────────────────
  shopStock: ['herb_tonic', 'clearwater_drop'],

  // ── Visual layout ─────────────────────────────────────────────────────────────
  layout: {
    // Ground surfaces
    plaza:    { x:  100, y:  420, width: 2600, height: 1900 },
    road:     { x:  100, y: 1360, width: 2600, height:   80 },  // main E–W cross street
    exitPath: { x: 1220, y: 1440, width:  360, height:  880 },  // south section of avenue

    // Standard building slots
    inn:       { x:  160, y: 1640, width: 240, height: 224 },
    shop:      { x:  160, y:  720, width: 240, height: 224 },
    hall:      { x: 2360, y:  720, width: 240, height: 224 },
    hallLabel: 'City Hall',

    // Standard decorations — unused in this city (city features take over)
    lampPostsX: [],
    redFlowers:  [],
    blueFlowers: [],
    barrels:     [],
    // fencePosts intentionally omitted

    // ── City-scale features ────────────────────────────────────────────────────
    mansion:  { x: 700, y: 80, width: 1400, height: 340, label: 'Vaun Mansion' },
    cityGate: { wallY: 2320, gateX: 1220, gateWidth: 360 },
    fountain: { x: 1400, y: 1380 },

    trees: [
      // Mansion forecourt flanking
      [1100, 490], [1700, 490],
      // Open space near parallel roads (between upper buildings and active buildings)
      [ 640,  700], [2080,  700],
      // South of lower building rows, flanking cross street approach
      [ 600, 1270], [2200, 1270],
      // South area (south of cross street, flanking avenue)
      [ 200, 1980], [ 380, 2020],
      [2420, 1980], [2600, 2020],
    ] as Array<[number, number]>,

    marketStalls: [
      // North row (between lower blocks and cross street)
      [ 540, 1220], [ 720, 1220], [ 900, 1220],
      [1640, 1220], [1820, 1220], [2000, 1220],
      // South row (between cross street and south-west/east building rows)
      [ 540, 1560], [ 720, 1560],
      [1640, 1560], [1820, 1560],
    ] as Array<[number, number]>,

    // Lamp posts: [cx, topY] — absolute positions along all roads
    lampPosts: [
      // Mansion forecourt / avenue north
      [1210,  540], [1590,  540],
      // West parallel road
      [ 700,  640], [ 700,  960], [ 700, 1280],
      // East parallel road
      [2100,  640], [2100,  960], [2100, 1280],
      // Main cross street
      [ 380, 1340], [ 680, 1340], [ 980, 1340],
      [1820, 1340], [2120, 1340], [2420, 1340],
      // South avenue
      [1210, 1820], [1590, 1820],
      [1210, 2180], [1590, 2180],
    ] as Array<[number, number]>,

    // Additional paved roads drawn on top of the ground layer
    additionalRoads: [
      { x: 1220, y:  420, width: 360, height: 940 },  // main avenue north section
      { x:  660, y:  420, width:  80, height: 940 },  // west parallel road
      { x: 2060, y:  420, width:  80, height: 940 },  // east parallel road
    ],

    // ── Extra building fronts forming city blocks ──────────────────────────────
    extraBuildings: [
      // ── North-west block (y 440–600) ───────────────────────────────────────
      { x:  120, y:  440, width: 140, height: 160, colorBody: 0xc8a870, colorRoof: 0x8a5a30 },
      { x:  280, y:  440, width: 140, height: 160, colorBody: 0xb86040, colorRoof: 0x783818 },
      { x:  440, y:  440, width: 180, height: 160, colorBody: 0x9a9080, colorRoof: 0x686058 },
      // ── West-lower block (y 1000–1120) ─────────────────────────────────────
      { x:  120, y: 1000, width: 130, height: 120, colorBody: 0xc09060, colorRoof: 0x7a5030 },
      { x:  270, y: 1000, width: 130, height: 120, colorBody: 0xc8a870, colorRoof: 0x8a5a30 },
      { x:  420, y: 1000, width: 200, height: 120, colorBody: 0x8898b0, colorRoof: 0x506070 },
      // ── South-west row (y 1460–1590, east of Inn) ──────────────────────────
      { x:  420, y: 1460, width: 100, height: 130, colorBody: 0xb86040, colorRoof: 0x783818 },
      { x:  540, y: 1460, width: 100, height: 130, colorBody: 0xc09060, colorRoof: 0x7a5030 },
      // ── Inner-west block (y 440–620, between W-road and avenue) ────────────
      { x:  760, y:  440, width: 140, height: 180, colorBody: 0x8a9070, colorRoof: 0x586040 },
      { x:  920, y:  440, width: 140, height: 180, colorBody: 0xc8a870, colorRoof: 0x8a5a30 },
      { x: 1060, y:  440, width: 140, height: 180, colorBody: 0xb86040, colorRoof: 0x783818 },
      // ── Inner-east block (y 440–620, between avenue and E-road) ────────────
      { x: 1600, y:  440, width: 140, height: 180, colorBody: 0x9a9080, colorRoof: 0x686058 },
      { x: 1760, y:  440, width: 140, height: 180, colorBody: 0xc09060, colorRoof: 0x7a5030 },
      { x: 1900, y:  440, width: 130, height: 180, colorBody: 0x8a9070, colorRoof: 0x586040 },
      // ── North-east block (y 440–600) ───────────────────────────────────────
      { x: 2160, y:  440, width: 140, height: 160, colorBody: 0xc8a870, colorRoof: 0x8a5a30 },
      { x: 2320, y:  440, width: 140, height: 160, colorBody: 0xb86040, colorRoof: 0x783818 },
      { x: 2480, y:  440, width: 160, height: 160, colorBody: 0x9a9080, colorRoof: 0x686058 },
      // ── East-lower block (y 1000–1120) ─────────────────────────────────────
      { x: 2160, y: 1000, width: 120, height: 120, colorBody: 0xc09060, colorRoof: 0x7a5030 },
      { x: 2300, y: 1000, width: 130, height: 120, colorBody: 0x8a9070, colorRoof: 0x586040 },
      { x: 2450, y: 1000, width: 210, height: 120, colorBody: 0xc8a870, colorRoof: 0x8a5a30 },
      // ── South-east row (y 1460–1590) ───────────────────────────────────────
      { x: 1800, y: 1460, width: 100, height: 130, colorBody: 0x8898b0, colorRoof: 0x506070 },
      { x: 1920, y: 1460, width: 120, height: 130, colorBody: 0xb86040, colorRoof: 0x783818 },
    ],
  },
};
