// src/game/data/maps/encounter-tables.ts
// Data-driven encounter groups per region.
// WorldMapScene uses these via EncounterTracker for step-based random battles.

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
  north_pass_zone: {
    regionId: 'north_pass_zone',
    minStepsBeforeEncounter: 8,
    chancePerStep: 0.12,
    backgroundId: 'bg_mountain_pass',
    groups: [
      { enemyIds: ['braxtion_soldier'],                      weight: 3 },
      { enemyIds: ['braxtion_soldier', 'braxtion_soldier'],  weight: 2 },
      { enemyIds: ['dark_acolyte'],                          weight: 2 },
      { enemyIds: ['ridge_fang'],                            weight: 2 },
      { enemyIds: ['dark_acolyte', 'braxtion_soldier'],      weight: 1 },
    ],
  },

  // Ashenveil Road — eastern approach to Ashenveil town.
  // Braxtion's patrol squads push further east here than in the North Pass,
  // supported by wild ridge fangs and acolyte scouts.
  // ashenveil_patrol appears only here; North Pass table is unchanged.
  ashenveil_road_zone: {
    regionId: 'ashenveil_road_zone',
    minStepsBeforeEncounter: 6,
    chancePerStep: 0.13,
    backgroundId: 'bg_ashenveil_road',
    groups: [
      { enemyIds: ['ashenveil_patrol'],                           weight: 4 },
      { enemyIds: ['ashenveil_patrol', 'ashenveil_patrol'],       weight: 2 },
      { enemyIds: ['ashenveil_patrol', 'dark_acolyte'],           weight: 2 },
      { enemyIds: ['ridge_fang', 'ashenveil_patrol'],             weight: 2 },
      { enemyIds: ['dark_acolyte', 'dark_acolyte'],               weight: 1 },
      { enemyIds: ['ridge_fang', 'ridge_fang'],                   weight: 1 },
    ],
  },
  // Thornwood — south-west forest, corrupted by Braxtion's ritual spread.
  // Fast lurkers and volatile wisps; no organized soldiers here, just feral danger.
  // Slightly more frequent encounters than the road zones (corruption is dense).
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
};
