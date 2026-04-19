// src/game/town/types/town-types.ts
// Data shapes for the town layer.
// Pure types — no Phaser or logic imports.

import type { Rect } from '../../world/types/world-types';

// ─── Interactable ─────────────────────────────────────────────────────────────

/**
 * What kind of object an interactable represents.
 * The scene switches on this to decide what to do when E is pressed.
 */
export type InteractableType =
  | 'npc'
  | 'building_inn'
  | 'building_shop'
  | 'save_crystal'
  | 'sign';

/**
 * A dialogue override: if a given story flag is set, use a different dialogue
 * sequence instead of the default. The first matching override wins.
 */
export interface DialogueOverride {
  requiredFlag: string;
  dialogueId: string;
}

/**
 * An object in the town that the player can interact with by pressing E when
 * they are within `activationRadius` pixels (center-to-center).
 */
export interface Interactable {
  id: string;
  type: InteractableType;
  /** World-space center of the interactable (for range checks and rendering). */
  x: number;
  y: number;
  /** Pixel radius within which E activates this interactable. */
  activationRadius: number;
  /** Label shown in the bottom-center interaction hint. */
  label: string;
  /** Default dialogue sequence ID (for 'npc' and 'sign' types). */
  dialogueId?: string;
  /**
   * Story-flag-based overrides checked before defaulting to dialogueId.
   * First entry whose flag is set in game state wins.
   */
  dialogueOverrides?: DialogueOverride[];
  /**
   * If set, this interactable is hidden entirely (not drawn, not activatable)
   * once the named story flag is set. Use for recruitable NPCs that should
   * disappear from the map after joining the party.
   */
  hideWhenFlag?: string;
}

// ─── Town map configuration ───────────────────────────────────────────────────

/**
 * Exit trigger: the player walks into this rect and is returned to the world map.
 * No key press required — contact is enough (same pattern as WorldZone entry).
 */
export interface TownExit extends Rect {
  /** Location ID to record in game state when exiting. */
  targetLocationId: string;
  /** Where to place the player on the world map (top-left of player rect). */
  worldReturnX: number;
  worldReturnY: number;
}

/** Full data-only layout definition for one town. */
export interface TownMapConfig {
  /** Human-readable name shown in the HUD location label. */
  displayName: string;
  mapWidth: number;
  mapHeight: number;
  /** Default player spawn (top-left) when entering from world map. */
  playerEntryX: number;
  playerEntryY: number;
  collisionRects: Rect[];
  interactables: Interactable[];
  exit: TownExit;
  /**
   * Ordered list of item IDs stocked in this town's shop.
   * TownScene reads this and passes each ID to shop-service functions.
   * Keeping stock here means adding a new town requires no changes to shop-service.
   */
  shopStock: string[];
}

// ─── Scene init data ──────────────────────────────────────────────────────────

/** Passed from WorldMapScene to TownScene.init(). */
export interface TownInitData {
  /**
   * Location ID of the destination, used to select the correct TownMapConfig.
   * Matches WorldTrigger.targetLocationId from the world map.
   */
  locationId?: string;
  /** Optional entry position for scripted town entries. Not yet used by TownScene. */
  fromWorldX?: number;
  fromWorldY?: number;
  /**
   * Optional in-town resume position (top-left of player rect).
   * Set by scene-router.ts when loading a save whose currentLocation is a town.
   * When omitted, TownScene falls back to the config's playerEntryX/Y.
   */
  startX?: number;
  startY?: number;
}
