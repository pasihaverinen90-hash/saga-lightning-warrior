// src/game/data/story/story-events.ts
// Canonical story flag ids used across the codebase.
// Import these constants instead of using raw strings.

export const STORY_FLAGS = {
  // ── Character recruitment ────────────────────────────────────────────────
  SERELLE_JOINED:      'serelle_joined',
  KAEL_JOINED:         'kael_joined',

  // ── Chapter milestones ───────────────────────────────────────────────────
  CHAPTER_1_COMPLETE:  'chapter_1_complete',

  // ── Boss / scripted battle outcomes ──────────────────────────────────────
  BOSS_VEYR_DEFEATED:  'boss_veyr_defeated',
  THORNWOOD_CLEARED:   'thornwood_cleared',

  // ── World-map progression gates (Elerion two-continent map) ──────────────
  // None are wired into triggers yet — the placeholder world is fully
  // traversable so the whole map can be tested. Wire these into specific
  // WorldTrigger.requiresFlag values as the story is implemented.
  CHAPTER_2_MOUNTAIN_PASS_OPEN:  'chapter_2_mountain_pass_open',
  CHAPTER_3_SEA_TRAVEL_UNLOCKED: 'chapter_3_sea_travel_unlocked',
  CHAPTER_4_RIVER_CROSSING_OPEN: 'chapter_4_river_crossing_open',
  CHAPTER_6_FINAL_REGION_OPEN:   'chapter_6_final_region_open',

  // ── Legacy / reserved ────────────────────────────────────────────────────
  /** Reserved: not yet set by any event. Earlier name for the mountain pass gate. */
  NORTH_PASS_UNLOCKED: 'north_pass_unlocked',
} as const;

export type StoryFlagKey = (typeof STORY_FLAGS)[keyof typeof STORY_FLAGS];
