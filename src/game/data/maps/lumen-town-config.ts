// src/game/data/maps/lumen-town-config.ts
// Lumen City — large walled capital, 2800 × 2400 world-space.
//
// Blueprint road grid:
//
//   x=0   100  400 480        1220    1580       2320 2400 2700 2800
//    │wall │    │W  │           │ AVE   │           │ E  │    │wall│
//    ├─────┼────┴───┴───────────┴───────┴───────────┴────┴────┤    │  y=80
//    │          VAUN MANSION  (x 700–2100, y 80–420)          │    │
//    ├─────╪════════════════════════════════════════════╪──────┤    │  y=440 upper alley
//    │     │W ROAD│ Building2  Building3 │Building4 │E ROAD│   │    │  y=500–900
//    │     │      │ Blacksmith│          │CityHall  │      │   │    │
//    ├─────╪══════╪═══════════╪══════════╪═══════════╪══════╪───┤    │  y=900 mid cross
//    │     │      │ Bldg6     │[FOUNTAIN]│ Bldg8     │      │   │    │  y=960–1500
//    │     │ SHOP │ Bldg7     │[CRYSTAL] │ Bldg9     │Bld12 │   │    │
//    ├─────╪══════╪═══════════╪══════════╪═══════════╪══════╪───┤    │  y=1500 main road
//    │     │      │ Bldg10    │ exit pth │ Bldg11    │      │   │    │  y=1560–1780
//    │ INN │      │ Bldg13    │          │ Bldg14    │Bld15 │   │    │  y=1820–2010
//    │     │      │           │ sign     │           │      │   │    │  y=2100
//    │     │      │           │ guard    │           │      │   │    │  y=2200
//    ├─────┴──────┴───── S wall ──── GATE ───── S wall──────┴───┤    │  y=2320

import type { TownMapConfig } from '../../town/types/town-types';
import { STORY_FLAGS } from '../story/story-events';

export const LUMEN_TOWN_CONFIG: TownMapConfig = {
  displayName:  'Lumen City',
  mapWidth:  2800,
  mapHeight: 2400,

  playerEntryX: 1384,
  playerEntryY: 2250,

  // ── Collision rectangles ─────────────────────────────────────────────────────
  collisionRects: [
    // ── Perimeter ────────────────────────────────────────────────────────────
    { x:    0, y:    0, width: 2800, height:   80 },  // top wall
    { x:    0, y:    0, width:  100, height: 2400 },  // left wall
    { x: 2700, y:    0, width:  100, height: 2400 },  // right wall
    // ── South wall with gate gap (x 1220–1580) ───────────────────────────────
    { x:    0, y: 2320, width: 1220, height:   80 },
    { x: 1580, y: 2320, width: 1220, height:   80 },
    // ── Mansion ──────────────────────────────────────────────────────────────
    { x:  700, y:   80, width: 1400, height:  340 },
    // ── Active buildings (drawn by TownScene, collisions needed here) ─────────
    { x:  140, y: 1000, width:  240, height:  224 },  // Item Shop
    { x:  140, y: 1620, width:  240, height:  224 },  // Inn
    { x: 1700, y:  540, width:  240, height:  224 },  // City Hall

    // ── Upper-west-outer block: Blacksmith ────────────────────────────────────
    { x:  110, y:  520, width:  270, height:  200 },

    // ── Upper-east-outer block: Building 1 ────────────────────────────────────
    { x: 2415, y:  520, width:  270, height:  200 },

    // ── Upper-west-inner block: Buildings 2 & 3 ───────────────────────────────
    { x:  495, y:  520, width:  300, height:  200 },  // Building 2
    { x:  810, y:  520, width:  380, height:  200 },  // Building 3

    // ── Upper-east-inner block: Building 4 (east of City Hall) ───────────────
    { x: 1960, y:  520, width:  330, height:  200 },

    // ── Mid-west-inner block: Buildings 6 & 7 ────────────────────────────────
    { x:  495, y:  970, width:  660, height:  220 },  // Building 6 (north row)
    { x:  495, y: 1230, width:  660, height:  240 },  // Building 7 (south row)

    // ── Mid-east-inner block: Buildings 8 & 9 ────────────────────────────────
    { x: 1595, y:  970, width:  680, height:  220 },  // Building 8 (north row)
    { x: 1595, y: 1230, width:  680, height:  240 },  // Building 9 (south row)

    // ── Mid-east-outer block: Building 12 ────────────────────────────────────
    { x: 2415, y:  970, width:  270, height:  220 },

    // ── Lower-west-inner block: Buildings 10 & 13 ────────────────────────────
    { x:  495, y: 1580, width:  650, height:  200 },  // Building 10
    { x:  495, y: 1820, width:  440, height:  190 },  // Building 13

    // ── Lower-east-inner block: Buildings 11 & 14 ────────────────────────────
    { x: 1595, y: 1580, width:  680, height:  200 },  // Building 11
    { x: 1595, y: 1820, width:  440, height:  190 },  // Building 14

    // ── Lower-east-outer block: Building 15 ──────────────────────────────────
    { x: 2415, y: 1580, width:  270, height:  200 },
  ],

  // ── Interactables ─────────────────────────────────────────────────────────────
  interactables: [
    {
      id: 'inn_entrance', type: 'building_inn',
      x: 260, y: 1844, activationRadius: 52,
      label: 'Enter the Hearthstone Inn',
    },
    {
      id: 'shop_entrance', type: 'building_shop',
      x: 260, y: 1224, activationRadius: 52,
      label: 'Visit Item Shop',
    },
    {
      id: 'save_crystal', type: 'save_crystal',
      x: 1400, y: 1200, activationRadius: 48,
      label: 'Save Journey',
    },
    {
      id: 'thornwood_warning_sign', type: 'sign',
      x: 1400, y: 2100, activationRadius: 44,
      label: 'Danger Notice',
      dialogueId: 'thornwood_warning_sign',
      dialogueOverrides: [
        { requiredFlag: STORY_FLAGS.THORNWOOD_CLEARED, dialogueId: 'thornwood_warning_cleared' },
      ],
    },
    {
      // Placed in open space at south end of upper-west-inner block (below Building 2)
      id: 'villager_1', type: 'npc',
      x: 700, y: 860, activationRadius: 52,
      label: 'Talk',
      dialogueId: 'villager_rumor',
      dialogueOverrides: [
        { requiredFlag: STORY_FLAGS.BOSS_VEYR_DEFEATED, dialogueId: 'villager_rumor_boss_cleared' },
        { requiredFlag: STORY_FLAGS.THORNWOOD_CLEARED,  dialogueId: 'villager_rumor_cleared' },
      ],
    },
    {
      // Outside Vaun Mansion forecourt, on the upper alley
      id: 'serelle_town', type: 'npc',
      x: 1400, y: 490, activationRadius: 56,
      label: 'Talk to Serelle',
      dialogueId: 'serelle_join_event',
      hideWhenFlag: STORY_FLAGS.SERELLE_JOINED,
    },
    {
      // South approach, east of exit path
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
      // Inside City Hall, activatable from doorstep
      id: 'lumen_mayor', type: 'npc',
      x: 1820, y: 764, activationRadius: 52,
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

  shopStock: ['herb_tonic', 'clearwater_drop'],

  // ── Visual layout ─────────────────────────────────────────────────────────────
  layout: {
    plaza:    { x:  100, y:  380, width: 2600, height: 1940 },
    road:     { x:  100, y: 1500, width: 2600, height:   60 },
    exitPath: { x: 1220, y: 1560, width:  360, height:  760 },

    inn:       { x:  140, y: 1620, width: 240, height: 224 },
    shop:      { x:  140, y: 1000, width: 240, height: 224 },
    hall:      { x: 1700, y:  540, width: 240, height: 224 },
    hallLabel: 'City Hall',

    lampPostsX: [],
    redFlowers:  [],
    blueFlowers: [],
    barrels:     [],

    mansion:  { x: 700, y: 80, width: 1400, height: 340, label: 'Vaun Mansion' },
    cityGate: { wallY: 2320, gateX: 1220, gateWidth: 360 },
    fountain: { x: 1400, y: 930 },

    trees: [
      [1100, 490], [1700, 490],         // mansion forecourt
      [ 260,  700], [ 260, 1060], [ 260, 1390],   // west outer strip (open beside inn/shop)
      [2540,  700], [2540, 1060], [2540, 1390],   // east outer strip
      [ 900, 1430], [1900, 1430],       // open strip above main road, flanking avenue
    ] as Array<[number, number]>,

    marketStalls: [
      [ 920, 960], [1120, 960],         // west of fountain, on mid cross
      [1680, 960], [1880, 960],         // east of fountain
    ] as Array<[number, number]>,

    lampPosts: [
      [1220,  420], [1580,  420],       // mansion forecourt
      [ 440,  470], [2360,  470],       // upper alley at side roads
      [ 440,  700], [ 440,  950], [ 440, 1280],   // west road
      [2360,  700], [2360,  950], [2360, 1280],   // east road
      [1300,  900], [1500,  900],       // mid cross at central avenue
      [ 440, 1530], [1300, 1530], [1500, 1530], [2360, 1530],  // main road
      [1300, 1800], [1500, 1800],       // south avenue
      [1300, 2100], [1500, 2100],
    ] as Array<[number, number]>,

    additionalRoads: [
      { x:  100, y:  440, width: 2600, height:  60 },  // upper cross-alley
      { x: 1220, y:  380, width:  360, height: 1120 }, // central avenue (mansion→main road)
      { x:  400, y:  500, width:   80, height: 1560 }, // west side road (serves shop + inn)
      { x: 2320, y:  500, width:   80, height: 1560 }, // east side road
      { x:  100, y:  900, width: 2600, height:  60  }, // mid cross (central square level)
    ],

    extraBuildings: [
      // ── Upper-west-outer: Blacksmith ──────────────────────────────────────
      {
        x: 110, y: 520, width: 270, height: 200,
        colorBody: 0x8a8070, colorRoof: 0x5a5040,
        style: 'tall', label: 'Blacksmith',
      },

      // ── Upper-east-outer: Building 1 ─────────────────────────────────────
      {
        x: 2415, y: 520, width: 270, height: 200,
        colorBody: 0xc8b888, colorRoof: 0x9a7838,
        style: 'tall',
      },

      // ── Upper-west-inner: Building 2 ──────────────────────────────────────
      {
        x: 495, y: 520, width: 300, height: 200,
        colorBody: 0xb86040, colorRoof: 0x783818,
        style: 'tall',
      },
      // ── Upper-west-inner: Building 3 ──────────────────────────────────────
      {
        x: 810, y: 520, width: 380, height: 200,
        colorBody: 0x9a9080, colorRoof: 0x686058,
      },

      // ── Upper-east-inner: Building 4 (east of City Hall) ─────────────────
      {
        x: 1960, y: 520, width: 330, height: 200,
        colorBody: 0xc8a060, colorRoof: 0x8a5a20,
        style: 'tall',
      },

      // ── Mid-west-inner: Building 6 (north row — wide market hall) ─────────
      {
        x: 495, y: 970, width: 660, height: 220,
        colorBody: 0xd4b878, colorRoof: 0x9a7838,
        style: 'wide',
      },
      // ── Mid-west-inner: Building 7 (south row) ───────────────────────────
      {
        x: 495, y: 1230, width: 660, height: 240,
        colorBody: 0xc07050, colorRoof: 0x8a3820,
      },

      // ── Mid-east-inner: Building 8 (north row — wide market hall) ────────
      {
        x: 1595, y: 970, width: 680, height: 220,
        colorBody: 0x8898b0, colorRoof: 0x506070,
        style: 'wide',
      },
      // ── Mid-east-inner: Building 9 (south row) ───────────────────────────
      {
        x: 1595, y: 1230, width: 680, height: 240,
        colorBody: 0x8a9070, colorRoof: 0x586040,
        style: 'tall',
      },

      // ── Mid-east-outer: Building 12 ───────────────────────────────────────
      {
        x: 2415, y: 970, width: 270, height: 220,
        colorBody: 0xc8b888, colorRoof: 0x9a7838,
      },

      // ── Lower-west-inner: Building 10 (north — wide, faces main road) ─────
      {
        x: 495, y: 1580, width: 650, height: 200,
        colorBody: 0xc8a060, colorRoof: 0x8a5a20,
        style: 'wide',
      },
      // ── Lower-west-inner: Building 13 (south) ────────────────────────────
      {
        x: 495, y: 1820, width: 440, height: 190,
        colorBody: 0xb86040, colorRoof: 0x783818,
      },

      // ── Lower-east-inner: Building 11 (north — faces main road) ──────────
      {
        x: 1595, y: 1580, width: 680, height: 200,
        colorBody: 0x9a9080, colorRoof: 0x686058,
        style: 'wide',
      },
      // ── Lower-east-inner: Building 14 (south) ────────────────────────────
      {
        x: 1595, y: 1820, width: 440, height: 190,
        colorBody: 0xd4b878, colorRoof: 0x9a7838,
      },

      // ── Lower-east-outer: Building 15 ────────────────────────────────────
      {
        x: 2415, y: 1580, width: 270, height: 200,
        colorBody: 0xc07050, colorRoof: 0x8a3820,
        style: 'tall',
      },
    ],
  },
};
