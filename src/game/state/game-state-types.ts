// src/game/state/game-state-types.ts
// All types that describe the runtime game state.
// Pure type definitions — no logic here.

// ─── Character Stats ──────────────────────────────────────────────────────────
export interface CharacterStats {
  maxHP: number;
  currentHP: number;
  maxMP: number;
  currentMP: number;
  attack: number;
  magic: number;
  defense: number;
  speed: number;
}

// ─── Equipment ────────────────────────────────────────────────────────────────

/**
 * The two equipment slots a party member can fill.
 * null means the slot is empty (unequipped).
 * Each value is an equipment item id from data/equipment/equipment.ts.
 */
export interface EquipmentSlots {
  weapon: string | null;
  armor:  string | null;
}

// ─── Party Member ─────────────────────────────────────────────────────────────
export interface PartyMember {
  id: string;
  name: string;
  /** Current character level. Starts at 1. */
  level: number;
  /** Accumulated XP toward the next level. */
  xp: number;
  stats: CharacterStats;
  skillIds: string[];
  isActive: boolean;
  /** Equipped items. Stat bonuses are resolved at battle time via equipment-system.ts. */
  equipment: EquipmentSlots;
  /** Visual color identity used by BattleScene for placeholder sprite rendering. */
  colorHex: number;
}

// ─── Inventory ────────────────────────────────────────────────────────────────
export interface InventoryEntry {
  itemId: string;
  quantity: number;
}

// ─── Story flags ─────────────────────────────────────────────────────────────
// A flat map of string flag ids → boolean values.
// e.g. { serelle_joined: true, chapter_1_complete: false }
export type StoryFlags = Record<string, boolean>;

// ─── Player position ─────────────────────────────────────────────────────────
export interface WorldPosition {
  locationId: string;
  x: number;
  y: number;
}

// ─── Root game state ─────────────────────────────────────────────────────────
export interface GameState {
  initialized: boolean;
  gold: number;
  party: PartyMember[];
  inventory: InventoryEntry[];
  storyFlags: StoryFlags;
  currentLocation: WorldPosition;
}
