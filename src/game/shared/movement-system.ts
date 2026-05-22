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

/** Returns true if the proposed top-left position overlaps any rect. */
function blockedAt(
  x: number, y: number, w: number, h: number,
  rects: Rect[],
): boolean {
  for (const r of rects) {
    if (overlapsRect(x, y, w, h, r)) return true;
  }
  return false;
}

const INV_SQRT2 = 0.70710678;

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Computes the new position for an entity given movement input, speed, delta,
 * map bounds, and a list of solid collision rectangles.
 *
 * Uses axis-separated collision so entities can slide along walls. When one
 * axis is blocked while moving diagonally, the unblocked axis is re-attempted
 * at FULL (un-normalised) speed — without this, sliding along a wall feels
 * about 30% slower than cardinal movement.
 *
 * @param px        Current top-left X
 * @param py        Current top-left Y
 * @param input     Which direction keys are held this frame
 * @param speed     Movement speed in pixels per second
 * @param delta     Frame delta in milliseconds (callers should clamp this to
 *                  avoid teleport-jumps after frame drops or tab-switches)
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

  const moving   = dx !== 0 || dy !== 0;
  const diagonal = dx !== 0 && dy !== 0;
  const moveStep = speed * dt;
  // Normalised step for diagonal — equal speed in all directions when unblocked.
  const normStep = diagonal ? moveStep * INV_SQRT2 : moveStep;

  // ── First pass: try both axes at the normalised step ──────────────────────
  const maxX = mapWidth  - entityW;
  const maxY = mapHeight - entityH;

  let nextX = Math.max(0, Math.min(maxX, px + dx * normStep));
  let blockedX = false;
  if (nextX !== px && blockedAt(nextX, py, entityW, entityH, collisionRects)) {
    blockedX = true;
    nextX = px;
  }

  let nextY = Math.max(0, Math.min(maxY, py + dy * normStep));
  let blockedY = false;
  if (nextY !== py && blockedAt(nextX, nextY, entityW, entityH, collisionRects)) {
    blockedY = true;
    nextY = py;
  }

  // ── Wall-slide pass: if diagonal and exactly one axis is blocked, retry the
  //    free axis at FULL (un-normalised) speed. This restores 100% sliding
  //    speed along walls instead of the 70.7% the first pass produces.
  if (diagonal && blockedX !== blockedY) {
    if (blockedX) {
      const fullY = Math.max(0, Math.min(maxY, py + dy * moveStep));
      if (fullY !== py && !blockedAt(nextX, fullY, entityW, entityH, collisionRects)) {
        nextY = fullY;
      }
    } else {
      const fullX = Math.max(0, Math.min(maxX, px + dx * moveStep));
      if (fullX !== px && !blockedAt(fullX, py, entityW, entityH, collisionRects)) {
        nextX = fullX;
      }
    }
  }

  return { x: nextX, y: nextY, blockedX, blockedY, moving };
}
