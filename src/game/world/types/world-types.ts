// src/game/world/types/world-types.ts
// Shared types for the world map layer.
// Pure data shapes — no Phaser or game-logic imports here.

import type { Rect } from '../../shared/movement-system';
export type { Rect };

/**
 * The subset of scene keys that world map triggers can transition to.
 * Using a local union instead of importing from core/scene-keys keeps
 * the data layer free of runtime core dependencies.
 */
export type MapSceneKey = 'TownScene' | 'BattleScene';

/**
 * High-level terrain types used by the world renderer to pick palette
 * for each region rectangle. Data-only — the renderer maps terrain → colours.
 */
export type TerrainKind =
  | 'plains'
  | 'forest'
  | 'corrupted_forest'
  | 'mountain'
  | 'rocky'
  | 'dust'
  | 'sea'
  | 'sand'
  | 'snow'
  | 'blight';

/**
 * Named region on the world map. Used for encounter classification and HUD.
 */
export interface WorldZone extends Rect {
  id: string;
  displayName: string;
  type: 'encounter' | 'safe';
}

/**
 * A rectangular tract of terrain. The renderer paints regions in array order;
 * later regions paint over earlier ones. Regions are visual only — they have
 * no effect on collision (which is driven by `collisionRects`) or encounters
 * (which use `zones`).
 */
export interface WorldRegion extends Rect {
  id: string;
  displayName?: string;
  terrainKind: TerrainKind;
}

/**
 * A road drawn as a polyline between waypoints. Width is in pixels.
 */
export interface WorldRoad {
  id: string;
  points: Array<{ x: number; y: number }>;
  width: number;
  style: 'dirt' | 'stone' | 'wood';
}

/**
 * A river drawn as a polyline between waypoints. Decorative unless paired
 * with collisionRects in the world config.
 */
export interface WorldRiver {
  id: string;
  points: Array<{ x: number; y: number }>;
  width: number;
}

export type LandmarkKind =
  | 'village' | 'town' | 'capital'
  | 'port'    | 'gate' | 'shrine'
  | 'ruin'    | 'fortress' | 'citadel'
  | 'island'  | 'dungeon';

/**
 * Visual landmark on the world map: town, port, dungeon, island, etc.
 * Provides a sprite-ish footprint and label only — interactions still go
 * through `WorldTrigger`s. Landmarks are not collision; the player walks freely.
 */
export interface WorldLandmark {
  id: string;
  x: number; y: number;
  width: number; height: number;
  kind: LandmarkKind;
  label?: string;
}

/**
 * Placeholder data for a ferry / sea route. Not wired into gameplay yet —
 * exists so a future ferry menu can be data-driven.
 */
export interface SeaRoute {
  id: string;
  fromTriggerId: string;
  toX: number;
  toY: number;
  requiresFlag?: string;
}

/**
 * Placeholder data for a fast-travel node. Not wired into gameplay yet.
 */
export interface FastTravelNode {
  id: string;
  x: number; y: number;
  displayName: string;
  requiresFlag?: string;
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
 * interaction prompt. On confirmation, the scene transitions to
 * targetSceneKey and records targetLocationId in game state.
 *
 * If scriptedBattle is present, targetSceneKey must be 'BattleScene'
 * and the battle is driven entirely by scriptedBattle's data.
 * Random encounters always go through the zone step-tracker, never triggers.
 */
export interface WorldTrigger extends Rect {
  id: string;
  label: string;
  targetSceneKey: MapSceneKey;
  targetLocationId: string;
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
  /** Interaction triggers (town entrances, scripted battle entry, etc.). */
  triggers: WorldTrigger[];
  /**
   * Named zones for encounter tracking and HUD display.
   * List more-specific zones before broader fallback zones.
   */
  zones: WorldZone[];

  // ── Visual / structural layers (all optional, consumed by world-renderer) ──
  regions?: WorldRegion[];
  roads?: WorldRoad[];
  rivers?: WorldRiver[];
  landmarks?: WorldLandmark[];

  // ── Future expansion (placeholder data only, not yet wired up) ──
  seaRoutes?: SeaRoute[];
  fastTravelNodes?: FastTravelNode[];
}

/** Optional data passed to WorldMapScene.init() when returning from another scene. */
export interface WorldMapInitData {
  returnX?: number;
  returnY?: number;
  returnLocationId?: string;
}
