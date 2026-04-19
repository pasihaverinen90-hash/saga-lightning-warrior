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
//       on the world map at the saved position. v5 saves would place the
//       player at world-map coordinates on a town map — intentionally invalidated.

export const SAVE_VERSION = 6;
