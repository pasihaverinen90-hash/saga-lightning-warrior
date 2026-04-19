// src/game/core/scene-router.ts
// Given the current GameState (after a save has been loaded), determines
// which scene to start and what init data to pass.
//
// Coordinate convention used throughout the save system:
//   currentLocation.x / y  =  player CENTER in the scene named by locationId.
//
// WorldMapScene.init() and TownScene.init() both expect TOP-LEFT coordinates,
// so the router converts: topLeft = center - playerHalfSize.
//
// The locationId's sceneType (from LOCATIONS) decides where to resume:
//   'town'  → TownScene at the saved in-town position
//   'world' → WorldMapScene at the saved world-map position
// Extend LOCATIONS (add new sceneType values and a matching branch here) when
// save points inside dungeons or other scene types need to resume elsewhere.

import { SCENE_KEYS } from './scene-keys';
import type { GameState } from '../state/game-state-types';
import type { WorldMapInitData } from '../world/types/world-types';
import type { TownInitData } from '../town/types/town-types';
import { PLAYER_W, PLAYER_H } from '../shared/constants/player';
import { LOCATIONS } from '../data/maps/locations';

export interface ResumeTarget {
  sceneKey: string;
  /** Passed verbatim as the second argument to Phaser scene.start(). */
  initData: Record<string, unknown>;
}

/**
 * Returns the scene and init data needed to resume play from a loaded save.
 *
 * Town saves (locationId.sceneType === 'town') resume inside the saved town
 * at the saved in-town position. World saves resume on the world map at the
 * saved world-map position. Unknown locationIds fall back to the world map.
 */
export function getResumeScene(state: GameState): ResumeTarget {
  const { locationId, x, y } = state.currentLocation;

  // Convert center → top-left (scenes store positions as top-left internally).
  const topLeftX = Math.max(0, Math.round(x - PLAYER_W / 2));
  const topLeftY = Math.max(0, Math.round(y - PLAYER_H / 2));

  const sceneType = LOCATIONS[locationId]?.sceneType ?? 'world';

  if (sceneType === 'town') {
    return {
      sceneKey: SCENE_KEYS.TOWN,
      initData: {
        locationId,
        startX: topLeftX,
        startY: topLeftY,
      } satisfies TownInitData,
    };
  }

  return {
    sceneKey: SCENE_KEYS.WORLD_MAP,
    initData: { returnX: topLeftX, returnY: topLeftY } satisfies WorldMapInitData,
  };
}
