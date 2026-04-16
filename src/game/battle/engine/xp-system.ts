// src/game/battle/engine/xp-system.ts
// XP reward calculation and level-up processing.
// Pure TypeScript — no Phaser, no state imports.
//
// XP model (matches level-growth.ts):
//   PartyMember.xp = TOTAL lifetime XP (never decreases, never resets).
//   Level is determined by crossing XP thresholds.
//   xp = 350 → level 3 (threshold[3]=250, threshold[4]=450).
//
// XP distribution model:
//   Battle XP is SPLIT among active party members (not given in full to each).
//   splitXp(total, count) distributes the remainder to the first members in
//   party order so the result is deterministic:
//     splitXp(100, 3) → [34, 33, 33]
//
// processMemberXp:
//   Adds xpGained to member.xp, then walks up the threshold table to find
//   the new level and applies stat growth for each level crossed.

import type { Combatant } from './battle-types';
import type { PartyMember } from '../../state/game-state-types';
import { ENEMIES } from '../../data/enemies/enemies';
import {
  xpThresholdCached,
  applyStatGrowth,
  MAX_LEVEL,
} from '../../data/characters/level-growth';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Describes a single member's XP gain and any level-ups that resulted. */
export interface MemberXpResult {
  memberId:     string;
  xpGained:     number;
  levelsGained: number;
  newLevel:     number;
}

// ─── XP reward calculation ────────────────────────────────────────────────────

/**
 * Sums xpReward from all defeated enemy combatants.
 * Uses sourceDefId for a direct ENEMIES lookup.
 */
export function calcXpReward(combatants: Combatant[]): number {
  return combatants
    .filter(c => c.side === 'enemy' && c.isDefeated)
    .reduce((sum, c) => {
      const def = ENEMIES[c.sourceDefId];
      return sum + (def?.xpReward ?? 0);
    }, 0);
}

// ─── XP splitting ─────────────────────────────────────────────────────────────

/**
 * Splits a total XP pool among `count` active members.
 * The integer remainder (total % count) is distributed one extra point to the
 * first `remainder` members, keeping the sum exactly equal to `total`.
 *
 * Examples:
 *   splitXp(100, 2) → [50, 50]
 *   splitXp(100, 3) → [34, 33, 33]
 *   splitXp(7,   3) → [3, 2, 2]
 *
 * Returns an empty array if count ≤ 0 or total ≤ 0.
 */
export function splitXp(total: number, count: number): number[] {
  if (total <= 0 || count <= 0) return [];
  const base      = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

// ─── Level-up processing ──────────────────────────────────────────────────────

/**
 * Applies xpGained to member.xp (cumulative total) and resolves level-ups.
 * Returns the updated PartyMember and a summary of what changed.
 * Pure — does not touch global state.
 */
export function processMemberXp(
  member: PartyMember,
  xpGained: number,
): { updated: PartyMember; result: MemberXpResult } {
  const noChange = {
    updated: member,
    result: { memberId: member.id, xpGained: 0, levelsGained: 0, newLevel: member.level },
  };
  if (xpGained <= 0 || member.level >= MAX_LEVEL) return noChange;

  const totalXp = member.xp + xpGained;
  let   level   = member.level;
  let   stats   = { ...member.stats };
  let   levelsGained = 0;

  // Walk up thresholds until the member no longer qualifies for the next level
  while (level < MAX_LEVEL) {
    const nextThreshold = xpThresholdCached(level + 1);
    if (totalXp < nextThreshold) break;
    level++;
    levelsGained++;
    stats = applyStatGrowth(stats, member.id);
  }

  const updated: PartyMember = { ...member, level, xp: totalXp, stats };
  const result: MemberXpResult = { memberId: member.id, xpGained, levelsGained, newLevel: level };

  return { updated, result };
}
