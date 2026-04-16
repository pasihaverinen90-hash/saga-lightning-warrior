// src/game/battle/engine/battle-types.ts
// All pure data types for the battle engine.
// No logic, no Phaser, no imports from game state.
// Everything in the battle layer is expressed in these terms.

// ─── Combatant ────────────────────────────────────────────────────────────────

/** Which side a combatant belongs to. */
export type CombatantSide = 'ally' | 'enemy';

/**
 * A live unit in a battle. Derived from PartyMember or EnemyDef at battle
 * start. The engine works exclusively with Combatants — it never touches
 * PartyMember or EnemyDef directly during combat.
 */
export interface Combatant {
  /** Unique id within this battle (e.g. 'hugo', 'enemy_0'). */
  id: string;
  /** Display name. */
  name: string;
  side: CombatantSide;
  /**
   * For enemies: the key into the ENEMIES data record (e.g. 'braxtion_soldier').
   * Used by battle-result to look up gold rewards without name-matching.
   * Empty string for ally combatants.
   */
  sourceDefId: string;

  // ── Stats (mutable during battle) ────────────────────────────────────────
  maxHP:     number;
  currentHP: number;
  maxMP:     number;
  currentMP: number;
  attack:    number;
  magic:     number;
  defense:   number;
  speed:     number;

  // ── Skill / item access ───────────────────────────────────────────────────
  skillIds: string[];

  // ── Status ────────────────────────────────────────────────────────────────
  isDefending: boolean;    // cleared at the start of the unit's next turn
  isDefeated:  boolean;    // true when currentHP reaches 0

  // ── Visual identity (used by BattleScene for placeholder rendering) ────────
  colorHex: number;
  /** Current level — carried from PartyMember for display in the status panel. */
  level: number;
}

// ─── Commands ─────────────────────────────────────────────────────────────────

export type CommandType = 'attack' | 'skill' | 'item' | 'defend';

export interface AttackCommand {
  type: 'attack';
  actorId: string;
  targetId: string;
}

export interface SkillCommand {
  type: 'skill';
  actorId: string;
  skillId: string;
  targetId: string;   // for multi-target skills the engine fans out internally
}

export interface ItemCommand {
  type: 'item';
  actorId: string;
  itemId: string;
  targetId: string;
}

export interface DefendCommand {
  type: 'defend';
  actorId: string;
}

export type BattleCommand =
  | AttackCommand
  | SkillCommand
  | ItemCommand
  | DefendCommand;

// ─── Battle events (structured log of what happened) ─────────────────────────
// The engine returns BattleEvent[] after resolving each command.
// The scene reads this log to display feedback text — it never inspects
// intermediate engine state directly.

export interface DamageEvent {
  kind: 'damage';
  targetId: string;
  amount: number;
  element: string;
  isCrit: boolean;
}

export interface HealEvent {
  kind: 'heal';
  targetId: string;
  hpRestored: number;
  mpRestored: number;
}

export interface DefendEvent {
  kind: 'defend';
  actorId: string;
}

export interface DefeatedEvent {
  kind: 'defeated';
  targetId: string;
}

export interface MpCostEvent {
  kind: 'mp_cost';
  actorId: string;
  amount: number;
}

export interface MissEvent {
  kind: 'miss';
  targetId: string;
}

export interface NoTargetEvent {
  kind: 'no_target';
}

export type BattleEvent =
  | DamageEvent
  | HealEvent
  | DefendEvent
  | DefeatedEvent
  | MpCostEvent
  | MissEvent
  | NoTargetEvent;

// ─── Battle result ────────────────────────────────────────────────────────────

export type BattleOutcome = 'victory' | 'defeat' | 'ongoing';

export interface BattleResult {
  outcome: BattleOutcome;
  goldEarned: number;
  xpEarned: number;
}

// ─── Init data passed to BattleScene ─────────────────────────────────────────

export interface BattleInitData {
  /** IDs of enemies to fight, drawn from ENEMIES data. */
  enemyIds: string[];
  /** Scene key to return to when the battle ends. */
  returnSceneKey: string;
  /** Background colour string for the battlefield. */
  backgroundColorHex: string;
  /**
   * World map position (top-left) to return the player to after battle.
   * If omitted, WorldMapScene uses its default start position.
   */
  returnX?: number;
  returnY?: number;
  /**
   * Dialogue sequence ID to play before the first player command.
   * Used for boss encounter introductions.
   */
  introDialogueId?: string;
  /**
   * Dialogue sequence ID to play after victory, before the result panel closes.
   * Used for post-boss story beats. Effects (set_flag etc.) run from its onComplete.
   */
  outroDialogueId?: string;
  /** When true, BattleScene uses boss-specific result text. */
  isBoss?: boolean;
}
