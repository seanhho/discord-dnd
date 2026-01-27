/**
 * KV Configuration - Single source of truth for character attribute keys.
 *
 * This configuration defines:
 * - Valid key names and their expected types
 * - Validation constraints (min, max, enum values)
 * - Grouping for help display
 * - Whether changing the key affects computed values
 *
 * Unknown keys (not defined here) are allowed but stored as strings
 * with a warning to the user.
 */

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
 * Complete registry of known character attribute keys.
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
  level: {
    type: 'number',
    description: 'Character level (1-20)',
    group: 'identity',
    affectsComputed: true,
    min: 1,
    max: 20,
    example: '5',
  },

  // Ability Scores
  str: {
    type: 'number',
    description: 'Strength score',
    group: 'abilities',
    affectsComputed: true,
    min: 1,
    max: 30,
    example: '16',
  },
  dex: {
    type: 'number',
    description: 'Dexterity score',
    group: 'abilities',
    affectsComputed: true,
    min: 1,
    max: 30,
    example: '14',
  },
  con: {
    type: 'number',
    description: 'Constitution score',
    group: 'abilities',
    affectsComputed: true,
    min: 1,
    max: 30,
    example: '12',
  },
  int: {
    type: 'number',
    description: 'Intelligence score',
    group: 'abilities',
    affectsComputed: true,
    min: 1,
    max: 30,
    example: '10',
  },
  wis: {
    type: 'number',
    description: 'Wisdom score',
    group: 'abilities',
    affectsComputed: true,
    min: 1,
    max: 30,
    example: '13',
  },
  cha: {
    type: 'number',
    description: 'Charisma score',
    group: 'abilities',
    affectsComputed: true,
    min: 1,
    max: 30,
    example: '8',
  },

  // Hit Points
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

  // Combat Stats
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

  // Primary Weapon
  'weapon.primary.name': {
    type: 'string',
    description: 'Primary weapon name',
    group: 'equipment',
    affectsComputed: false,
    example: '"Longsword"',
  },
  'weapon.primary.damage': {
    type: 'string',
    description: 'Primary weapon damage dice (e.g., 1d8+3)',
    group: 'equipment',
    affectsComputed: false,
    example: '"1d8+3"',
  },
  'weapon.primary.proficient': {
    type: 'boolean',
    description: 'Proficient with primary weapon',
    group: 'equipment',
    affectsComputed: true,
    example: 'true',
  },
} as const;

/**
 * Get the configuration for a key, or undefined if not a known key.
 */
export function getKeyConfig(key: string): KvKeyConfig | undefined {
  return KV_CONFIG[key];
}

/**
 * Check if a key is known in the configuration.
 */
export function isKnownKey(key: string): boolean {
  return key in KV_CONFIG;
}

/**
 * Get all keys in a specific group.
 */
export function getKeysByGroup(group: string): string[] {
  return Object.entries(KV_CONFIG)
    .filter(([, config]) => config.group === group)
    .map(([key]) => key);
}

/**
 * Get all unique groups.
 */
export function getAllGroups(): string[] {
  const groups = new Set(Object.values(KV_CONFIG).map((c) => c.group));
  return Array.from(groups);
}

/**
 * Group display order for help output.
 */
export const GROUP_ORDER = ['identity', 'abilities', 'combat', 'equipment'];

/**
 * Human-readable group names.
 */
export const GROUP_NAMES: Record<string, string> = {
  identity: 'Identity',
  abilities: 'Ability Scores',
  combat: 'Combat',
  equipment: 'Equipment',
};
