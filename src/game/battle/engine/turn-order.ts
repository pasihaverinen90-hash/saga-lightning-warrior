// src/game/battle/engine/turn-order.ts
// Pure function: takes a list of Combatants and returns the turn order.
// Speed determines position; ties are broken by side (allies first) then id.
// Dead combatants are excluded. The engine calls this at the start of each
// round to rebuild the queue from the current battle state.

import type { Combatant } from './battle-types';

/**
 * Returns a new array of living combatant IDs ordered from fastest to slowest.
 * Call at the start of each round — do not cache across rounds.
 */
export function buildTurnOrder(combatants: Combatant[]): string[] {
  return combatants
    .filter(c => !c.isDefeated)
    .sort((a, b) => {
      // Primary: higher speed goes first
      if (b.speed !== a.speed) return b.speed - a.speed;
      // Tiebreak 1: allies before enemies (consistent feel)
      if (a.side !== b.side) return a.side === 'ally' ? -1 : 1;
      // Tiebreak 2: alphabetical id (deterministic)
      return a.id.localeCompare(b.id);
    })
    .map(c => c.id);
}

/**
 * Returns the next living combatant id from the queue.
 * Skips any combatants that have since been defeated (e.g. killed mid-round).
 * Returns null if no living combatants remain in the queue.
 */
export function nextInQueue(
  queue: string[],
  combatants: Combatant[],
): string | null {
  const aliveIds = new Set(
    combatants.filter(c => !c.isDefeated).map(c => c.id),
  );
  return queue.find(id => aliveIds.has(id)) ?? null;
}
