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

export const SAVE_VERSION = 5;
