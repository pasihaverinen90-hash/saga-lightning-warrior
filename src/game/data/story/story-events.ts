// src/game/data/story/story-events.ts
// Canonical story flag ids used across the codebase.
// Import these constants instead of using raw strings.

export const STORY_FLAGS = {
  SERELLE_JOINED:      'serelle_joined',
  KAEL_JOINED:         'kael_joined',
  CHAPTER_1_COMPLETE:  'chapter_1_complete',
  /** Reserved: not yet set by any event. Placeholder for a future gate on the North Pass route. */
  NORTH_PASS_UNLOCKED: 'north_pass_unlocked',
  BOSS_VEYR_DEFEATED:  'boss_veyr_defeated',
  THORNWOOD_CLEARED:   'thornwood_cleared',
} as const;

export type StoryFlagKey = (typeof STORY_FLAGS)[keyof typeof STORY_FLAGS];
