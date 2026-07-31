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
import type { TileMapInitData } from '../maps/map-types';
import { PLAYER_W, PLAYER_H, PLAYER_BODY_W, PLAYER_BODY_H } from '../shared/constants/player';
import { LOCATIONS } from '../data/maps/locations';
import { isTileMapId, STARTING_MAP_ID, STARTING_SPAWN_ID } from '../maps/map-registry';

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

  // Tilemaps are checked first: their ids are the authoritative map list, and
  // they use the smaller feet-sized collision body rather than the legacy
  // full-sprite hitbox, so the centre→top-left conversion differs.
  if (isTileMapId(locationId)) {
    return {
      sceneKey: SCENE_KEYS.TILE_MAP,
      initData: {
        mapId: locationId,
        startX: Math.max(0, Math.round(x - PLAYER_BODY_W / 2)),
        startY: Math.max(0, Math.round(y - PLAYER_BODY_H / 2)),
      } satisfies TileMapInitData,
    };
  }

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

  // An unrecognised locationId means the save predates the tilemap rebuild or
  // names a location that no longer exists. SAVE_VERSION gating should already
  // have rejected those, so this is a last-resort fallback: start the player at
  // the beginning of the travel map rather than at coordinates from a map that
  // is no longer loaded.
  return {
    sceneKey: SCENE_KEYS.TILE_MAP,
    initData: {
      mapId: STARTING_MAP_ID,
      spawnId: STARTING_SPAWN_ID,
    } satisfies TileMapInitData,
  };
}

/** Retained so the legacy world-map init shape stays exercised by the compiler. */
export type LegacyWorldResume = WorldMapInitData;
