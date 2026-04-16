// src/game/battle/engine/damage.ts
// Pure damage calculation functions. No state mutations here.
// All functions take inputs and return numbers — the caller mutates the state.

import type { Combatant } from './battle-types';
import type { SkillDef } from '../../data/skills/skills';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Defend reduces incoming damage to this fraction. */
const DEFEND_MULTIPLIER = 0.5;

/** Mild random variance applied to all damage: ±10%. */
const VARIANCE = 0.10;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns a variance multiplier in [1 - VARIANCE, 1 + VARIANCE]. */
function rollVariance(): number {
  return 1 + (Math.random() * VARIANCE * 2 - VARIANCE);
}

/**
 * Applies defense mitigation.
 * Formula: raw - (defense * 0.5), floored at 1.
 * Keeps defense meaningful without making enemies invulnerable.
 */
function mitigateDefense(raw: number, defense: number): number {
  return Math.max(1, Math.round(raw - defense * 0.5));
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Calculates physical attack damage from attacker → target.
 * Returns the final damage value (already floored, minimum 1).
 */
export function calcAttackDamage(attacker: Combatant, target: Combatant): number {
  const raw = attacker.attack * rollVariance();
  const mitigated = mitigateDefense(raw, target.isDefending
    ? target.defense * (1 / DEFEND_MULTIPLIER)   // defender's defense is amplified
    : target.defense);
  return mitigated;
}

/**
 * Calculates skill damage from caster → target.
 *
 * Stat routing priority:
 *   1. skill.scalingStat — explicit override in the skill definition.
 *   2. element heuristic — magic for elemental skills, attack for element:'none'.
 *
 * The override exists for skills where element and scaling intent diverge:
 * e.g. a fire-element physical attack (flame_cleave → attack) or a
 * no-element magical burst (wisp_flare → magic).
 */
export function calcSkillDamage(
  caster: Combatant,
  target: Combatant,
  skill: SkillDef,
): number {
  // Resolve which stat to scale from
  let baseStat: number;
  if (skill.scalingStat === 'attack') {
    baseStat = caster.attack;
  } else if (skill.scalingStat === 'magic') {
    baseStat = caster.magic;
  } else {
    // Fallback heuristic: elemental skills → magic, non-elemental → attack
    baseStat = skill.element !== 'none' ? caster.magic : caster.attack;
  }

  const raw = baseStat * skill.power * rollVariance();
  const defense = target.isDefending
    ? target.defense * (1 / DEFEND_MULTIPLIER)
    : target.defense;
  return mitigateDefense(raw, defense);
}

/**
 * Returns the HP-restore amount for an item effect.
 * Always ≥ 0; capped to target's missing HP by the caller.
 */
export function calcItemHeal(restoreAmount: number): number {
  return Math.max(0, restoreAmount);
}
