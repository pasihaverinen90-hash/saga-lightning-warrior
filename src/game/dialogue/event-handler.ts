// src/game/dialogue/event-handler.ts
// Executes declarative EventEffect arrays produced by dialogue sequences.
// Pure TypeScript — no Phaser, no scene coupling.
//
// This is the only module that translates dialogue data into state mutations.
// Scenes call runEffects() after dialogue completes; they do not inspect
// individual effects themselves.

import type { EventEffect } from './dialogue-types';
import { setStoryFlag, activatePartyMember, addGold, addItem } from '../state/state-actions';

/**
 * Executes every effect in the array in order.
 * Safe to call with an empty or undefined array — does nothing.
 */
export function runEffects(effects: EventEffect[] | undefined): void {
  if (!effects || effects.length === 0) return;

  for (const effect of effects) {
    switch (effect.type) {

      case 'set_flag':
        setStoryFlag(effect.flagId);
        break;

      case 'activate_party_member':
        activatePartyMember(effect.memberId);
        break;

      case 'add_gold':
        addGold(effect.amount);
        break;

      case 'add_item':
        addItem(effect.itemId, effect.quantity ?? 1);
        break;

      default:
        // TypeScript exhaustive-check guard — will error at compile time if
        // a new EventEffect variant is added without a matching case here.
        console.warn('[event-handler] unknown effect type:', (effect as EventEffect).type);
    }
  }
}
