// src/game/battle/engine/battle-actions.ts
// Resolves a BattleCommand into a BattleEvent log and mutates combatant state.
// This is the core of the battle engine: one function per command type,
// all returning a BattleEvent[] that the scene uses for feedback display.
//
// State mutation happens here (currentHP, currentMP, isDefending, isDefeated).
// The scene never mutates combatants directly.

import type {
  Combatant,
  BattleCommand,
  BattleEvent,
} from './battle-types';
import { calcAttackDamage, calcSkillDamage, calcItemHeal } from './damage';
import { SKILLS } from '../../data/skills/skills';
import { ITEMS } from '../../data/items/items';

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Resolves a command for one combatant.
 * Mutates the relevant combatants in the `combatants` array.
 * Returns a BattleEvent[] describing what happened, for the scene to display.
 */
export function resolveAction(
  command:    BattleCommand,
  combatants: Combatant[],
): BattleEvent[] {
  // Clear the actor's defending status at the start of their action
  // (it was applied on their previous turn and has done its job).
  const actor = findById(combatants, command.actorId);
  if (!actor || actor.isDefeated) return [];

  if (actor.isDefending && command.type !== 'defend') {
    actor.isDefending = false;
  }

  switch (command.type) {
    case 'attack':  return resolveAttack(command.actorId, command.targetId, combatants);
    case 'skill':   return resolveSkill(command.actorId, command.skillId, command.targetId, combatants);
    case 'item':    return resolveItem(command.actorId, command.itemId, command.targetId, combatants);
    case 'defend':  return resolveDefend(command.actorId, combatants);
  }
}

// ─── Command resolvers ────────────────────────────────────────────────────────

function resolveAttack(
  actorId:    string,
  targetId:   string,
  combatants: Combatant[],
): BattleEvent[] {
  const actor  = findById(combatants, actorId);
  const target = findById(combatants, targetId);
  if (!actor || !target || target.isDefeated) return [{ kind: 'no_target' }];

  const damage = calcAttackDamage(actor, target);
  applyDamage(target, damage);

  const events: BattleEvent[] = [
    { kind: 'damage', targetId, amount: damage, element: 'none', isCrit: false },
  ];
  if (target.isDefeated) events.push({ kind: 'defeated', targetId });
  return events;
}

function resolveSkill(
  actorId:    string,
  skillId:    string,
  targetId:   string,
  combatants: Combatant[],
): BattleEvent[] {
  const actor = findById(combatants, actorId);
  const skill = SKILLS[skillId];
  if (!actor || !skill) return [];

  // MP check
  if (actor.currentMP < skill.mpCost) {
    // Not enough MP — fall back to a basic attack silently
    return resolveAttack(actorId, targetId, combatants);
  }

  actor.currentMP -= skill.mpCost;
  const events: BattleEvent[] = [
    { kind: 'mp_cost', actorId, amount: skill.mpCost },
  ];

  // Determine targets
  const targets = resolveTargets(skill.targetType, targetId, actor.side, combatants);
  if (targets.length === 0) return [...events, { kind: 'no_target' }];

  for (const target of targets) {
    const damage = calcSkillDamage(actor, target, skill);
    applyDamage(target, damage);
    events.push({ kind: 'damage', targetId: target.id, amount: damage, element: skill.element, isCrit: false });
    if (target.isDefeated) events.push({ kind: 'defeated', targetId: target.id });
  }

  return events;
}

function resolveItem(
  _actorId:   string,
  itemId:     string,
  targetId:   string,
  combatants: Combatant[],
): BattleEvent[] {
  const item   = ITEMS[itemId];
  const target = findById(combatants, targetId);
  if (!item || !target || target.isDefeated) return [{ kind: 'no_target' }];

  const events: BattleEvent[] = [];

  let hpRestored = 0;
  let mpRestored = 0;

  if (item.effect.restoreHP) {
    const heal = calcItemHeal(item.effect.restoreHP);
    hpRestored = Math.min(heal, target.maxHP - target.currentHP);
    target.currentHP = Math.min(target.maxHP, target.currentHP + hpRestored);
  }

  if (item.effect.restoreMP) {
    const restore = calcItemHeal(item.effect.restoreMP);
    mpRestored = Math.min(restore, target.maxMP - target.currentMP);
    target.currentMP = Math.min(target.maxMP, target.currentMP + mpRestored);
  }

  events.push({ kind: 'heal', targetId, hpRestored, mpRestored });
  return events;
}

function resolveDefend(
  actorId:    string,
  combatants: Combatant[],
): BattleEvent[] {
  const actor = findById(combatants, actorId);
  if (!actor) return [];
  actor.isDefending = true;
  return [{ kind: 'defend', actorId }];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findById(combatants: Combatant[], id: string): Combatant | undefined {
  return combatants.find(c => c.id === id);
}

function applyDamage(target: Combatant, amount: number): void {
  target.currentHP = Math.max(0, target.currentHP - amount);
  if (target.currentHP === 0) target.isDefeated = true;
}

function resolveTargets(
  targetType: string,
  primaryTargetId: string,
  actorSide: string,
  combatants: Combatant[],
): Combatant[] {
  switch (targetType) {
    case 'single_enemy':
      return combatants.filter(c => c.id === primaryTargetId && !c.isDefeated);

    case 'all_enemies': {
      const oppositeSide = actorSide === 'ally' ? 'enemy' : 'ally';
      return combatants.filter(c => c.side === oppositeSide && !c.isDefeated);
    }

    case 'single_ally':
      return combatants.filter(c => c.id === primaryTargetId && !c.isDefeated);

    case 'all_allies':
      return combatants.filter(c => c.side === actorSide && !c.isDefeated);

    default:
      return [];
  }
}
