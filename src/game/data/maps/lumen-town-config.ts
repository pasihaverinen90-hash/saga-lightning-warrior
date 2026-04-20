// src/game/data/maps/lumen-town-config.ts
// Lumen City — large walled capital, 2800 × 2400 world-space.
//
// Visual reference (not to scale):
//
//   0                  1400                 2800
//   ┌──────────────────────────────────────────┐  0
//   │ ████ left wall ████           ████ right █│
//   │ ██████████  [VAUN MANSION]  ██████████  ██│  80
//   │             [Serelle ★]                  │  490
//   │  [SHOP]    ══════════════    [CITY HALL] │  720
//   │            ║  main avenue ║              │
//   │  ≡ west road ≡ cross street ≡ east road ≡│  1360
//   │  [market stalls]  [fountain]  [stalls]  │
//   │  [villager]      [save ✦]               │  1500
//   │  [INN]     ║              ║             │  1640
//   │            ║              ║ [guard]     │
//   │            ║              ║             │  2320
//   │ ████ south wall ██ [GATE] ██ south wall █│
//   └──────────────────────────────────────────┘  2400

import type { TownMapConfig } from '../../town/types/town-types';
import { STORY_FLAGS } from '../story/story-events';

export const LUMEN_TOWN_CONFIG: TownMapConfig = {
  displayName:  'Lumen City',
  mapWidth:  2800,
  mapHeight: 2400,

  // Player spawns just inside the south gate when arriving from the world map.
  playerEntryX: 1372,  // top-left; centre on the main avenue (cx=1400)
  playerEntryY: 2250,

  // ── Collision rectangles ─────────────────────────────────────────────────────
  collisionRects: [
    // Perimeter walls
    { x:    0, y:    0, width: 2800, height:   80 },  // top wall
    { x:    0, y:    0, width:  100, height: 2400 },  // left wall
    { x: 2700, y:    0, width:  100, height: 2400 },  // right wall

    // Vaun Mansion (large north landmark)
    { x:  700, y:   80, width: 1400, height:  340 },

    // West district: Item Shop
    { x:  160, y:  720, width:  240, height:  224 },

    // East civic district: City Hall
    { x: 2360, y:  720, width:  240, height:  224 },

    // South-west: Inn
    { x:  160, y: 1640, width:  240, height:  224 },

    // South boundary with gate gap (x 1220–1580)
    { x:    0, y: 2320, width: 1220, height:   80 },  // south-left wall
    { x: 1580, y: 2320, width: 1220, height:   80 },  // south-right wall
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

    // ── Shop entrance (west district Item Shop) ──────────────────────────────
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
        { requiredFlag: STORY_FLAGS.BOSS_VEYR_DEFEATED,  dialogueId: 'villager_rumor_boss_cleared' },
        { requiredFlag: STORY_FLAGS.THORNWOOD_CLEARED,   dialogueId: 'villager_rumor_cleared' },
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
        { requiredFlag: STORY_FLAGS.BOSS_VEYR_DEFEATED,  dialogueId: 'guard_patrol_boss_cleared' },
        { requiredFlag: STORY_FLAGS.THORNWOOD_CLEARED,   dialogueId: 'guard_patrol_cleared' },
      ],
    },

    // ── City official (stands outside City Hall, east district) ─────────────
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
  // Player walks through the south gate opening and is returned to the world map.
  // worldReturnX/Y are world-map coordinates; independent of the town interior size.
  exit: {
    x: 1220, y: 2320,
    width:  360, height: 60,
    targetLocationId: 'border_fields',
    worldReturnX: 2660,
    worldReturnY: 1065,
  },

  // ── Shop stock ────────────────────────────────────────────────────────────────
  shopStock: ['herb_tonic', 'clearwater_drop'],

  // ── Visual layout ─────────────────────────────────────────────────────────────
  layout: {
    // Ground / surface areas
    plaza:    { x: 100, y:  420, width: 2600, height: 1900 },
    road:     { x: 100, y: 1360, width: 2600, height:   80 },  // east–west cross street
    exitPath: { x: 1220, y: 1440, width: 360, height:  880 },  // south section of main avenue

    // Standard building slots consumed by drawBuildings()
    inn:       { x:  160, y: 1640, width: 240, height: 224 },
    shop:      { x:  160, y:  720, width: 240, height: 224 },
    hall:      { x: 2360, y:  720, width: 240, height: 224 },
    hallLabel: 'City Hall',

    // Standard decorations — mostly unused; city relies on city-scale features
    lampPostsX: [],
    redFlowers:  [],
    blueFlowers: [],
    barrels:     [],
    // fencePosts intentionally omitted — city uses lamp posts along the avenue

    // ── City-scale features ────────────────────────────────────────────────────
    mansion: { x: 700, y: 80, width: 1400, height: 340, label: 'Vaun Mansion' },

    cityGate: { wallY: 2320, gateX: 1220, gateWidth: 360 },

    fountain: { x: 1400, y: 1380 },

    trees: [
      [280,  580], [480,  620], [2320,  580], [2520,  620],
      [200, 1150], [380, 1180], [2420, 1150], [2600, 1180],
      [200, 1980], [380, 2020], [2420, 1980], [2600, 2020],
    ] as Array<[number, number]>,

    marketStalls: [
      [ 540, 1220], [ 720, 1220], [ 900, 1220],
      [1640, 1220], [1820, 1220], [2000, 1220],
      [ 540, 1560], [ 720, 1560],
      [1640, 1560], [1820, 1560],
    ] as Array<[number, number]>,

    // Lamp posts: [cx, topY] absolute positions
    lampPosts: [
      // Flanking Serelle / mansion forecourt
      [1210,  540], [1590,  540],
      // Cross street
      [ 380, 1340], [ 680, 1340], [ 980, 1340],
      [1820, 1340], [2120, 1340], [2420, 1340],
      // South avenue
      [1210, 1820], [1590, 1820],
      [1210, 2180], [1590, 2180],
    ] as Array<[number, number]>,

    // North section of main avenue (mansion forecourt to cross street)
    additionalRoads: [
      { x: 1220, y: 420, width: 360, height: 940 },
    ],
  },
};
