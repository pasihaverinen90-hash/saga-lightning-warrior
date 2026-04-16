// src/game/data/enemies/enemies.ts
// All enemy unit definitions.

export interface EnemyDef {
  id: string;
  name: string;
  maxHP: number;
  maxMP: number;
  attack: number;
  magic: number;
  defense: number;
  speed: number;
  skillIds: string[];
  goldReward: number;
  xpReward: number;
  /**
   * Fixed base level for this enemy type.
   * Documents intended power level and is a ready hook for future
   * level-gap XP scaling (bonus XP for fighting above your level,
   * reduced XP for fighting below). Not used for stat scaling yet.
   */
  baseLevel: number;
  /** Visual color identity for placeholder sprite rendering */
  colorHex: number;
}

export const ENEMIES: Record<string, EnemyDef> = {
  braxtion_soldier: {
    id: 'braxtion_soldier',
    name: 'Braxtion Soldier',
    maxHP: 60,
    maxMP: 0,
    attack: 14,
    magic: 0,
    defense: 8,
    speed: 7,
    skillIds: [],
    goldReward: 12,
    xpReward: 30,
    baseLevel: 2,
    colorHex: 0x6b3030,
  },
  dark_acolyte: {
    id: 'dark_acolyte',
    name: 'Dark Acolyte',
    maxHP: 45,
    maxMP: 30,
    attack: 8,
    magic: 16,
    defense: 5,
    speed: 9,
    skillIds: ['dark_bolt'],
    goldReward: 15,
    xpReward: 38,
    baseLevel: 3,
    colorHex: 0x4a2060,
  },
  ridge_fang: {
    id: 'ridge_fang',
    name: 'Ridge Fang',
    maxHP: 55,
    maxMP: 0,
    attack: 16,
    magic: 0,
    defense: 6,
    speed: 13,
    skillIds: [],
    goldReward: 10,
    xpReward: 25,
    baseLevel: 3,
    colorHex: 0x5a3a20,
  },
  shadecaster_veyr: {
    id: 'shadecaster_veyr',
    name: 'Shadecaster Veyr',
    maxHP: 220,
    maxMP: 80,
    attack: 18,
    magic: 28,
    defense: 14,
    speed: 11,
    skillIds: ['dark_bolt', 'shadow_wave'],
    goldReward: 0,
    xpReward: 300,
    baseLevel: 8,
    colorHex: 0x3a1a5a,
  },
  // Braxtion's eastern advance unit — stronger and better coordinated than
  // the soldiers near the North Pass. Appears only on Ashenveil Road.
  ashenveil_patrol: {
    id: 'ashenveil_patrol',
    name: 'Ashenveil Patrol',
    maxHP: 78,
    maxMP: 0,
    attack: 17,
    magic: 0,
    defense: 11,
    speed: 8,
    skillIds: [],
    goldReward: 18,
    xpReward: 44,
    baseLevel: 4,
    colorHex: 0x7a2828,  // deeper crimson — darker armor than braxtion_soldier
  },
  // ── Thornwood enemies ────────────────────────────────────────────────────────
  // Corruption from Braxtion's rituals has spread into the south-west forest,
  // transforming wildlife and dissolving the remnant spirits that once lived there.

  // A large predator mutated by the spreading corruption.
  // Fast and aggressive; lower defense than armored soldiers.
  thornwood_lurker: {
    id: 'thornwood_lurker',
    name: 'Thornwood Lurker',
    maxHP: 72,
    maxMP: 0,
    attack: 19,
    magic: 0,
    defense: 7,
    speed: 14,
    skillIds: [],
    goldReward: 14,
    xpReward: 42,
    baseLevel: 4,
    colorHex: 0x2d5c2a,  // dark corrupted forest green
  },

  // A spirit remnant twisted by dark energy. Fragile but magically potent.
  // Uses wisp_flare — a raw burst of volatile spirit energy.
  corrupted_wisp: {
    id: 'corrupted_wisp',
    name: 'Corrupted Wisp',
    maxHP: 38,
    maxMP: 40,
    attack: 5,
    magic: 20,
    defense: 3,
    speed: 11,
    skillIds: ['wisp_flare'],
    goldReward: 16,
    xpReward: 48,
    baseLevel: 5,
    colorHex: 0x7ab8c0,  // teal-grey spirit glow
  },
  // A powerful corruption-spirit that has claimed a clearing in the Thornwood.
  // Stronger than regular wisps; uses shadow_wave to threaten the whole party.
  // Scripted encounter only — not in the random encounter table.
  grove_warden: {
    id: 'grove_warden',
    name: 'Grove Warden',
    maxHP: 160,
    maxMP: 60,
    attack: 10,
    magic: 24,
    defense: 8,
    speed: 10,
    skillIds: ['wisp_flare', 'shadow_wave'],
    goldReward: 0,      // reward comes from the outro dialogue effects instead
    xpReward: 120,
    baseLevel: 6,
    colorHex: 0x4a9090,  // deeper teal — visually distinct from the standard wisps
  },
};
