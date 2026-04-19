// src/game/data/maps/locations.ts
// All named locations in Elarion.

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
  border_fields: {
    id: 'border_fields',
    displayName: 'Border Fields',
    encounterEnabled: false,
    sceneType: 'world',
  },
  lumen_town: {
    id: 'lumen_town',
    displayName: 'Lumen Town',
    encounterEnabled: false,
    sceneType: 'town',
  },
  north_pass: {
    id: 'north_pass',
    displayName: 'North Pass',
    encounterEnabled: true,
    sceneType: 'world',
  },
  ashenveil_road: {
    id: 'ashenveil_road',
    displayName: 'Ashenveil Road',
    encounterEnabled: true,
    sceneType: 'world',
  },
  ashenveil_town: {
    id: 'ashenveil_town',
    displayName: 'Ashenveil',
    encounterEnabled: false,
    sceneType: 'town',
  },
  thornwood: {
    id: 'thornwood',
    displayName: 'Thornwood',
    encounterEnabled: true,
    sceneType: 'world',
  },
};
