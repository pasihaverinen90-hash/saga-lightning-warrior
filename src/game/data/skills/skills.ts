// src/game/data/skills/skills.ts
// Skill definitions for player characters and enemies.

export interface SkillDef {
  id: string;
  name: string;
  mpCost: number;
  targetType: 'single_enemy' | 'all_enemies' | 'single_ally' | 'all_allies' | 'self';
  element: 'lightning' | 'ice' | 'fire' | 'dark' | 'none';
  /** Damage multiplier applied to the caster's relevant stat */
  power: number;
  description: string;
  /**
   * Explicitly sets which stat this skill scales from.
   * When omitted, damage.ts falls back to the element heuristic:
   *   element !== 'none' → magic,  element === 'none' → attack.
   * Use this override when element and scaling intent diverge — for example,
   * a physical-element skill that should use attack, or a no-element magical
   * skill that should use magic.
   */
  scalingStat?: 'attack' | 'magic';
}

export const SKILLS: Record<string, SkillDef> = {
  lightning_slash: {
    id: 'lightning_slash',
    name: 'Lightning Slash',
    mpCost: 8,
    targetType: 'single_enemy',
    element: 'lightning',
    power: 1.6,
    scalingStat: 'attack',  // sword strike charged with lightning — scales from attack, not magic
    description: 'A swift sword strike charged with lightning energy.',
  },
  ice_shard: {
    id: 'ice_shard',
    name: 'Ice Shard',
    mpCost: 8,
    targetType: 'single_enemy',
    element: 'ice',
    power: 1.7,
    description: 'A sharp shard of conjured ice fired at the target.',
  },
  flame_cleave: {
    id: 'flame_cleave',
    name: 'Flame Cleave',
    mpCost: 9,
    targetType: 'single_enemy',
    element: 'fire',
    power: 1.55,
    scalingStat: 'attack',  // physical axe blow — scales from attack, not magic
    description: 'A heavy axe swing wreathed in scorching flame.',
  },
  wisp_flare: {
    id: 'wisp_flare',
    name: 'Wisp Flare',
    mpCost: 8,
    targetType: 'single_enemy',
    element: 'none',
    power: 1.8,
    scalingStat: 'magic',   // spirit energy — scales from magic despite no element
    description: 'A burst of volatile spirit energy. Ignores elemental resistances.',
  },
  dark_bolt: {
    id: 'dark_bolt',
    name: 'Dark Bolt',
    mpCost: 10,
    targetType: 'single_enemy',
    element: 'dark',
    power: 1.5,
    description: 'A crackling bolt of dark magical energy.',
  },
  shadow_wave: {
    id: 'shadow_wave',
    name: 'Shadow Wave',
    mpCost: 18,
    targetType: 'all_enemies',
    element: 'dark',
    power: 1.2,
    description: 'A wave of dark energy that strikes all targets.',
  },
};
