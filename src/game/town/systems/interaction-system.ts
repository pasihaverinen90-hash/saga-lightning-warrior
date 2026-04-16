// src/game/town/systems/interaction-system.ts
// Pure TypeScript. No Phaser dependencies.
// Determines which interactable (if any) the player is close enough to activate.
// Reusable in any scene that has an Interactable list.

import type { Interactable } from '../types/town-types';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Euclidean distance between two center points. */
function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Returns the closest interactable within activation range, or null.
 *
 * Uses the player's center point for distance measurement.
 * If multiple interactables are in range, the nearest wins.
 *
 * @param playerX     Top-left X of the player rect
 * @param playerY     Top-left Y of the player rect
 * @param playerW     Player width in pixels
 * @param playerH     Player height in pixels
 * @param interactables  All interactables to check
 */
export function getNearbyInteractable(
  playerX: number,
  playerY: number,
  playerW: number,
  playerH: number,
  interactables: Interactable[],
): Interactable | null {
  const cx = playerX + playerW / 2;
  const cy = playerY + playerH / 2;

  let nearest: Interactable | null = null;
  let nearestDist = Infinity;

  for (const item of interactables) {
    const d = dist(cx, cy, item.x, item.y);
    if (d <= item.activationRadius && d < nearestDist) {
      nearest = item;
      nearestDist = d;
    }
  }

  return nearest;
}

/**
 * Returns true if the player's center is within the exit rect.
 * The exit uses a rectangle overlap rather than radius, matching the
 * WorldMapScene trigger pattern so behaviour feels consistent.
 */
export function isInExitZone(
  playerX: number,
  playerY: number,
  playerW: number,
  playerH: number,
  exitX: number,
  exitY: number,
  exitW: number,
  exitH: number,
): boolean {
  // Center-point test (same as encounter-system.ts)
  const cx = playerX + playerW / 2;
  const cy = playerY + playerH / 2;
  return cx >= exitX && cx <= exitX + exitW && cy >= exitY && cy <= exitY + exitH;
}
