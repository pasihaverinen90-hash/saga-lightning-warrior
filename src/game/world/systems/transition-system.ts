// src/game/world/systems/transition-system.ts
// Pure TypeScript. Checks whether the player is overlapping a world trigger.
// Does NOT perform scene transitions — that responsibility stays in the scene.
// All functions work on top-left entity coordinates.

import type { WorldTrigger } from '../types/world-types';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function overlaps(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Returns the first trigger the entity overlaps, or null.
 * Triggers are evaluated in array order.
 */
export function getActiveTrigger(
  entityX: number,
  entityY: number,
  entityW: number,
  entityH: number,
  triggers: WorldTrigger[],
): WorldTrigger | null {
  for (const trigger of triggers) {
    if (
      overlaps(
        entityX, entityY, entityW, entityH,
        trigger.x, trigger.y, trigger.width, trigger.height,
      )
    ) {
      return trigger;
    }
  }
  return null;
}
