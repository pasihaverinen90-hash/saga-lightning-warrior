// src/game/maps/map-registry.ts
// The list of tilemaps the game ships with.
//
// Adding a location is: run the asset pipeline to emit its Tiled JSON, then add
// one row here. No scene code changes — TileMapScene is fully data-driven.
//
// `id` doubles as the save `locationId`, so these strings are stable references:
// renaming one invalidates saves and requires a SAVE_VERSION bump.

import type { MapKind } from './map-types';

export interface MapRegistryEntry {
  id: string;
  /** Phaser cache key and file basename under public/assets/maps/. */
  file: string;
  kind: MapKind;
  displayName: string;
  /**
   * Whether the game menu may save here. Matches the pre-existing rule that
   * the overworld is never a valid save point.
   */
  canSave: boolean;
}

export const MAP_REGISTRY: Record<string, MapRegistryEntry> = {
  elerion_west: {
    id: 'elerion_west',
    file: 'elerion-west',
    kind: 'travel',
    displayName: 'Western Elerion',
    canSave: false,
  },
  dawnkeep: {
    id: 'dawnkeep',
    file: 'dawnkeep',
    kind: 'town',
    displayName: 'Dawnkeep',
    canSave: true,
  },
  everdawn_forest: {
    id: 'everdawn_forest',
    file: 'everdawn-forest',
    kind: 'field',
    displayName: 'Everdawn Forest',
    canSave: false,
  },
  dawnkeep_inn: {
    id: 'dawnkeep_inn',
    file: 'dawnkeep-inn',
    kind: 'interior',
    displayName: 'Dawnkeep Inn',
    canSave: true,
  },
};

/** The map a new game starts on. */
export const STARTING_MAP_ID = 'elerion_west';
/** Spawn point used when starting a new game. */
export const STARTING_SPAWN_ID = 'new_game';

export function getMapEntry(mapId: string): MapRegistryEntry | undefined {
  return MAP_REGISTRY[mapId];
}

export function isTileMapId(locationId: string): boolean {
  return Object.prototype.hasOwnProperty.call(MAP_REGISTRY, locationId);
}

/** Every map file that PreloadScene must load. */
export function allMapEntries(): MapRegistryEntry[] {
  return Object.values(MAP_REGISTRY);
}
