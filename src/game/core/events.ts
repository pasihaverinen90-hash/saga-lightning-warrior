// src/game/core/events.ts
// Named event constants for cross-scene communication via Phaser's EventEmitter.
// Use these instead of raw strings to avoid typos and aid refactoring.

export const GAME_EVENTS = {
  // Scene transitions
  START_NEW_GAME: 'game:start_new_game',
  LOAD_GAME: 'game:load_game',

  // Battle
  BATTLE_START: 'battle:start',
  BATTLE_END: 'battle:end',

  // Dialogue
  DIALOGUE_START: 'dialogue:start',
  DIALOGUE_END: 'dialogue:end',

  // Story
  STORY_FLAG_SET: 'story:flag_set',

  // Save
  SAVE_GAME: 'save:save_game',
  SAVE_COMPLETE: 'save:complete',
} as const;

export type GameEvent = (typeof GAME_EVENTS)[keyof typeof GAME_EVENTS];
