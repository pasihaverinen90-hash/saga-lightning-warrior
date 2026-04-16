// src/game/data/equipment/equipment.ts
// All equipment item definitions.
// Equipment provides flat stat bonuses applied on top of a character's base stats.
// Only weapon and armor slots exist for now; accessories can be added later.

export type EquipmentSlot = 'weapon' | 'armor';

/**
 * Flat stat bonuses granted by this piece of equipment.
 * All fields are optional — omit stats the item does not affect.
 * currentHP and currentMP are intentionally excluded: equipment affects
 * maximums only; current values are handled by runtime healing/damage.
 */
export interface EquipmentBonuses {
  maxHP?:    number;
  maxMP?:    number;
  attack?:   number;
  magic?:    number;
  defense?:  number;
  speed?:    number;
}

export interface EquipmentDef {
  id:          string;
  name:        string;
  description: string;
  slot:        EquipmentSlot;
  price:       number;
  bonuses:     EquipmentBonuses;
}

export const EQUIPMENT: Record<string, EquipmentDef> = {

  // ── Weapons ──────────────────────────────────────────────────────────────────

  iron_sword: {
    id:          'iron_sword',
    name:        'Iron Sword',
    description: "A reliable straight sword. Hugo's starting weapon.",
    slot:        'weapon',
    price:       0,   // starting gear — not purchasable
    bonuses:     { attack: 6 },
  },

  apprentice_rod: {
    id:          'apprentice_rod',
    name:        'Apprentice Rod',
    description: "A slender channeling rod for spell focus. Serelle's starting weapon.",
    slot:        'weapon',
    price:       0,
    bonuses:     { magic: 7 },
  },

  battle_axe: {
    id:          'battle_axe',
    name:        'Battle Axe',
    description: "A heavy iron axe built for raw power. Kael's starting weapon.",
    slot:        'weapon',
    price:       0,
    bonuses:     { attack: 8, speed: -1 },  // power offset by slight speed penalty
  },

  war_axe: {
    id:          'war_axe',
    name:        'War Axe',
    description: 'A heavier, better-balanced axe forged for serious combat.',
    slot:        'weapon',
    price:       300,
    bonuses:     { attack: 13, speed: -1 },  // stronger than battle_axe; same speed trade-off
  },

  steel_sword: {
    id:          'steel_sword',
    name:        'Steel Sword',
    description: 'A well-forged sword with a keen edge. Better than iron.',
    slot:        'weapon',
    price:       280,
    bonuses:     { attack: 11 },
  },

  ice_scepter: {
    id:          'ice_scepter',
    name:        'Ice Scepter',
    description: 'A scepter attuned to cold magic. Amplifies ice spells.',
    slot:        'weapon',
    price:       320,
    bonuses:     { magic: 13, speed: 1 },
  },

  // ── Armor ────────────────────────────────────────────────────────────────────

  leather_vest: {
    id:          'leather_vest',
    name:        'Leather Vest',
    description: "Lightweight cured leather armor. Hugo's starting armor.",
    slot:        'armor',
    price:       0,
    bonuses:     { defense: 5, maxHP: 10 },
  },

  cloth_robe: {
    id:          'cloth_robe',
    name:        'Cloth Robe',
    description: "Light mage robes that allow free movement. Serelle's starting armor.",
    slot:        'armor',
    price:       0,
    bonuses:     { defense: 3, maxMP: 12 },
  },

  iron_plate: {
    id:          'iron_plate',
    name:        'Iron Plate',
    description: "Heavy iron chest armor. Sturdy but slows the wearer slightly.",
    slot:        'armor',
    price:       0,
    bonuses:     { defense: 9, maxHP: 20, speed: -1 },
  },

  chain_mail: {
    id:          'chain_mail',
    name:        'Chain Mail',
    description: 'Interlocked steel rings offering solid protection.',
    slot:        'armor',
    price:       350,
    bonuses:     { defense: 8, maxHP: 18 },
  },

  mage_coat: {
    id:          'mage_coat',
    name:        "Mage's Coat",
    description: 'A reinforced coat enchanted for magical endurance.',
    slot:        'armor',
    price:       300,
    bonuses:     { defense: 5, maxMP: 20, magic: 2 },
  },
};
