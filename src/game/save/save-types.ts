// src/game/save/save-types.ts
// Types for save data that gets written to localStorage.

import type { GameState } from '../state/game-state-types';

export interface SaveData {
  version: number;
  timestamp: number; // Unix ms
  state: GameState;
}

export const SAVE_SLOT_KEY = 'saga_save_slot_1';
