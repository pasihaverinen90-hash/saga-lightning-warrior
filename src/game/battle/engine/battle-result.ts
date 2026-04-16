// src/game/battle/engine/battle-result.ts
// Determines battle outcome and calculates gold and XP rewards.
// Pure functions — no state mutations, no Phaser.

import type { Combatant, BattleResult, BattleOutcome } from './battle-types';
import { ENEMIES } from '../../data/enemies/enemies';

/**
 * Checks the current combatant state and returns the battle outcome.
 * Called after every action resolves.
 */
export function checkOutcome(combatants: Combatant[]): BattleOutcome {
  const allEnemiesDefeated = combatants
    .filter(c => c.side === 'enemy')
    .every(c => c.isDefeated);

  const allAlliesDefeated = combatants
    .filter(c => c.side === 'ally')
    .every(c => c.isDefeated);

  if (allEnemiesDefeated) return 'victory';
  if (allAlliesDefeated)  return 'defeat';
  return 'ongoing';
}

/**
 * Calculates the final battle result including gold and XP earned.
 * Only meaningful when outcome === 'victory'.
 */
export function buildResult(
  combatants: Combatant[],
  outcome: BattleOutcome,
): BattleResult {
  if (outcome !== 'victory') {
    return { outcome, goldEarned: 0, xpEarned: 0 };
  }

  const defeated = combatants.filter(c => c.side === 'enemy' && c.isDefeated);

  const goldEarned = defeated.reduce((sum, c) => {
    const def = ENEMIES[c.sourceDefId];
    return sum + (def?.goldReward ?? 0);
  }, 0);

  const xpEarned = defeated.reduce((sum, c) => {
    const def = ENEMIES[c.sourceDefId];
    return sum + (def?.xpReward ?? 0);
  }, 0);

  return { outcome, goldEarned, xpEarned };
}
