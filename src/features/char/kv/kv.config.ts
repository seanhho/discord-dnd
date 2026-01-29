/**
 * KV Configuration - Character attribute key metadata.
 *
 * This configuration provides metadata for character attributes:
 * - Type information for validation and coercion
 * - Validation constraints (min, max, enum values)
 * - Grouping for help display
 * - Whether changing the key affects computed values
 *
 * IMPORTANT: The allowed keys are defined in @discord-bot/dnd5e-types.
 * This file only provides additional metadata for those keys.
 */

import {
  ABILITIES,
  SKILLS,
  CHAR_KV_KEY_GROUPS,
  CHAR_KV_GROUP_ORDER,
  isCharKvKey,
  isInventoryKey,
} from '@discord-bot/dnd5e-types';

export type KvType = 'number' | 'boolean' | 'string';

export interface KvKeyConfig {
  /** Expected type for this key */
  type: KvType;
  /** Human-readable description */
  description: string;
  /** Group for organizing in help output */
  group: string;
  /** Whether changing this key affects computed values (mods, proficiency) */
  affectsComputed: boolean;
  /** Minimum value (for numbers) */
  min?: number;
  /** Maximum value (for numbers) */
  max?: number;
  /** Allowed values (for enums) */
  enum?: string[];
  /** Example value for templates */
  example?: string;
}

/**
 * Complete registry of character attribute key metadata.
 */
export const KV_CONFIG: Record<string, KvKeyConfig> = {
  // Identity
  name: {
    type: 'string',
    description: 'Character name',
    group: 'identity',
    affectsComputed: false,
    example: '"Gandalf"',
  },
  class: {
    type: 'string',
    description: 'Character class (e.g., Fighter, Wizard)',
    group: 'identity',
    affectsComputed: false,
    example: '"Wizard"',
  },
  race: {
    type: 'string',
    description: 'Character race (e.g., Human, Elf)',
    group: 'identity',
    affectsComputed: false,
    example: '"Half-Elf"',
  },
  background: {
    type: 'string',
    description: 'Character background',
    group: 'identity',
    affectsComputed: false,
    example: '"Sage"',
  },
  level: {
    type: 'number',
    description: 'Character level (1-20)',
    group: 'identity',
    affectsComputed: true,
    min: 1,
    max: 20,
    example: '5',
  },

  // Ability Scores (generate from ABILITIES constant)
  ...Object.fromEntries(
    ABILITIES.map((ability) => [
      ability,
      {
        type: 'number' as KvType,
        description: `${ability.toUpperCase()} score`,
        group: 'abilities',
        affectsComputed: true,
        min: 1,
        max: 30,
        example: ability === 'str' ? '16' : ability === 'dex' ? '14' : '10',
      },
    ])
  ),

  // Combat Stats
  'hp.max': {
    type: 'number',
    description: 'Maximum hit points',
    group: 'combat',
    affectsComputed: false,
    min: 1,
    example: '45',
  },
  'hp.current': {
    type: 'number',
    description: 'Current hit points',
    group: 'combat',
    affectsComputed: false,
    min: 0,
    example: '32',
  },
  'hp.temp': {
    type: 'number',
    description: 'Temporary hit points',
    group: 'combat',
    affectsComputed: false,
    min: 0,
    example: '10',
  },
  ac: {
    type: 'number',
    description: 'Armor Class',
    group: 'combat',
    affectsComputed: false,
    min: 1,
    max: 50,
    example: '16',
  },
  speed: {
    type: 'number',
    description: 'Movement speed in feet',
    group: 'combat',
    affectsComputed: false,
    min: 0,
    max: 200,
    example: '30',
  },
  initiative: {
    type: 'number',
    description: 'Initiative bonus',
    group: 'combat',
    affectsComputed: false,
    example: '2',
  },

  // Equipment Slots
  'equip.armor.body': {
    type: 'string',
    description: 'Equipped body armor (item ID)',
    group: 'equipment',
    affectsComputed: false,
    example: '"plate_armor"',
  },
  'equip.armor.shield': {
    type: 'string',
    description: 'Equipped shield (item ID)',
    group: 'equipment',
    affectsComputed: false,
    example: '"shield"',
  },
  'equip.weapon.main': {
    type: 'string',
    description: 'Main hand weapon (item ID)',
    group: 'equipment',
    affectsComputed: false,
    example: '"longsword"',
  },
  'equip.weapon.off': {
    type: 'string',
    description: 'Off hand weapon (item ID)',
    group: 'equipment',
    affectsComputed: false,
    example: '"dagger"',
  },
  'equip.misc.primary': {
    type: 'string',
    description: 'Primary misc slot (item ID)',
    group: 'equipment',
    affectsComputed: false,
    example: '"amulet"',
  },
  'equip.misc.secondary': {
    type: 'string',
    description: 'Secondary misc slot (item ID)',
    group: 'equipment',
    affectsComputed: false,
    example: '"ring"',
  },

  // Skill Proficiencies (generate from SKILLS constant)
  ...Object.fromEntries(
    SKILLS.map((skill) => [
      `skill.${skill}`,
      {
        type: 'string' as KvType,
        description: `${skill.replace(/_/g, ' ')} proficiency`,
        group: 'skills',
        affectsComputed: true,
        enum: ['proficient', 'expertise'],
        example: '"proficient"',
      },
    ])
  ),

  // Saving Throw Proficiencies (generate from ABILITIES constant)
  ...Object.fromEntries(
    ABILITIES.map((ability) => [
      `save.${ability}`,
      {
        type: 'boolean' as KvType,
        description: `${ability.toUpperCase()} saving throw proficiency`,
        group: 'saves',
        affectsComputed: true,
        example: 'true',
      },
    ])
  ),

  // Misc Bonuses
  ac_bonus: {
    type: 'number',
    description: 'Misc AC bonus',
    group: 'bonuses',
    affectsComputed: false,
    example: '2',
  },
  attack_bonus: {
    type: 'number',
    description: 'Misc attack bonus',
    group: 'bonuses',
    affectsComputed: false,
    example: '1',
  },
  damage_bonus: {
    type: 'number',
    description: 'Misc damage bonus',
    group: 'bonuses',
    affectsComputed: false,
    example: '2',
  },

  // Skill Bonuses (generate from SKILLS constant)
  ...Object.fromEntries(
    SKILLS.map((skill) => [
      `skill_bonus.${skill}`,
      {
        type: 'number' as KvType,
        description: `${skill.replace(/_/g, ' ')} misc bonus`,
        group: 'bonuses',
        affectsComputed: false,
        example: '5',
      },
    ])
  ),

  // Legacy Weapon Keys (for backwards compatibility)
  'weapon.primary.name': {
    type: 'string',
    description: 'Primary weapon name (legacy)',
    group: 'legacy',
    affectsComputed: false,
    example: '"Longsword"',
  },
  'weapon.primary.damage': {
    type: 'string',
    description: 'Primary weapon damage dice (legacy)',
    group: 'legacy',
    affectsComputed: false,
    example: '"1d8+3"',
  },
  'weapon.primary.proficient': {
    type: 'boolean',
    description: 'Proficient with primary weapon (legacy)',
    group: 'legacy',
    affectsComputed: true,
    example: 'true',
  },
};

/**
 * Get the configuration for a static key, or undefined if not found.
 */
export function getKeyConfig(key: string): KvKeyConfig | undefined {
  return KV_CONFIG[key];
}

/**
 * Get the configuration for a key, including dynamic inventory keys.
 * Returns a default config for valid inventory keys.
 */
export function getKeyConfigOrDefault(key: string): KvKeyConfig | undefined {
  // Check static config first
  const staticConfig = KV_CONFIG[key];
  if (staticConfig) return staticConfig;

  // Check if it's a valid inventory key
  if (isInventoryKey(key)) {
    // Parse the property name to determine type
    const parts = key.split('.');
    const property = parts[2];

    // Determine type based on property
    const numberProps = ['qty', 'ac', 'attack_bonus', 'damage_bonus', 'magic_bonus', 'str_req'];
    const booleanProps = ['stealth_dis'];

    if (numberProps.includes(property ?? '')) {
      return {
        type: 'number',
        description: `Inventory item ${property}`,
        group: 'inventory',
        affectsComputed: false,
      };
    }

    if (booleanProps.includes(property ?? '')) {
      return {
        type: 'boolean',
        description: `Inventory item ${property}`,
        group: 'inventory',
        affectsComputed: false,
      };
    }

    // Default to string for other properties
    return {
      type: 'string',
      description: `Inventory item ${property}`,
      group: 'inventory',
      affectsComputed: false,
    };
  }

  return undefined;
}

/**
 * Check if a key is known in the configuration.
 * @deprecated Use isCharKvKey from @discord-bot/dnd5e-types instead
 */
export function isKnownKey(key: string): boolean {
  return isCharKvKey(key);
}

/**
 * Get all keys in a specific group.
 */
export function getKeysByGroup(group: string): string[] {
  // Check for new group structure first
  const groupKey = group as keyof typeof CHAR_KV_KEY_GROUPS;
  if (groupKey in CHAR_KV_KEY_GROUPS) {
    return [...CHAR_KV_KEY_GROUPS[groupKey]];
  }

  // Fallback to filtering KV_CONFIG for legacy groups
  return Object.entries(KV_CONFIG)
    .filter(([, config]) => config.group === group)
    .map(([key]) => key);
}

/**
 * Get all unique groups.
 */
export function getAllGroups(): string[] {
  return [...CHAR_KV_GROUP_ORDER];
}

/**
 * Group display order for help output.
 */
export const GROUP_ORDER = [...CHAR_KV_GROUP_ORDER, 'inventory'] as const;

/**
 * Human-readable group names.
 */
export const GROUP_NAMES: Record<string, string> = {
  identity: 'Identity',
  abilities: 'Ability Scores',
  combat: 'Combat Stats',
  equipment: 'Equipment Slots',
  skills: 'Skill Proficiencies',
  saves: 'Saving Throw Proficiencies',
  bonuses: 'Misc Bonuses',
  legacy: 'Legacy Weapon',
  inventory: 'Inventory Items (dynamic)',
};

// Re-export for convenience
export { isCharKvKey, isInventoryKey } from '@discord-bot/dnd5e-types';
