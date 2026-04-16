// src/game/shared/movement-system.ts
// Pure TypeScript movement and collision module.
// No Phaser imports — used by both WorldMapScene and TownScene.
//
// Coordinate convention: x/y always refer to the TOP-LEFT of the entity rect.
// Phaser scenes must convert from center-origin game objects before calling here.

// ─── Types ────────────────────────────────────────────────────────────────────

/** A 2D axis-aligned rectangle (top-left origin). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MovementInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface MovementResult {
  x: number;
  y: number;
  /** True if horizontal movement was blocked this frame. */
  blockedX: boolean;
  /** True if vertical movement was blocked this frame. */
  blockedY: boolean;
  /** True if any movement key was held. */
  moving: boolean;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Axis-aligned rectangle overlap test (top-left coordinates). */
function overlapsRect(
  ax: number, ay: number, aw: number, ah: number,
  b: Rect
): boolean {
  return ax < b.x + b.width
    && ax + aw > b.x
    && ay < b.y + b.height
    && ay + ah > b.y;
}

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Computes the new position for an entity given movement input, speed, delta,
 * map bounds, and a list of solid collision rectangles.
 *
 * Uses axis-separated collision so entities can slide along walls rather
 * than stopping dead on diagonal contact.
 *
 * @param px        Current top-left X
 * @param py        Current top-left Y
 * @param input     Which direction keys are held this frame
 * @param speed     Movement speed in pixels per second
 * @param delta     Frame delta in milliseconds (from Phaser update)
 * @param mapWidth  Hard boundary: entity cannot exceed this width
 * @param mapHeight Hard boundary: entity cannot exceed this height
 * @param entityW   Entity width in pixels
 * @param entityH   Entity height in pixels
 * @param collisionRects  Solid obstacle rectangles
 */
export function computeMovement(
  px: number,
  py: number,
  input: MovementInput,
  speed: number,
  delta: number,
  mapWidth: number,
  mapHeight: number,
  entityW: number,
  entityH: number,
  collisionRects: Rect[],
): MovementResult {
  const dt = delta / 1000; // ms → seconds

  let dx = 0;
  let dy = 0;

  if (input.left)  dx -= 1;
  if (input.right) dx += 1;
  if (input.up)    dy -= 1;
  if (input.down)  dy += 1;

  const moving = dx !== 0 || dy !== 0;

  // Normalise diagonal so speed is equal in all directions
  if (dx !== 0 && dy !== 0) {
    const INV_SQRT2 = 0.70710678;
    dx *= INV_SQRT2;
    dy *= INV_SQRT2;
  }

  // ── X axis ──────────────────────────────────────────────────────────────────
  let nextX = px + dx * speed * dt;
  // Clamp to map boundary
  nextX = Math.max(0, Math.min(mapWidth - entityW, nextX));

  let blockedX = false;
  for (const rect of collisionRects) {
    if (overlapsRect(nextX, py, entityW, entityH, rect)) {
      blockedX = true;
      nextX = px; // reject X, keep original
      break;
    }
  }

  // ── Y axis (uses resolved nextX for corner-hugging) ──────────────────────
  let nextY = py + dy * speed * dt;
  nextY = Math.max(0, Math.min(mapHeight - entityH, nextY));

  let blockedY = false;
  for (const rect of collisionRects) {
    if (overlapsRect(nextX, nextY, entityW, entityH, rect)) {
      blockedY = true;
      nextY = py;
      break;
    }
  }

  return { x: nextX, y: nextY, blockedX, blockedY, moving };
}
