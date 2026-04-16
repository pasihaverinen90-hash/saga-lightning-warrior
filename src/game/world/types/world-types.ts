// src/game/world/types/world-types.ts
// Shared types for the world map layer.
// Pure data shapes — no Phaser or game-logic imports here.

// Rect is defined in shared/movement-system.ts (the module that uses it most).
// Imported here for local use in interface declarations, and re-exported for consumers.
import type { Rect } from '../../shared/movement-system';
export type { Rect };

/**
 * The subset of scene keys that world map triggers can transition to.
 * Using a local union instead of importing from core/scene-keys keeps
 * the data layer free of runtime core dependencies.
 */
export type MapSceneKey = 'TownScene' | 'BattleScene';

/**
 * A named region on the world map that classifies whether encounters
 * can happen inside it. Multiple zones can be defined per map.
 * More specific zones should be listed before broader fallback zones
 * so getActiveZone returns the right result on overlap.
 */
export interface WorldZone extends Rect {
  id: string;
  displayName: string;
  type: 'encounter' | 'safe';
}

/**
 * Data for a scripted (story) battle attached to a trigger.
 * All fields mirror BattleInitData — the trigger carries the full spec
 * so WorldMapScene never has to hardcode boss-specific values.
 *
 * Guard rules (checked before transitioning):
 *   requiresFlag   — trigger silently does nothing until this flag is true.
 *   consumedByFlag — trigger silently does nothing once this flag is true.
 */
export interface ScriptedBattle {
  enemyIds: string[];
  backgroundColorHex: string;
  introDialogueId?: string;
  outroDialogueId?: string;
  isBoss?: boolean;
  /** Story flag that must be set before this trigger activates. */
  requiresFlag?: string;
  /** Story flag that, once set, prevents this trigger from re-activating. */
  consumedByFlag?: string;
}

/**
 * An invisible area that, when overlapped by the player, surfaces an
 * interaction prompt. On confirmation (E key), the scene transitions
 * to targetSceneKey and records targetLocationId in game state.
 *
 * If scriptedBattle is present, targetSceneKey must be 'BattleScene'
 * and the battle is driven entirely by scriptedBattle's data.
 * Random encounters always go through the zone step-tracker, never triggers.
 */
export interface WorldTrigger extends Rect {
  id: string;
  label: string;
  /** Scene to transition to. Use the MapSceneKey union — not raw strings. */
  targetSceneKey: MapSceneKey;
  targetLocationId: string;
  /** If set, this trigger launches a scripted battle rather than a scene transition. */
  scriptedBattle?: ScriptedBattle;
}

/** Full configuration for one world map area. Data-only, no logic. */
export interface WorldMapConfig {
  mapWidth: number;
  mapHeight: number;
  playerStartX: number;
  playerStartY: number;
  /** Solid rectangles the player cannot walk through. */
  collisionRects: Rect[];
  /** Interaction triggers (town entrances, route entrances, etc.). */
  triggers: WorldTrigger[];
  /**
   * Named zones for encounter tracking and HUD display.
   * List more-specific zones before broader fallback zones.
   */
  zones: WorldZone[];
}

/** Optional data passed to WorldMapScene.init() when returning from another scene. */
export interface WorldMapInitData {
  returnX?: number;
  returnY?: number;
  returnLocationId?: string;
}
