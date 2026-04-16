// src/game/save/save-service.ts
// All localStorage read/write logic is isolated here.
// Nothing else should touch localStorage directly.

import type { SaveData } from './save-types';
import { SAVE_SLOT_KEY } from './save-types';
import { SAVE_VERSION } from './save-version';
import { getState } from '../state/game-state';
import { loadStateFromSave } from '../state/state-actions';

/**
 * Returns true if a valid save exists in localStorage.
 */
export function hasSaveData(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_SLOT_KEY);
    if (!raw) return false;
    const data: SaveData = JSON.parse(raw);
    return data.version === SAVE_VERSION;
  } catch {
    return false;
  }
}

/**
 * Writes current game state to localStorage.
 * Returns true on success.
 */
export function saveGame(): boolean {
  try {
    const data: SaveData = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      state: getState() as ReturnType<typeof getState>,
    };
    localStorage.setItem(SAVE_SLOT_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads save data from localStorage and applies it to game state.
 * Returns true on success, false if no save or version mismatch.
 */
export function loadGame(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_SLOT_KEY);
    if (!raw) return false;
    const data: SaveData = JSON.parse(raw);
    if (data.version !== SAVE_VERSION) return false;
    loadStateFromSave(data.state);
    return true;
  } catch {
    return false;
  }
}

/**
 * Deletes save data (used for testing / reset).
 */
export function deleteSave(): void {
  localStorage.removeItem(SAVE_SLOT_KEY);
}

// ─── Save metadata ────────────────────────────────────────────────────────────

export interface SaveMeta {
  /** Unix timestamp (ms) when the save was written. */
  timestamp: number;
  /** locationId from the saved currentLocation — e.g. 'lumen_town'. */
  locationId: string;
}

/**
 * Returns lightweight save metadata without loading the full state.
 * Used by the title screen to display save slot info.
 * Returns null if no save exists or the save is corrupt / version-mismatched.
 */
export function getSaveMeta(): SaveMeta | null {
  try {
    const raw = localStorage.getItem(SAVE_SLOT_KEY);
    if (!raw) return null;
    const data: SaveData = JSON.parse(raw);
    if (data.version !== SAVE_VERSION) return null;
    return {
      timestamp:  data.timestamp,
      locationId: data.state.currentLocation.locationId,
    };
  } catch {
    return null;
  }
}
