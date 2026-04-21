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

// ─── Town visual layout ───────────────────────────────────────────────────────

/**
 * Per-town visual layout data consumed by TownScene's draw methods.
 * All positions are world-space pixels. Moving values here (rather than
 * hardcoding them in TownScene) lets each town define its own visual layout
 * without modifying the shared scene.
 *
 * TownScene derives all building sub-elements (roofs, doors, windows, signs)
 * from the four body rects below, so only the body rect needs to change when
 * repositioning a building.
 */
export interface TownVisualLayout {
  /** Lighter-coloured central area drawn behind the road and plaza. */
  plaza:    Rect;
  /** Main stone road running left-to-right. */
  road:     Rect;
  /** Vertical cobblestone path connecting the road to the south exit. */
  exitPath: Rect;

  /** Inn building body rect (top-left origin, full body w×h). */
  inn:  Rect;
  /** Shop building body rect. */
  shop: Rect;
  /** Central hall building body rect. */
  hall: Rect;
  /** Text label rendered above the hall entrance. */
  hallLabel: string;

  /** X centres of lamp posts. Y is derived as road.y − 60. */
  lampPostsX: number[];
  /** Fence post strip along the road's north edge. Omit for towns without roadside fencing. */
  fencePosts?: { startX: number; endX: number; y: number; step: number };
  /** [x, y] centres of red flower decoration circles. */
  redFlowers:  Array<[number, number]>;
  /** [x, y] centres of blue flower decoration circles. */
  blueFlowers: Array<[number, number]>;
  /** [x, y] centres of barrel decoration circles near the inn. */
  barrels: Array<[number, number]>;

  // ── Optional city-scale features ───────────────────────────────────────────
  /** Large landmark building drawn north of the main plaza (e.g. mansion). */
  mansion?: { x: number; y: number; width: number; height: number; label: string };
  /** Decorative gate arch drawn over the south exit gap. */
  cityGate?: { wallY: number; gateX: number; gateWidth: number };
  /** Decorative fountain centre position. */
  fountain?: { x: number; y: number };
  /** [x, y] centres for tree decorations. */
  trees?: Array<[number, number]>;
  /** [x, y] centres for market stall decorations. */
  marketStalls?: Array<[number, number]>;
  /** Absolute [cx, topY] lamp post positions (bypasses road.y-60 offset). */
  lampPosts?: Array<[number, number]>;
  /** Extra road/avenue rectangles textured like the main road. */
  additionalRoads?: Array<{ x: number; y: number; width: number; height: number }>;
  /** Decorative building fronts forming city blocks (no interactable). */
  extraBuildings?: Array<{ x: number; y: number; width: number; height: number; colorBody: number; colorRoof: number; label?: string; style?: 'standard' | 'tall' | 'wide' }>;
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
  /** Per-town visual layout consumed by TownScene draw methods. */
  layout: TownVisualLayout;
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
