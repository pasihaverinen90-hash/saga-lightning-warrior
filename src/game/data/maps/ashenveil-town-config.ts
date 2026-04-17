// src/game/data/maps/ashenveil-town-config.ts
// Ashenveil — a mid-road settlement east of Lumen Town: 1600 × 900 world-space.
//
// Visual reference (not to scale):
//
//   0                 800               1600
//   ┌─────────────────────────────────────┐  0
//   │  ██ left  ██  [ELDER'S HALL] ██ right│
//   │  ██ wall  ██                  ██ wall│
//   │  [KAEL]   │                          │  300
//   │  [INN]    │    [save ✦]    [SHOP]    │
//   │           │                          │
//   │   ≡≡≡≡≡≡cobblestone road≡≡≡≡≡≡≡≡≡  │  570
//   │  [board] [elder]  [villager]         │
//   │                          [guard]    │
//   │                                     │  820
//   │     ██████ EXIT (west) ████████     │
//   └─────────────────────────────────────┘  900
//
// Layout intentionally mirrors Lumen Town so TownScene renders correctly with
// placeholder visuals. Adjust coordinates when final art is added.

import type { TownMapConfig } from '../../town/types/town-types';
import { STORY_FLAGS } from '../story/story-events';

export const ASHENVEIL_TOWN_CONFIG: TownMapConfig = {
  displayName:  'Ashenveil',
  mapWidth:  1600,
  mapHeight: 900,

  // Player spawns just inside the west entrance when arriving from Ashenveil Road.
  playerEntryX: 786,  // top-left; center is at 800
  playerEntryY: 790,

  // ── Collision rectangles ──────────────────────────────────────────────────────
  // Must match visually impassable areas drawn in TownScene.
  collisionRects: [
    // Perimeter walls
    { x:    0, y:   0, width:  100, height: 900 },  // left boundary
    { x: 1500, y:   0, width:  100, height: 900 },  // right boundary
    { x:    0, y:   0, width: 1600, height:  80 },  // top boundary

    // Buildings
    { x:  120, y: 300, width:  240, height: 230 },  // inn (west side)
    { x: 1240, y: 300, width:  240, height: 230 },  // shop (east side)
    { x:  580, y:  80, width:  440, height: 230 },  // elder's hall (larger than lumen's hall)

    // Southern boundary with gap for the exit path (x 640–960)
    { x:    0, y: 840, width:  640, height:  60 },  // south-left wall
    { x:  960, y: 840, width:  640, height:  60 },  // south-right wall
  ],

  // ── Interactables ──────────────────────────────────────────────────────────────
  interactables: [
    // ── Kael (join event on first talk; hidden after joining) ────────────────
    // hideWhenFlag removes him from the map once kael_joined is set.
    // 'kael_travel_ready' in dialogue-data.ts is kept for future scripted use.
    {
      id:               'kael_ashenveil',
      type:             'npc',
      x: 200, y: 380,
      activationRadius: 56,
      label:            'Talk to Kael',
      dialogueId:       'kael_join_event',
      hideWhenFlag:     STORY_FLAGS.KAEL_JOINED,
    },

    // ── Inn entrance ─────────────────────────────────────────────────────────
    {
      id:               'ashenveil_inn_entrance',
      type:             'building_inn',
      x: 240, y: 534,
      activationRadius: 52,
      label:            'Enter the Ember Road Inn',
    },

    // ── Shop entrance ────────────────────────────────────────────────────────
    {
      id:               'ashenveil_shop_entrance',
      type:             'building_shop',
      x: 1360, y: 534,
      activationRadius: 52,
      label:            'Visit Merchant',
    },

    // ── Save crystal in the town square ──────────────────────────────────────
    {
      id:               'ashenveil_save_crystal',
      type:             'save_crystal',
      x: 800, y: 502,
      activationRadius: 48,
      label:            'Save Journey',
    },

    // ── Notice board sign ─────────────────────────────────────────────────────
    {
      id:               'notice_board',
      type:             'sign',
      x: 400, y: 620,
      activationRadius: 44,
      label:            'Read Notice Board',
      dialogueId:       'ashenveil_notice_board',
    },

    // ── Elder NPC ─────────────────────────────────────────────────────────────
    {
      id:               'ashenveil_elder',
      type:             'npc',
      x: 560, y: 620,
      activationRadius: 52,
      label:            'Talk to Elder',
      dialogueId:       'ashenveil_elder_history',
      dialogueOverrides: [
        { requiredFlag: STORY_FLAGS.THORNWOOD_CLEARED, dialogueId: 'ashenveil_elder_cleared' },
      ],
    },

    // ── Villager NPC ─────────────────────────────────────────────────────────
    {
      id:               'ashenveil_villager',
      type:             'npc',
      x: 800, y: 650,
      activationRadius: 52,
      label:            'Talk',
      dialogueId:       'ashenveil_villager_unrest',
    },

    // ── Guard near exit ───────────────────────────────────────────────────────
    {
      id:               'ashenveil_guard',
      type:             'npc',
      x: 1040, y: 730,
      activationRadius: 50,
      label:            'Talk',
      dialogueId:       'ashenveil_guard_warning',
    },
  ],

  // ── Exit trigger ──────────────────────────────────────────────────────────────
  // Player walks into this rect and is returned to the world map (Ashenveil Road).
  exit: {
    x: 640, y: 820,
    width:  320, height: 60,
    targetLocationId: 'ashenveil_town',
    // Return player to just east of the Ashenveil town entrance trigger
    worldReturnX: 400,
    worldReturnY: 506,
  },

  // ── Shop stock ────────────────────────────────────────────────────────────────
  // Ashenveil is the player's first equipment upgrade point.
  // Consumables: stronger than Lumen Town stock.
  // Weapons: steel_sword (Hugo), ice_scepter (Serelle), war_axe (Kael).
  // Armors: chain_mail (physical), mage_coat (casters).
  shopStock: [
    'herb_tonic',
    'healing_salve',
    'clearwater_drop',
    'ether_vial',
    'steel_sword',
    'war_axe',
    'ice_scepter',
    'chain_mail',
    'mage_coat',
  ],
};
