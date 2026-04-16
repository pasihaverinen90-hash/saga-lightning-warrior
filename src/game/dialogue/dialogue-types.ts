// src/game/dialogue/dialogue-types.ts
// Types for the dialogue and event system.

export type SpeakerId =
  | 'hugo'
  | 'serelle_vaun'
  | 'kael'
  | 'narrator'
  | 'innkeeper'
  | 'shopkeeper'
  | 'villager'
  | 'guard'
  | 'enemy_mage'
  | string;

export interface DialogueLine {
  speaker: SpeakerId;
  text: string;
}

// ─── Event effects ────────────────────────────────────────────────────────────
// Declarative side-effects that execute after a dialogue sequence completes.
// event-handler.ts is the only place that interprets these — scenes and data
// files define them, but never execute state mutations directly.

/** Sets a named story flag to true in game state. */
export interface SetFlagEffect {
  type: 'set_flag';
  flagId: string;
}

/**
 * Activates a party member who is already in the roster.
 * "Activate" means setting isActive = true so they appear in battle.
 */
export interface ActivatePartyMemberEffect {
  type: 'activate_party_member';
  memberId: string;
}

/** Adds gold to the player's total. Used to grant event rewards. */
export interface AddGoldEffect {
  type: 'add_gold';
  amount: number;
}

/** Adds one or more of a consumable item to inventory. Used to grant event rewards. */
export interface AddItemEffect {
  type: 'add_item';
  itemId: string;
  quantity?: number;   // defaults to 1 if omitted
}

/** Union of all supported event effects. Add new variants here as needed. */
export type EventEffect =
  | SetFlagEffect
  | ActivatePartyMemberEffect
  | AddGoldEffect
  | AddItemEffect;

// ─── Dialogue sequence ────────────────────────────────────────────────────────

export interface DialogueSequence {
  id: string;
  lines: DialogueLine[];
  /**
   * Effects to execute after the last line is dismissed.
   * Replaces the old setFlagOnComplete string — supports multiple effects
   * and different effect types cleanly.
   */
  onComplete?: EventEffect[];
}

