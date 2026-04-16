// src/game/data/equipment/equipment-system.ts
// Pure TypeScript. Resolves equipment bonuses into effective stats.
// No Phaser, no state imports.
//
// Design:
//   PartyMember.stats holds BASE stats (level-up gains applied, no equipment).
//   Equipment bonuses are added on top at resolution time.
//   Battle combatants are built from resolveEffectiveStats(), so equipment
//   is automatically reflected in all damage calculations via Combatant.attack
//   and Combatant.defense without any changes to damage.ts.

import type { PartyMember, CharacterStats } from '../../state/game-state-types';
import { EQUIPMENT } from './equipment';

/**
 * Returns the total flat bonuses from all equipped items on a party member.
 * Returns zeroes for unequipped slots.
 */
export function getEquippedBonuses(member: PartyMember): Required<{
  maxHP: number; maxMP: number;
  attack: number; magic: number; defense: number; speed: number;
}> {
  const totals = { maxHP: 0, maxMP: 0, attack: 0, magic: 0, defense: 0, speed: 0 };

  const { weapon, armor } = member.equipment;
  for (const id of [weapon, armor]) {
    if (!id) continue;
    const def = EQUIPMENT[id];
    if (!def) continue;
    const b = def.bonuses;
    if (b.maxHP)    totals.maxHP    += b.maxHP;
    if (b.maxMP)    totals.maxMP    += b.maxMP;
    if (b.attack)   totals.attack   += b.attack;
    if (b.magic)    totals.magic    += b.magic;
    if (b.defense)  totals.defense  += b.defense;
    if (b.speed)    totals.speed    += b.speed;
  }

  return totals;
}

/**
 * Returns a CharacterStats object with equipment bonuses applied on top of
 * the member's base stats.
 *
 * currentHP and currentMP are clamped to the new maxes so they never exceed
 * the effective maximum (important when armor raises maxHP).
 *
 * Pure — does not mutate the member.
 */
export function resolveEffectiveStats(member: PartyMember): CharacterStats {
  const base    = member.stats;
  const bonuses = getEquippedBonuses(member);

  const newMaxHP = base.maxHP + bonuses.maxHP;
  const newMaxMP = base.maxMP + bonuses.maxMP;

  return {
    maxHP:     newMaxHP,
    currentHP: Math.min(base.currentHP, newMaxHP),
    maxMP:     newMaxMP,
    currentMP: Math.min(base.currentMP, newMaxMP),
    attack:    Math.max(0, base.attack  + bonuses.attack),
    magic:     Math.max(0, base.magic   + bonuses.magic),
    defense:   Math.max(0, base.defense + bonuses.defense),
    speed:     Math.max(1, base.speed   + bonuses.speed),
  };
}
