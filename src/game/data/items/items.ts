// src/game/data/items/items.ts
// Consumable item definitions.

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  price: number;
  targetType: 'single_ally' | 'all_allies';
  effect: {
    restoreHP?: number;
    restoreMP?: number;
  };
}

export const ITEMS: Record<string, ItemDef> = {
  herb_tonic: {
    id: 'herb_tonic',
    name: 'Herb Tonic',
    description: 'A herbal brew that restores a modest amount of HP.',
    price: 30,
    targetType: 'single_ally',
    effect: { restoreHP: 60 },
  },
  clearwater_drop: {
    id: 'clearwater_drop',
    name: 'Clearwater Drop',
    description: 'Purified spring water that restores MP.',
    price: 40,
    targetType: 'single_ally',
    effect: { restoreMP: 25 },
  },
  healing_salve: {
    id: 'healing_salve',
    name: 'Healing Salve',
    description: 'A potent herbal compound that restores a substantial amount of HP.',
    price: 75,
    targetType: 'single_ally',
    effect: { restoreHP: 140 },
  },
  ether_vial: {
    id: 'ether_vial',
    name: 'Ether Vial',
    description: 'A refined alchemical solution that restores a large amount of MP.',
    price: 90,
    targetType: 'single_ally',
    effect: { restoreMP: 60 },
  },
};
