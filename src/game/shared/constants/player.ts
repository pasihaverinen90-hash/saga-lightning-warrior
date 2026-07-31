// src/game/shared/constants/player.ts
// Single source of truth for the player entity dimensions.
//
// Two sets of numbers exist because the game runs two map systems side by side
// during the tilemap migration:
//
//   PLAYER_W / PLAYER_H       — the LEGACY hitbox, used by TownScene (Eldric
//                               and Dreadshore) which still draws the player
//                               with Phaser Graphics. Do not change these
//                               without re-checking those maps.
//   PLAYER_SPRITE_* / BODY_*  — the tilemap system. The visible sprite is much
//                               larger than the collision body, because the
//                               body represents the character's FEET. That is
//                               what lets the head and shoulders overlap tree
//                               canopies, roofs and cliff faces naturally
//                               instead of stopping short of them.
//
// Used by:
//   TileMapScene    — movement, camera follow, depth sorting, spawn placement
//   WorldMapScene   — (legacy) movement bounds and camera follow
//   TownScene       — same as above
//   scene-router    — centre→top-left conversion on save resume
//   state-actions   — new-game spawn coordinate derivation

/** Legacy hitbox, retained for the procedural TownScene maps. */
export const PLAYER_W = 28;
export const PLAYER_H = 36;

/** Frame size of the generated character spritesheets. */
export const PLAYER_SPRITE_W = 48;
export const PLAYER_SPRITE_H = 64;

/**
 * Collision body: the character's feet, in pixels.
 *
 * 32x20 against a 64px tile means the player fits comfortably through a
 * one-tile gap without catching on corners, and reads as standing ON the tile
 * they occupy rather than hovering across two.
 */
export const PLAYER_BODY_W = 32;
export const PLAYER_BODY_H = 20;
