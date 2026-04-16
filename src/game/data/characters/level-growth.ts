// src/game/data/characters/level-growth.ts
// XP thresholds, per-character stat growth profiles, and stat-growth helpers.
// Pure data and pure functions — no Phaser, no state imports.
//
// XP model:
//   PartyMember.xp = TOTAL lifetime XP earned (never decreases).
//   A character is at the level whose threshold they have crossed.
//   Level = highest L such that xp >= XP_THRESHOLDS[L].
//   XP_THRESHOLDS[1] = 0 (everyone starts at level 1).
//
// Example:
//   xp = 0    → level 1  (0  >= 0,   below 100)
//   xp = 100  → level 2  (100 >= 100, below 250)
//   xp = 350  → level 3  (350 >= 250, below 450)
//
// Stat growth:
//   Flat gains per level-up, defined per character id.
//   currentHP and currentMP are healed to new maximums on level-up.

import type { CharacterStats } from '../../state/game-state-types';

// ─── XP threshold table ───────────────────────────────────────────────────────

export const MAX_LEVEL = 99;

/**
 * XP_THRESHOLDS[L] = total XP needed to reach level L.
 * Index 1 = level 1, index 2 = level 2, etc.
 * Levels beyond the explicit table use a generated formula.
 */
const EXPLICIT_THRESHOLDS: Record<number, number> = {
   1:     0,
   2:   100,
   3:   250,
   4:   450,
   5:   750,
   6:  1200,
   7:  1800,
   8:  2600,
   9:  3600,
  10:  5000,
};

/**
 * Returns the total XP needed to reach `level`.
 * Levels 1–10 use the explicit table above.
 * Levels 11+ extend from level 10 with a rising formula:
 *   threshold(L) = threshold(L-1) + L * 300
 * This gives roughly: 5000 + 3300 + 3600 + … for levels 11, 12, 13…
 */
export function xpThreshold(level: number): number {
  if (level <= 1)  return 0;
  if (level > MAX_LEVEL) return Infinity;
  if (EXPLICIT_THRESHOLDS[level] !== undefined) return EXPLICIT_THRESHOLDS[level];

  // Generate beyond level 10 recursively (memoised via cache below)
  return xpThreshold(level - 1) + level * 300;
}

// Simple memoisation for levels 11+ so repeated calls in level-up loops are O(1)
const _cache: Record<number, number> = { ...EXPLICIT_THRESHOLDS };
export function xpThresholdCached(level: number): number {
  if (_cache[level] !== undefined) return _cache[level];
  const val = xpThresholdCached(level - 1) + level * 300;
  _cache[level] = val;
  return val;
}

/**
 * Returns the level a character is at given their total lifetime XP.
 * Scans up from current level — callers should pass current level to avoid
 * scanning from 1 on every call.
 */
export function levelFromXp(totalXp: number, startLevel = 1): number {
  let level = startLevel;
  while (level < MAX_LEVEL) {
    const nextThreshold = xpThresholdCached(level + 1);
    if (totalXp < nextThreshold) break;
    level++;
  }
  return level;
}

// ─── Stat growth profiles ─────────────────────────────────────────────────────

/**
 * Flat stat gains applied to a character's stats on each level-up.
 * Add an entry here for every party member id.
 * New members only need an entry here — no scene changes required.
 */
export type StatGrowth = Readonly<{
  maxHP:    number;
  maxMP:    number;
  attack:   number;
  magic:    number;
  defense:  number;
  speed:    number;
}>;

const GROWTH_PROFILES: Record<string, StatGrowth> = {
  hugo: {
    maxHP: 14,   // balanced frontliner
    maxMP:  4,
    attack: 3,
    magic:  1,
    defense: 2,
    speed:  1,
  },
  serelle_vaun: {
    maxHP:  8,   // glass cannon mage
    maxMP: 10,
    attack: 1,
    magic:  4,
    defense: 1,
    speed:  2,
  },
  kael: {
    maxHP: 18,   // tank
    maxMP:  2,
    attack: 4,
    magic:  0,
    defense: 3,
    speed:  1,
  },
};

/** Fallback growth for any party member without an explicit profile. */
const DEFAULT_GROWTH: StatGrowth = {
  maxHP: 10, maxMP: 5, attack: 2, magic: 2, defense: 2, speed: 1,
};

export function getGrowthProfile(memberId: string): StatGrowth {
  return GROWTH_PROFILES[memberId] ?? DEFAULT_GROWTH;
}

/**
 * Applies one level-up's worth of stat gains.
 * Returns a new stats object — does not mutate the input.
 * currentHP and currentMP are healed to new maximums on level-up.
 */
export function applyStatGrowth(
  stats: CharacterStats,
  memberId: string,
): CharacterStats {
  const growth  = getGrowthProfile(memberId);
  const newMaxHP = stats.maxHP + growth.maxHP;
  const newMaxMP = stats.maxMP + growth.maxMP;
  return {
    ...stats,
    maxHP:     newMaxHP,
    currentHP: newMaxHP,
    maxMP:     newMaxMP,
    currentMP: newMaxMP,
    attack:    stats.attack  + growth.attack,
    magic:     stats.magic   + growth.magic,
    defense:   stats.defense + growth.defense,
    speed:     stats.speed   + growth.speed,
  };
}
