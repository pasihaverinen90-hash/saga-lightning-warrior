// src/game/data/maps/locations.ts
// All named locations in Elerion.

/**
 * Which scene a location's saved coordinates belong to.
 *   'world' → currentLocation.x/y are world-map coords (resume in WorldMapScene).
 *   'town'  → currentLocation.x/y are in-town coords    (resume in TownScene).
 * scene-router.ts reads this to decide which scene to start on load.
 */
export type LocationSceneType = 'world' | 'town';

export interface LocationDef {
  id: string;
  displayName: string;
  encounterEnabled: boolean;
  /**
   * Which scene this location's coords belong to.
   * Only 'town' ids resume in TownScene; everything else resumes on the world map.
   */
  sceneType: LocationSceneType;
}

export const LOCATIONS: Record<string, LocationDef> = {
  // The world map itself (default locationId while walking the overworld).
  world_map: {
    id: 'world_map',
    displayName: 'Elerion',
    encounterEnabled: false,
    sceneType: 'world',
  },

  // Towns with full TownScene implementations.
  lumen_town: {
    id: 'lumen_town',
    displayName: 'Lumen',
    encounterEnabled: false,
    sceneType: 'town',
  },
  ashenveil_town: {
    id: 'ashenveil_town',
    displayName: 'Ashenveil',
    encounterEnabled: false,
    sceneType: 'town',
  },

  // Scripted-battle target ids (recorded briefly between trigger and battle).
  thornwood: {
    id: 'thornwood',
    displayName: 'Thornwood',
    encounterEnabled: true,
    sceneType: 'world',
  },
  mountain_pass: {
    id: 'mountain_pass',
    displayName: 'Mountain Pass',
    encounterEnabled: true,
    sceneType: 'world',
  },
};
