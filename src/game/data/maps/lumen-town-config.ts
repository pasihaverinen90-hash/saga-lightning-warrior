// src/game/data/maps/lumen-town-config.ts
// Lumen Town layout: 1600 × 900 world-space.
//
// Visual reference (not to scale):
//
//   0                 800               1600
//   ┌─────────────────────────────────────┐  0
//   │  ██ left  ██  [TOWN HALL]  ██ right ██│
//   │  ██ wall  ██               ██ wall  ██│
//   │           │                          │  300
//   │  [INN]    │    [save ✦]    [SHOP]    │
//   │           │                          │
//   │   ≡≡≡≡≡≡≡road≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡   │  570
//   │                [Serelle]             │
//   │          [villager]    [guard]       │
//   │                                      │  820
//   │          ██████ EXIT ██████          │
//   └─────────────────────────────────────┘  900

import type { TownMapConfig } from '../../town/types/town-types';
import { STORY_FLAGS } from '../story/story-events';

export const LUMEN_TOWN_CONFIG: TownMapConfig = {
  displayName:  'Lumen Town',
  mapWidth:  1600,
  mapHeight: 900,

  // Player spawns just inside the south entrance when arriving from world map.
  playerEntryX: 786,  // top-left; center is at 800
  playerEntryY: 790,

  // ── Collision rectangles ─────────────────────────────────────────────────────
  // Must match visually impassable areas drawn in TownScene.
  collisionRects: [
    // Perimeter walls
    { x:    0, y:   0, width:  100, height: 900 },  // left boundary
    { x: 1500, y:   0, width:  100, height: 900 },  // right boundary
    { x:    0, y:   0, width: 1600, height:  80 },  // top boundary

    // Buildings (solid — player cannot walk through them)
    { x:  120, y: 300, width:  240, height: 230 },  // inn
    { x: 1240, y: 300, width:  240, height: 230 },  // shop
    { x:  620, y:  80, width:  360, height: 230 },  // town hall

    // Southern boundary with gap for the exit path (x 680–920)
    { x:    0, y: 840, width:  680, height:  60 },  // south-left wall
    { x:  920, y: 840, width:  680, height:  60 },  // south-right wall
  ],

  // ── Interactables ─────────────────────────────────────────────────────────────
  // activationRadius: how close the player center must be (pixels) to trigger hint.
  interactables: [
    // ── Inn entrance ──────────────────────────────────────────────────────────
    {
      id:               'inn_entrance',
      type:             'building_inn',
      x: 240, y: 534,  // center of inn doorstep
      activationRadius: 52,
      label:            'Enter Inn',
    },

    // ── Shop entrance ─────────────────────────────────────────────────────────
    {
      id:               'shop_entrance',
      type:             'building_shop',
      x: 1360, y: 534,
      activationRadius: 52,
      label:            'Visit Shop',
    },

    // ── Save crystal in the town plaza ─────────────────────────────────────────
    {
      id:               'save_crystal',
      type:             'save_crystal',
      x: 800, y: 502,
      activationRadius: 48,
      label:            'Save Journey',
    },

    // ── Warning sign — south road (Thornwood) ─────────────────────────────────
    // Placed between the player entry point (y:790) and the exit rect (y:820)
    // so it reads naturally as a warning before leaving town heading south.
    {
      id:               'thornwood_warning_sign',
      type:             'sign',
      x: 400, y: 755,
      activationRadius: 44,
      label:            'Danger Notice',
      dialogueId:       'thornwood_warning_sign',
      dialogueOverrides: [
        { requiredFlag: STORY_FLAGS.THORNWOOD_CLEARED, dialogueId: 'thornwood_warning_cleared' },
      ],
    },

    // ── Villager NPC ──────────────────────────────────────────────────────────
    {
      id:               'villager_1',
      type:             'npc',
      x: 540, y: 610,
      activationRadius: 52,
      label:            'Talk',
      dialogueId:       'villager_rumor',
      dialogueOverrides: [
        // Later events listed first — first matching flag wins.
        { requiredFlag: STORY_FLAGS.BOSS_VEYR_DEFEATED,  dialogueId: 'villager_rumor_boss_cleared' },
        { requiredFlag: STORY_FLAGS.THORNWOOD_CLEARED,   dialogueId: 'villager_rumor_cleared' },
      ],
    },

    // ── Serelle (join event on first talk; hidden after joining) ─────────────
    // hideWhenFlag removes her from the map once serelle_joined is set.
    // 'serelle_travel_ready' in dialogue-data.ts is kept for future scripted use
    // (e.g. a camp or cutscene scene) and is not wired here intentionally.
    {
      id:               'serelle_town',
      type:             'npc',
      x: 800, y: 370,
      activationRadius: 56,
      label:            'Talk to Serelle',
      dialogueId:       'serelle_join_event',
      hideWhenFlag:     STORY_FLAGS.SERELLE_JOINED,
    },

    // ── Guard NPC near exit ────────────────────────────────────────────────────
    {
      id:               'guard_south',
      type:             'npc',
      x: 960, y: 740,
      activationRadius: 50,
      label:            'Talk',
      dialogueId:       'guard_patrol',
      dialogueOverrides: [
        // Later events listed first — first matching flag wins.
        { requiredFlag: STORY_FLAGS.BOSS_VEYR_DEFEATED,  dialogueId: 'guard_patrol_boss_cleared' },
        { requiredFlag: STORY_FLAGS.THORNWOOD_CLEARED,   dialogueId: 'guard_patrol_cleared' },
      ],
    },
  ],

  // ── Exit trigger ─────────────────────────────────────────────────────────────
  // Player walks into this rect (center point test) and is sent back to world map.
  exit: {
    x: 680, y: 820,
    width:  240, height: 60,
    targetLocationId: 'border_fields',
    // Place returned player on the road, just west of the Lumen Town entrance trigger
    // (trigger: x=2720, y=800, 220×340). Top-left coords assigned directly to player rect.
    worldReturnX: 2660,
    worldReturnY: 1065,
  },

  // ── Shop stock ────────────────────────────────────────────────────────────────
  // Item IDs sold in this town's shop, in display order.
  shopStock: ['herb_tonic', 'clearwater_drop'],

  // ── Visual layout ─────────────────────────────────────────────────────────────
  // Pixel positions read by TownScene draw methods. All values here reproduce
  // the coordinates that were previously hardcoded in TownScene, so the visual
  // result is identical. Future Lumen redesigns change only this block.
  layout: {
    plaza:    { x: 100, y: 200, width: 1400, height: 680 },
    road:     { x: 100, y: 560, width: 1400, height:  80 },
    exitPath: { x: 740, y: 640, width:  120, height: 260 },

    inn:       { x:  120, y: 300, width: 240, height: 224 },
    shop:      { x: 1240, y: 300, width: 240, height: 224 },
    hall:      { x:  620, y:  80, width: 360, height: 224 },
    hallLabel: 'Town Hall',

    lampPostsX: [320, 700, 900, 1280],
    fencePosts: { startX: 380, endX: 1300, y: 556, step: 80 },
    redFlowers:  [[400,538],[440,542],[480,536],[900,540],[960,538],[1020,542]] as Array<[number,number]>,
    blueFlowers: [[420,530],[460,534],[860,532],[940,530]] as Array<[number,number]>,
    barrels:     [[396,533],[416,533]] as Array<[number,number]>,
  },
};
