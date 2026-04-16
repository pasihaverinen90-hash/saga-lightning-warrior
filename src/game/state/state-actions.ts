// src/game/state/state-actions.ts
// Functions that mutate state in controlled ways.
// All state writes should go through here.

import { getState, patchState, setState, resetState } from './game-state';
import type { GameState, PartyMember, WorldPosition } from './game-state-types';
import type { EquipmentSlot } from '../data/equipment/equipment';
import { STARTING_PARTY } from '../data/characters/party-members';
import { BORDER_FIELDS_CONFIG } from '../data/maps/world-map-config';
import { PLAYER_W, PLAYER_H } from '../shared/constants/player';
import { processMemberXp, splitXp } from '../battle/engine/xp-system';
import type { MemberXpResult } from '../battle/engine/xp-system';

// ─── New Game ─────────────────────────────────────────────────────────────────

/**
 * Initializes a fresh game state. Called when the player starts a New Game.
 * Spawn position is derived from the world map config so there is a single
 * source of truth — changing playerStartX/Y in world-map-config.ts is enough.
 */
export function initNewGame(): void {
  resetState();
  patchState({
    initialized: true,
    gold: 50,
    party: STARTING_PARTY.map(m => ({ ...m })),
    inventory: [{ itemId: 'herb_tonic', quantity: 2 }],
    storyFlags: {},
    currentLocation: {
      locationId: 'border_fields',
      // Store CENTER coordinates — convention used throughout the save system.
      x: BORDER_FIELDS_CONFIG.playerStartX + PLAYER_W / 2,
      y: BORDER_FIELDS_CONFIG.playerStartY + PLAYER_H / 2,
    },
  });
}

// ─── Party ────────────────────────────────────────────────────────────────────

/**
 * Adds a party member if they are not already in the party.
 */
export function addPartyMember(member: PartyMember): void {
  const state = getState();
  if (state.party.some(m => m.id === member.id)) return;
  patchState({ party: [...state.party, member] });
}

/**
 * Sets isActive = true for a party member who is already in the roster.
 * Used by the dialogue event system when a character formally joins the party.
 * Has no effect if the member is not in the roster or is already active.
 */
export function activatePartyMember(memberId: string): void {
  const state = getState();
  if (!state.party.some(m => m.id === memberId)) return;
  patchState({
    party: state.party.map(m =>
      m.id === memberId ? { ...m, isActive: true } : m
    ),
  });
}

/**
 * Updates HP/MP for a party member in-place.
 */
export function updatePartyMemberHP(memberId: string, newHP: number, newMP?: number): void {
  const state = getState();
  const party = state.party.map(m => {
    if (m.id !== memberId) return m;
    return {
      ...m,
      stats: {
        ...m.stats,
        currentHP: Math.max(0, Math.min(newHP, m.stats.maxHP)),
        currentMP: newMP !== undefined ? Math.max(0, Math.min(newMP, m.stats.maxMP)) : m.stats.currentMP,
      },
    };
  });
  patchState({ party });
}

/**
 * Fully restores HP and MP for all active party members.
 */
export function restorePartyFull(): void {
  const state = getState();
  const party = state.party.map(m => ({
    ...m,
    stats: { ...m.stats, currentHP: m.stats.maxHP, currentMP: m.stats.maxMP },
  }));
  patchState({ party });
}

// ─── Gold ─────────────────────────────────────────────────────────────────────

export function addGold(amount: number): void {
  patchState({ gold: Math.max(0, getState().gold + amount) });
}

export function spendGold(amount: number): boolean {
  const state = getState();
  if (state.gold < amount) return false;
  patchState({ gold: state.gold - amount });
  return true;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export function addItem(itemId: string, quantity = 1): void {
  const state = getState();
  const existing = state.inventory.find(e => e.itemId === itemId);
  if (existing) {
    patchState({
      inventory: state.inventory.map(e =>
        e.itemId === itemId ? { ...e, quantity: e.quantity + quantity } : e
      ),
    });
  } else {
    patchState({ inventory: [...state.inventory, { itemId, quantity }] });
  }
}

export function removeItem(itemId: string, quantity = 1): boolean {
  const state = getState();
  const existing = state.inventory.find(e => e.itemId === itemId);
  if (!existing || existing.quantity < quantity) return false;
  const newQty = existing.quantity - quantity;
  patchState({
    inventory:
      newQty === 0
        ? state.inventory.filter(e => e.itemId !== itemId)
        : state.inventory.map(e =>
            e.itemId === itemId ? { ...e, quantity: newQty } : e
          ),
  });
  return true;
}

// ─── Story flags ─────────────────────────────────────────────────────────────

export function setStoryFlag(flagId: string, value = true): void {
  const state = getState();
  patchState({ storyFlags: { ...state.storyFlags, [flagId]: value } });
}

// ─── Location ────────────────────────────────────────────────────────────────

export function setCurrentLocation(position: WorldPosition): void {
  patchState({ currentLocation: position });
}

// ─── Load from save ──────────────────────────────────────────────────────────

export function loadStateFromSave(savedState: GameState): void {
  setState(savedState);
}

// ─── XP and leveling ─────────────────────────────────────────────────────────

/**
 * Splits the total battle XP pool equally among active party members and
 * applies the result to each member, resolving any level-ups.
 *
 * Distribution: integer division with the remainder given one extra point to
 * the first N members in party order (deterministic, no randomness).
 * Example: 100 XP, 3 active members → [34, 33, 33].
 *
 * Inactive members receive 0 XP.
 * Returns a MemberXpResult for every active member (xpGained reflects the share).
 */
export function applyBattleXp(totalXp: number): MemberXpResult[] {
  if (totalXp <= 0) return [];

  const state        = getState();
  const activeIdxs   = state.party
    .map((m, i) => (m.isActive ? i : -1))
    .filter(i => i >= 0);

  if (activeIdxs.length === 0) return [];

  // Split the pool — per-member shares in the same order as activeIdxs
  const shares = splitXp(totalXp, activeIdxs.length);

  const results: MemberXpResult[] = [];
  const updatedParty = state.party.map((member, idx) => {
    const shareIdx = activeIdxs.indexOf(idx);
    if (shareIdx === -1) return member;           // inactive — skip
    const share = shares[shareIdx];
    const { updated, result } = processMemberXp(member, share);
    results.push(result);
    return updated;
  });

  patchState({ party: updatedParty });
  return results;
}

// ─── Equipment ────────────────────────────────────────────────────────────────

/**
 * Equips an item onto a party member's weapon or armor slot.
 * The previous item in that slot is simply replaced (not returned to inventory).
 * Silently does nothing if the member is not found.
 */
export function equipItem(
  memberId:  string,
  slot:      EquipmentSlot,
  equipId:   string | null,
): void {
  const state = getState();
  patchState({
    party: state.party.map(m =>
      m.id !== memberId
        ? m
        : { ...m, equipment: { ...m.equipment, [slot]: equipId } }
    ),
  });
}
