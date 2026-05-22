// src/game/data/maps/encounter-tables.ts
// Data-driven encounter groups per zone.
// WorldMapScene uses these via EncounterTracker for step-based random battles.
// Table keys must match WorldZone.id from elerion-world-config.ts.

export interface EnemyGroupEntry {
  /** Array of enemy IDs in this group */
  enemyIds: string[];
  /** Relative weight — higher = more likely */
  weight: number;
}

export interface EncounterTable {
  regionId: string;
  /** Minimum steps before first encounter can occur */
  minStepsBeforeEncounter: number;
  /** Chance per step (0–1) after threshold is crossed */
  chancePerStep: number;
  groups: EnemyGroupEntry[];
  /** Background scene key or id for this region */
  backgroundId: string;
}

export const ENCOUNTER_TABLES: Record<string, EncounterTable> = {
  // Western continent — corrupted forest south of the start village.
  thornwood_zone: {
    regionId: 'thornwood_zone',
    minStepsBeforeEncounter: 8,
    chancePerStep: 0.14,
    backgroundId: 'bg_thornwood',
    groups: [
      { enemyIds: ['thornwood_lurker'],                            weight: 4 },
      { enemyIds: ['thornwood_lurker', 'thornwood_lurker'],        weight: 2 },
      { enemyIds: ['corrupted_wisp'],                              weight: 3 },
      { enemyIds: ['corrupted_wisp', 'corrupted_wisp'],            weight: 1 },
      { enemyIds: ['thornwood_lurker', 'corrupted_wisp'],          weight: 4 },
    ],
  },

  // Western continent — light forest north of Lumen, scout patrols and beasts.
  western_forest_zone: {
    regionId: 'western_forest_zone',
    minStepsBeforeEncounter: 10,
    chancePerStep: 0.10,
    backgroundId: 'bg_verdant',
    groups: [
      { enemyIds: ['ridge_fang'],                                  weight: 4 },
      { enemyIds: ['ridge_fang', 'ridge_fang'],                    weight: 2 },
      { enemyIds: ['braxtion_soldier'],                            weight: 2 },
      { enemyIds: ['braxtion_soldier', 'ridge_fang'],              weight: 2 },
    ],
  },

  // Spine Mountains — gap between mountain walls; well-defended.
  mountain_pass_zone: {
    regionId: 'mountain_pass_zone',
    minStepsBeforeEncounter: 8,
    chancePerStep: 0.12,
    backgroundId: 'bg_mountain_pass',
    groups: [
      { enemyIds: ['braxtion_soldier'],                            weight: 3 },
      { enemyIds: ['braxtion_soldier', 'braxtion_soldier'],        weight: 2 },
      { enemyIds: ['dark_acolyte'],                                weight: 2 },
      { enemyIds: ['ridge_fang'],                                  weight: 2 },
      { enemyIds: ['dark_acolyte', 'braxtion_soldier'],            weight: 1 },
    ],
  },

  // Eastern continent — dust frontier between East Port and the river.
  eastern_frontier_zone: {
    regionId: 'eastern_frontier_zone',
    minStepsBeforeEncounter: 6,
    chancePerStep: 0.13,
    backgroundId: 'bg_ashenveil_road',
    groups: [
      { enemyIds: ['ashenveil_patrol'],                            weight: 4 },
      { enemyIds: ['ashenveil_patrol', 'ashenveil_patrol'],        weight: 2 },
      { enemyIds: ['ashenveil_patrol', 'dark_acolyte'],            weight: 2 },
      { enemyIds: ['ridge_fang', 'ashenveil_patrol'],              weight: 2 },
      { enemyIds: ['dark_acolyte', 'dark_acolyte'],                weight: 1 },
      { enemyIds: ['ridge_fang', 'ridge_fang'],                    weight: 1 },
    ],
  },

  // East of the river — war-torn marches; heavier squads.
  eastern_warfields_zone: {
    regionId: 'eastern_warfields_zone',
    minStepsBeforeEncounter: 6,
    chancePerStep: 0.14,
    backgroundId: 'bg_warfields',
    groups: [
      { enemyIds: ['braxtion_soldier', 'braxtion_soldier'],                    weight: 3 },
      { enemyIds: ['braxtion_soldier', 'dark_acolyte'],                        weight: 3 },
      { enemyIds: ['dark_acolyte', 'dark_acolyte'],                            weight: 2 },
      { enemyIds: ['braxtion_soldier', 'braxtion_soldier', 'dark_acolyte'],    weight: 1 },
    ],
  },

  // Black Reach — corruption-saturated far east.
  blightlands_zone: {
    regionId: 'blightlands_zone',
    minStepsBeforeEncounter: 6,
    chancePerStep: 0.16,
    backgroundId: 'bg_blightlands',
    groups: [
      { enemyIds: ['corrupted_wisp'],                              weight: 3 },
      { enemyIds: ['corrupted_wisp', 'corrupted_wisp'],            weight: 3 },
      { enemyIds: ['dark_acolyte'],                                weight: 2 },
      { enemyIds: ['corrupted_wisp', 'dark_acolyte'],              weight: 2 },
      { enemyIds: ['dark_acolyte', 'dark_acolyte'],                weight: 1 },
    ],
  },
};
