// src/game/data/maps/locations.ts
// All named locations in Elarion.

export interface LocationDef {
  id: string;
  displayName: string;
  encounterEnabled: boolean;
}

export const LOCATIONS: Record<string, LocationDef> = {
  border_fields: {
    id: 'border_fields',
    displayName: 'Border Fields',
    encounterEnabled: false,
  },
  lumen_town: {
    id: 'lumen_town',
    displayName: 'Lumen Town',
    encounterEnabled: false,
  },
  north_pass: {
    id: 'north_pass',
    displayName: 'North Pass',
    encounterEnabled: true,
  },
  ashenveil_road: {
    id: 'ashenveil_road',
    displayName: 'Ashenveil Road',
    encounterEnabled: true,
  },
  ashenveil_town: {
    id: 'ashenveil_town',
    displayName: 'Ashenveil',
    encounterEnabled: false,
  },
  thornwood: {
    id: 'thornwood',
    displayName: 'Thornwood',
    encounterEnabled: true,
  },
};
