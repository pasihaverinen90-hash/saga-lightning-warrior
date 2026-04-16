// src/game/battle/engine/enemy-ai.ts
// Selects an action for an enemy combatant.
// Pure TypeScript — no Phaser, no state imports.
// Intentionally simple: attack most of the time, use a skill when available.
// Can be extended later without touching other engine files.

import type { Combatant, BattleCommand } from './battle-types';
import { SKILLS } from '../../data/skills/skills';

/**
 * Picks a BattleCommand for the given enemy combatant.
 *
 * Priority:
 *   1. Use a skill if available, enough MP, and random roll succeeds (30%).
 *   2. Otherwise attack a random living ally.
 */
export function pickEnemyAction(
  enemy:   Combatant,
  allies:  Combatant[],
): BattleCommand {
  const livingAllies = allies.filter(a => !a.isDefeated);
  if (livingAllies.length === 0) {
    // No valid targets — defend as fallback (engine will handle it gracefully)
    return { type: 'defend', actorId: enemy.id };
  }

  // Try to use a skill (30% chance when skill is affordable)
  const usableSkills = enemy.skillIds.filter(id => {
    const skill = SKILLS[id];
    return skill && enemy.currentMP >= skill.mpCost;
  });

  if (usableSkills.length > 0 && Math.random() < 0.30) {
    const skillId = usableSkills[Math.floor(Math.random() * usableSkills.length)];
    const target  = pickRandomTarget(livingAllies);

    // For multi-target skills, primary target doesn't matter —
    // battle-actions.ts will fan out to all allies automatically.
    return {
      type:    'skill',
      actorId: enemy.id,
      skillId,
      targetId: target.id,
    };
  }

  // Default: physical attack on a random living ally
  return {
    type:     'attack',
    actorId:  enemy.id,
    targetId: pickRandomTarget(livingAllies).id,
  };
}

function pickRandomTarget(targets: Combatant[]): Combatant {
  return targets[Math.floor(Math.random() * targets.length)];
}
