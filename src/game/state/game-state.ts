// src/game/state/game-state.ts
// The single mutable game state object.
// Always read via selectors, mutate via actions.
// Never import this directly into scenes — use selectors and actions instead.

import type { GameState } from './game-state-types';

// Default starting state used when creating a new game.
// Party and inventory are populated by the new-game action.
//
// currentLocation stores the player CENTER in world-space pixels.
// These coordinates are placeholders — initNewGame() and loadGame() always
// overwrite them with values derived from elerion-world-config.ts before any
// scene reads them.
const DEFAULT_STATE: GameState = {
  initialized: false,
  gold: 0,
  party: [],
  inventory: [],
  storyFlags: {},
  currentLocation: {
    locationId: 'world_map',
    x: 0,
    y: 0,
  },
};

// The single shared state instance.
let _state: GameState = structuredClone(DEFAULT_STATE);

/**
 * Returns the current state (read-only reference).
 * Prefer using selectors in state-selectors.ts.
 */
export function getState(): Readonly<GameState> {
  return _state;
}

/**
 * Replaces the state entirely.
 * Used by: new game init, save load.
 * NOT used for incremental updates — use patchState for those.
 */
export function setState(next: GameState): void {
  _state = structuredClone(next);
}

/**
 * Partially updates state with a shallow merge at the top level.
 * For nested updates, prefer action functions in state-actions.ts.
 */
export function patchState(patch: Partial<GameState>): void {
  _state = { ..._state, ...patch };
}

/**
 * Resets to default state (used before starting a new game).
 */
export function resetState(): void {
  _state = structuredClone(DEFAULT_STATE);
}
