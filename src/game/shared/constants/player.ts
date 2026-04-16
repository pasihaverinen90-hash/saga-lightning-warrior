// src/game/shared/constants/player.ts
// Single source of truth for the player entity dimensions.
// These values must match the placeholder graphics drawn in WorldMapScene
// and TownScene. Import from here — never redefine locally.
//
// Used by:
//   WorldMapScene   — movement bounds, camera follow offset, location writes
//   TownScene       — same as above
//   scene-router    — center→top-left conversion on save resume
//   state-actions   — new-game spawn coordinate derivation

export const PLAYER_W = 28; // pixels, width of player hitbox rect
export const PLAYER_H = 36; // pixels, height of player hitbox rect
