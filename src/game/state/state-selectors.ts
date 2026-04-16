// src/game/state/state-selectors.ts
// Pure read functions for querying state.
// Scenes and systems should use these rather than reading state directly.

import { getState } from './game-state';
import type { PartyMember, InventoryEntry } from './game-state-types';

export function getGold(): number {
  return getState().gold;
}

export function getParty(): ReadonlyArray<PartyMember> {
  return getState().party;
}

export function getActiveParty(): PartyMember[] {
  return getState().party.filter(m => m.isActive);
}

export function getPartyMember(id: string): PartyMember | undefined {
  return getState().party.find(m => m.id === id);
}

export function getInventory(): ReadonlyArray<InventoryEntry> {
  return getState().inventory;
}

export function getItemQuantity(itemId: string): number {
  return getState().inventory.find(e => e.itemId === itemId)?.quantity ?? 0;
}

export function getStoryFlag(flagId: string): boolean {
  return getState().storyFlags[flagId] ?? false;
}

/** Returns the full story flags map. Use when passing to a system that needs all flags. */
export function getStoryFlags(): import('./game-state-types').StoryFlags {
  return getState().storyFlags;
}

export function getCurrentLocation() {
  return getState().currentLocation;
}

export function isGameInitialized(): boolean {
  return getState().initialized;
}
