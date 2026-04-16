// src/game/core/scene-router.ts
// Given the current GameState (after a save has been loaded), determines
// which scene to start and what init data to pass.
//
// Coordinate convention used throughout the save system:
//   currentLocation.x / y  =  player CENTER in world-space pixels.
//
// WorldMapScene.init() expects TOP-LEFT (this.px / this.py).
// The router converts: topLeft = center - playerHalfSize.
//
// Save points exist in Lumen Town and Ashenveil (inn + save crystal in each).
// All saved locationIds resume at WorldMapScene at the stored world position.
// Extend this function when save points inside dungeons or other scene types
// need to resume in a scene other than WorldMapScene.

import { SCENE_KEYS } from './scene-keys';
import type { GameState } from '../state/game-state-types';
import type { WorldMapInitData } from '../world/types/world-types';
import { PLAYER_W, PLAYER_H } from '../shared/constants/player';

export interface ResumeTarget {
  sceneKey: string;
  /** Passed verbatim as the second argument to Phaser scene.start(). */
  initData: Record<string, unknown>;
}

/**
 * Returns the scene and init data needed to resume play from a loaded save.
 *
 * All locations resume at WorldMapScene at the saved world position.
 * Saving inside any town (Lumen Town, Ashenveil) records coordinates on the
 * world map side; the player resumes just outside the town entrance.
 * Extend this function when save points inside dungeons or cutscene-locked
 * locations need to resume directly in a different scene.
 */
export function getResumeScene(state: GameState): ResumeTarget {
  const { x, y } = state.currentLocation;

  // Convert center → top-left for WorldMapScene.init()
  const returnX = Math.max(0, Math.round(x - PLAYER_W / 2));
  const returnY = Math.max(0, Math.round(y - PLAYER_H / 2));

  return {
    sceneKey: SCENE_KEYS.WORLD_MAP,
    initData: { returnX, returnY } satisfies WorldMapInitData,
  };
}
