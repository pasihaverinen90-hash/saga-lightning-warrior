// src/game/state/game-state.ts
// The single mutable game state object.
// Always read via selectors, mutate via actions.
// Never import this directly into scenes — use selectors and actions instead.

import type { GameState } from './game-state-types';

// Default starting state used when creating a new game.
// Party and inventory are populated by the new-game action.
//
// currentLocation stores the player CENTER in world-space pixels.
// These coordinates match CFG.playerStartX/Y (240, 528) + half player size (14, 18)
// as defined in world-map-config.ts. They are always overwritten immediately by
// initNewGame() or loadGame() before any scene reads them.
const DEFAULT_STATE: GameState = {
  initialized: false,
  gold: 0,
  party: [],
  inventory: [],
  storyFlags: {},
  currentLocation: {
    locationId: 'border_fields',
    x: 254,  // playerStartX 240 + PLAYER_W/2 14
    y: 546,  // playerStartY 528 + PLAYER_H/2 18
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
