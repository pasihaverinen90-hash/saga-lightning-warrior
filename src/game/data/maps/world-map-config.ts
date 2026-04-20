// src/game/data/maps/world-map-config.ts
// Layout configuration for the Border Fields world map.
// All coordinates are in world-space pixels (map is 4096 × 2304).
//
// Visual reference (not to scale):
//
//   0                    2048                   4096
//   ┌──────────────────────────────────────────────┐  0
//   │ ████████████████████  PASS  █████████████████│
//   │ ██ forest ████████           ███████ forest ██│
//   │ ██          [north_pass_zone]              ██│  380
//   │              ↑ path                          │
//   │              │                               │
//   │              │            [LUMEN TOWN]       │  800
//   │  [START]─────road──────────────[road]──[ASHENVEIL]│  1060
//   │                                              │
//   │  [thornwood_zone]      [ashenveil_road_zone] │  1460
//   │   [CLEARING]                                 │
//   │ ████████████████████████████████████████████│  2224
//   └──────────────────────────────────────────────┘  2304
//
// Zones (encounter-enabled):
//   north_pass_zone      — mountain gap and the north path, x:1600–2260 y:0–720
//   thornwood_zone       — corrupted sw forest, x:180–1100 y:1460–2224
//   ashenveil_road_zone  — eastern corridor past Lumen Town, x:3000–3916 y:760–2224
//
// Triggers:
//   lumen_town_entrance       — town entrance (gold marker)
//   north_pass_entrance       — scripted boss trigger (crimson marker, flag-gated)
//   ashenveil_road_entrance   — Ashenveil town entrance (gold marker)
//   grove_warden_clearing     — Thornwood optional event (crimson, consumed after win)

import type { WorldMapConfig } from '../../world/types/world-types';
import { STORY_FLAGS } from '../story/story-events';

export const BORDER_FIELDS_CONFIG: WorldMapConfig = {
  mapWidth:  4096,
  mapHeight: 2304,

  // Player spawns on the main road, left side
  playerStartX: 460,
  playerStartY: 1100,   // top-left of player rect (28×36), centres at ~474,1118

  // ── Solid obstacle rectangles ───────────────────────────────────────────────
  collisionRects: [
    // Left forest wall
    { x: 0,    y: 0,    width: 180,  height: 2304 },
    // Right forest wall
    { x: 3916, y: 0,    width: 180,  height: 2304 },
    // Top mountain range — LEFT of North Pass gap (gap is x 1600–2260)
    { x: 0,    y: 0,    width: 1600, height: 380  },
    // Top mountain range — RIGHT of North Pass gap
    { x: 2260, y: 0,    width: 1836, height: 380  },
    // Bottom border strip
    { x: 0,    y: 2224, width: 4096, height: 80   },
  ],

  // ── Scene transition triggers ───────────────────────────────────────────────
  triggers: [
    {
      id:               'lumen_town_entrance',
      x: 2720, y: 800,
      width:  220,
      height: 340,   // tall enough to overlap road at y:1060–1150
      label:            'Enter Lumen Town',
      targetSceneKey:   'TownScene',
      targetLocationId: 'lumen_town',
    },
    {
      id:               'north_pass_entrance',
      x: 1848,  y: 130,
      width:  164,
      height: 130,
      label:            'Enter North Pass',
      targetSceneKey:   'BattleScene',
      targetLocationId: 'north_pass',
      scriptedBattle: {
        enemyIds:           ['shadecaster_veyr'],
        backgroundColorHex: '#0d0820',
        introDialogueId:    'boss_veyr_intro',
        outroDialogueId:    'boss_veyr_defeat',
        isBoss:             true,
        requiresFlag:       STORY_FLAGS.SERELLE_JOINED,
        consumedByFlag:     STORY_FLAGS.BOSS_VEYR_DEFEATED,
      },
    },
    {
      id:               'ashenveil_road_entrance',
      x: 3460, y: 1000,
      width:  220,
      height: 200,   // straddles road at y:1060–1150
      label:            'Enter Ashenveil',
      targetSceneKey:   'TownScene',
      targetLocationId: 'ashenveil_town',
    },
    {
      id:               'grove_warden_clearing',
      x: 380, y: 1860,
      width:  200,
      height: 100,
      label:            'Investigate Clearing',
      targetSceneKey:   'BattleScene',
      targetLocationId: 'thornwood',
      scriptedBattle: {
        enemyIds:           ['grove_warden'],
        backgroundColorHex: '#0d1f10',
        introDialogueId:    'thornwood_warden_intro',
        outroDialogueId:    'thornwood_warden_defeat',
        isBoss:             false,
        consumedByFlag:     STORY_FLAGS.THORNWOOD_CLEARED,
      },
    },
  ],

  // ── Encounter zones ─────────────────────────────────────────────────────────
  // Listed most-specific first so getActiveZone returns the right result on overlap.
  zones: [
    {
      id:          'north_pass_zone',
      displayName: 'North Pass',
      type:        'encounter',
      // Covers the mountain gap and the upper portion of the north path.
      x: 1600, y: 0, width: 660, height: 720,
    },
    {
      id:          'thornwood_zone',
      displayName: 'Thornwood',
      type:        'encounter',
      // South-west corrupted forest, below the main road.
      x: 180, y: 1460, width: 920, height: 764,
    },
    {
      id:          'ashenveil_road_zone',
      displayName: 'Ashenveil Road',
      type:        'encounter',
      // Eastern corridor east of Lumen Town, through to Ashenveil.
      x: 3000, y: 760, width: 916, height: 1464,
    },
    {
      id:          'border_fields_zone',
      displayName: 'Border Fields',
      type:        'safe',
      // Broad fallback zone covering the whole accessible map.
      x: 180, y: 0, width: 3736, height: 2304,
    },
  ],
};
