// src/game/town/systems/shop-service.ts
// Pure TypeScript. Handles item and equipment purchase logic.
// No Phaser, no scene coupling. TownScene calls these functions;
// it never performs gold/inventory mutations directly.
//
// Shop stock (which items to sell) lives in the town's data config
// (TownMapConfig.shopStock), not here. This keeps shop-service
// town-agnostic and ready for multiple towns.
//
// Equipment purchase design:
//   On purchase, the item is immediately equipped on every active party member
//   whose current slot is empty or holds a weaker (lower-priced) item.
//   Members who already carry equal or better gear are skipped.
//   This prototype approach works cleanly without a dedicated equip UI.

import { ITEMS } from '../../data/items/items';
import { EQUIPMENT } from '../../data/equipment/equipment';
import { spendGold, addItem, equipItem } from '../../state/state-actions';
import { getGold, getItemQuantity } from '../../state/state-selectors';
import { getParty } from '../../state/state-selectors';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PurchaseResult =
  | { ok: true;  message: string }
  | { ok: false; message: string };

// ─── Label helpers ────────────────────────────────────────────────────────────

/**
 * Returns the display label for a shop row.
 * Works for both consumable items and equipment.
 * Format examples:
 *   "Herb Tonic  —  30g   (have: 2)"
 *   "Steel Sword  —  280g   [weapon]"
 */
export function shopItemLabel(itemId: string): string {
  const equip = EQUIPMENT[itemId];
  if (equip) {
    return `${equip.name}  —  ${equip.price}g   [${equip.slot}]`;
  }
  const item = ITEMS[itemId];
  if (!item) return itemId;
  const owned = getItemQuantity(itemId);
  return `${item.name}  —  ${item.price}g   (have: ${owned})`;
}

// ─── Purchase logic ───────────────────────────────────────────────────────────

/**
 * Attempts to purchase one consumable item.
 * Validates gold, deducts cost, adds to inventory.
 */
export function purchaseItem(itemId: string): PurchaseResult {
  const def = ITEMS[itemId];
  if (!def) return { ok: false, message: 'Unknown item.' };

  const gold = getGold();
  if (gold < def.price) {
    return {
      ok: false,
      message: `Not enough gold.\nNeed ${def.price}g, have ${gold}g.`,
    };
  }

  spendGold(def.price);
  addItem(itemId, 1);

  return {
    ok: true,
    message: `Bought ${def.name}.\n${def.description}`,
  };
}

/**
 * Attempts to purchase a piece of equipment.
 * On success, immediately equips it on every active party member whose
 * current slot is empty or holds a cheaper item (lower-tier upgrade logic).
 * Members with equal or better gear are skipped.
 *
 * Gold is only deducted once regardless of how many members are equipped —
 * buying one piece of gear upgrades the whole eligible party.
 */
export function purchaseEquipment(equipId: string): PurchaseResult {
  const def = EQUIPMENT[equipId];
  if (!def)  return { ok: false, message: 'Unknown equipment.' };
  if (def.price <= 0) return { ok: false, message: "That item isn't for sale." };

  const gold = getGold();
  if (gold < def.price) {
    return {
      ok: false,
      message: `Not enough gold.\nNeed ${def.price}g, have ${gold}g.`,
    };
  }

  spendGold(def.price);

  // Equip on all active members who would benefit.
  const equipped: string[] = [];
  for (const member of getParty()) {
    if (!member.isActive) continue;
    const currentId = member.equipment[def.slot];
    const currentPrice = currentId ? (EQUIPMENT[currentId]?.price ?? 0) : 0;
    // Equip if: slot is empty (null), or current item is a starting piece (price 0),
    // or current item is cheaper than the new one.
    if (currentId === null || currentPrice < def.price) {
      equipItem(member.id, def.slot, equipId);
      equipped.push(member.name);
    }
  }

  if (equipped.length === 0) {
    // Purchased but nobody needed it — refund and explain.
    // (Unlikely in practice but handles edge cases gracefully.)
    spendGold(-def.price); // refund
    return {
      ok: false,
      message: `${def.name}\nYour party already has better equipment.`,
    };
  }

  const who = equipped.join(', ');
  return {
    ok: true,
    message: `${def.name} equipped.\n${who}`,
  };
}

/**
 * Returns true if the given id is an equipment definition.
 * Used by TownScene to route to the correct purchase function.
 */
export function isEquipmentId(id: string): boolean {
  return id in EQUIPMENT;
}

/**
 * Returns the current inn rest cost.
 * Currently free — placeholder for future gold-cost mechanic.
 */
export function getInnRestCost(): number {
  return 0;
}
