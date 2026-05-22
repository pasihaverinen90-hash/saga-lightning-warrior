// src/game/save/save-version.ts
// Increment SAVE_VERSION any time the save data structure changes.
// The save service uses this to detect stale saves.
//
// Version history:
//   1 → initial structure
//   2 → PartyMember gained colorHex: number (audit fix 3)
//   3 → PartyMember gained level: number and xp: number (XP/leveling system)
//       EnemyDef gained xpReward: number (data only, not serialized)
//   4 → PartyMember.xp semantics changed from "XP remainder toward next level"
//       to "total lifetime XP earned". Intentionally invalidated.
//   5 → PartyMember gained equipment: EquipmentSlots ({ weapon, armor }).
//       Saves from v4 lack this field; loading would produce undefined equipment
//       causing resolveEffectiveStats to produce NaN bonuses silently.
//   6 → currentLocation.x/y semantics changed from "world-map coordinates
//       (even when locationId is a town)" to "coordinates in the scene named
//       by locationId". Saves in Lumen Town / Ashenveil now resume in the
//       town they were saved in at the saved position; world-map saves resume
//       on the world map at the saved world-map position. v5 saves would place
//       the player at world-map coordinates on a town map — intentionally invalidated.
//   7 → World map rebuilt from a single Border Fields scene into the
//       two-continent world of Elerion. Locations renamed:
//         'border_fields' → 'world_map'
//         'north_pass'    → 'mountain_pass'
//         'ashenveil_road' → (removed; unused alias)
//       Old saves reference removed locationIds and would resume at
//       world-map coordinates that no longer exist — intentionally invalidated.

export const SAVE_VERSION = 7;
