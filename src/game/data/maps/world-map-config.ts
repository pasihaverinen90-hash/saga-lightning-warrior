// src/game/data/maps/world-map-config.ts
// Layout configuration for the Border Fields world map.
// All coordinates are in world-space pixels (map is 1920 × 1080).
//
// Visual reference:
//
//   0                  960                 1920
//   ┌──────────────────────────────────────────┐  0
//   │ ████████████████  PASS  ██████████████████│
//   │ ██ forest ██████         ██████ forest  ██│
//   │ ██         ↑                      ↑     ██│  340
//   │            │  [north_pass_zone]   │        │
//   │            path                  │        │
//   │            │                     │        │
//   │ ██  [START]─────────────────────[TOWN] ████│  540
//   │ ██          road   [ashenveil_road_zone] ██│  620
//   │ [thornwood_zone]                          │  680
//   │ ████████████████████████████████████████ │  1010
//   └──────────────────────────────────────────┘  1080
//
// Zones (encounter-enabled):
//   north_pass_zone     — mountain gap, x:780–1140 y:0–360
//   ashenveil_road_zone — eastern corridor to Ashenveil, x:1500–1810 y:400–1010
//   thornwood_zone      — corrupted south-west forest, x:110–590 y:680–1010
//
// Triggers:
//   lumen_town_entrance       — town entrance (gold marker)
//   north_pass_entrance       — scripted boss trigger (crimson marker, flag-gated)
//   ashenveil_road_entrance   — Ashenveil town entrance (gold marker)
//   grove_warden_clearing     — Thornwood optional event (crimson, consumed after win)

import type { WorldMapConfig } from '../../world/types/world-types';
import { STORY_FLAGS } from '../story/story-events';

export const BORDER_FIELDS_CONFIG: WorldMapConfig = {
  mapWidth:  1920,
  mapHeight: 1080,

  // Player spawns on the main road, left side
  playerStartX: 240,
  playerStartY: 528,   // top-left of player rect (player is 28×36, centers at 254,546)

  // ── Solid obstacle rectangles ───────────────────────────────────────────────
  // These are checked by movement-system for AABB collision.
  // They must align with visually impassable areas drawn in WorldMapScene.
  collisionRects: [
    // Left forest wall
    { x: 0,    y: 0,    width: 110,  height: 1080 },
    // Right forest wall
    { x: 1810, y: 0,    width: 110,  height: 1080 },
    // Top mountain range — LEFT of North Pass gap (gap is x 780–1140)
    { x: 0,    y: 0,    width: 780,  height: 200  },
    // Top mountain range — RIGHT of North Pass gap
    { x: 1140, y: 0,    width: 780,  height: 200  },
    // Bottom border strip
    { x: 0,    y: 1010, width: 1920, height: 70   },
  ],

  // ── Scene transition triggers ───────────────────────────────────────────────
  // Overlapping a trigger and pressing E fires the transition in WorldMapScene.
  triggers: [
    {
      id:               'lumen_town_entrance',
      x: 1455, y: 425,
      width:  160,
      height: 160,
      label:            'Enter Lumen Town',
      targetSceneKey:   'TownScene',
      targetLocationId: 'lumen_town',
    },
    {
      id:               'north_pass_entrance',
      x: 893,  y: 90,
      width:  134,
      height: 110,
      label:            'Enter North Pass',
      targetSceneKey:   'BattleScene',
      targetLocationId: 'north_pass',
      // Scripted boss encounter — all story data lives here, not in WorldMapScene.
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
      x: 1600, y: 620,
      width:  160,
      height: 130,
      label:            'Enter Ashenveil',
      targetSceneKey:   'TownScene',
      targetLocationId: 'ashenveil_town',
      // Random encounters fire while walking in ashenveil_road_zone (step-tracker).
      // This trigger is the destination gate — pressing E here enters the town.
    },
    {
      id:               'grove_warden_clearing',
      x: 180, y: 920,
      width:  160,
      height: 80,
      label:            'Investigate Clearing',
      targetSceneKey:   'BattleScene',
      targetLocationId: 'thornwood',
      // Scripted optional encounter — the Grove Warden.
      // No requiresFlag: accessible to anyone who reaches this clearing.
      // consumedByFlag silences the trigger after the first victory.
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
      // Covers the mountain gap and the trigger area above
      x: 780, y: 0, width: 360, height: 360,
    },
    {
      id:          'ashenveil_road_zone',
      displayName: 'Ashenveil Road',
      type:        'encounter',
      // Eastern corridor between Lumen Town and the Ashenveil entrance.
      // Encounter table: ashenveil_road_zone (ashenveil_patrol + support units)
      x: 1500, y: 400, width: 310, height: 610,
    },
    {
      id:          'thornwood_zone',
      displayName: 'Thornwood',
      type:        'encounter',
      // South-west forest strip, below the main road.
      // Reachable by walking south past the road; no trigger required.
      // Encounter table: thornwood_zone (lurkers + corrupted wisps)
      x: 110, y: 680, width: 480, height: 330,
    },
    {
      id:          'border_fields_zone',
      displayName: 'Border Fields',
      type:        'safe',
      // Broad fallback zone covering the whole accessible map
      x: 110, y: 0, width: 1700, height: 1080,
    },
  ],
};
