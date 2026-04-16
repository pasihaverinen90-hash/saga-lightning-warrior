// src/game/data/characters/party-members.ts
// Canonical definitions for all playable party members.
// Stats here are starting/prototype values.

import type { PartyMember } from '../../state/game-state-types';

export const HUGO: PartyMember = {
  id: 'hugo',
  name: 'Hugo',
  isActive: true,
  level: 1,
  xp: 0,
  skillIds: ['lightning_slash'],
  colorHex: 0xe8d25f,   // lightning yellow — matches config COLORS.lightningYellow
  equipment: { weapon: 'iron_sword', armor: 'leather_vest' },
  stats: {
    maxHP: 120,
    currentHP: 120,
    maxMP: 40,
    currentMP: 40,
    attack: 18,
    magic: 8,
    defense: 12,
    speed: 10,
  },
};

export const SERELLE: PartyMember = {
  id: 'serelle_vaun',
  name: 'Serelle',
  isActive: false, // Joins during story event — not active at game start
  level: 1,
  xp: 0,
  skillIds: ['ice_shard'],
  colorHex: 0x8fc8ff,   // ice blue — matches config COLORS.iceBlue
  equipment: { weapon: 'apprentice_rod', armor: 'cloth_robe' },
  stats: {
    maxHP: 90,
    currentHP: 90,
    maxMP: 70,
    currentMP: 70,
    attack: 8,
    magic: 22,
    defense: 8,
    speed: 12,
  },
};

export const KAEL: PartyMember = {
  id: 'kael',
  name: 'Kael',
  isActive: false, // Joins via story event in Ashenveil — not active at game start
  level: 1,
  xp: 0,
  skillIds: ['flame_cleave'],
  colorHex: 0xd4724a,   // ember orange — distinct from Hugo's yellow and Serelle's blue
  equipment: { weapon: 'battle_axe', armor: 'iron_plate' },
  stats: {
    maxHP: 140,
    currentHP: 140,
    maxMP: 28,
    currentMP: 28,
    attack: 22,
    magic: 5,
    defense: 16,
    speed: 7,
  },
};

// The party roster at the start of a new game.
// Hugo starts active. Serelle and Kael are in the roster but inactive
// until their respective story events trigger activation.
export const STARTING_PARTY: PartyMember[] = [HUGO, SERELLE, KAEL];
