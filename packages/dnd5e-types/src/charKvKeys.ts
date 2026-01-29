/**
 * Character KV Key Definitions
 *
 * This module is the SINGLE SOURCE OF TRUTH for allowed character attribute keys.
 * The /char set command will ONLY accept keys defined here.
 *
 * Key categories:
 * - Static keys: Fixed key names (e.g., "str", "hp.max")
 * - Dynamic keys: Pattern-based keys (e.g., "inv.<itemId>.name")
 */

import { ABILITIES } from './abilities.js';
import { SKILLS } from './skills.js';

// ─────────────────────────────────────────────────────────────────────────────
// Static Keys
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identity keys
 */
const IDENTITY_KEYS = ['name', 'class', 'level', 'race', 'background'] as const;

/**
 * Ability score keys (derived from ABILITIES constant)
 */
const ABILITY_KEYS = ABILITIES;

/**
 * Combat stat keys
 */
const COMBAT_KEYS = [
  'hp.max',
  'hp.current',
  'hp.temp',
  'ac',
  'speed',
  'initiative',
] as const;

/**
 * Equipment slot keys
 */
const EQUIP_SLOT_KEYS = [
  'equip.armor.body',
  'equip.armor.shield',
  'equip.weapon.main',
  'equip.weapon.off',
  'equip.misc.primary',
  'equip.misc.secondary',
] as const;

/**
 * Skill proficiency keys (derived from SKILLS constant)
 * Format: skill.<skillName>
 */
const SKILL_PROFICIENCY_KEYS = SKILLS.map((s) => `skill.${s}` as const);

/**
 * Saving throw proficiency keys (derived from ABILITIES constant)
 * Format: save.<ability>
 */
const SAVE_PROFICIENCY_KEYS = ABILITIES.map((a) => `save.${a}` as const);

/**
 * Misc bonus keys
 */
const BONUS_KEYS = [
  'ac_bonus',
  'attack_bonus',
  'damage_bonus',
] as const;

/**
 * Skill bonus keys (derived from SKILLS constant)
 * Format: skill_bonus.<skillName>
 */
const SKILL_BONUS_KEYS = SKILLS.map((s) => `skill_bonus.${s}` as const);

/**
 * Legacy weapon keys (for backwards compatibility with existing data)
 */
const LEGACY_WEAPON_KEYS = [
  'weapon.primary.name',
  'weapon.primary.damage',
  'weapon.primary.proficient',
] as const;

/**
 * All static character KV keys.
 */
export const CHAR_KV_KEYS: readonly string[] = [
  ...IDENTITY_KEYS,
  ...ABILITY_KEYS,
  ...COMBAT_KEYS,
  ...EQUIP_SLOT_KEYS,
  ...SKILL_PROFICIENCY_KEYS,
  ...SAVE_PROFICIENCY_KEYS,
  ...BONUS_KEYS,
  ...SKILL_BONUS_KEYS,
  ...LEGACY_WEAPON_KEYS,
];

/**
 * Set of static keys for O(1) lookup.
 */
export const CHAR_KV_KEY_SET: ReadonlySet<string> = new Set(CHAR_KV_KEYS);

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Key Patterns
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valid inventory item property names.
 */
export const INVENTORY_ITEM_PROPERTIES = [
  'name',
  'type',
  'qty',
  'notes',
  'ac',
  'damage',
  'damage_type',
  'attack_type',
  'attack_bonus',
  'damage_bonus',
  'armor_category',
  'magic_bonus',
  'str_req',
  'stealth_dis',
  'properties',
  'tags',
] as const;

export type InventoryItemProperty = (typeof INVENTORY_ITEM_PROPERTIES)[number];

/**
 * Pattern for valid item IDs: lowercase alphanumeric with underscores.
 */
const ITEM_ID_PATTERN = /^[a-z0-9_]+$/;

/**
 * Pattern for valid inventory keys: inv.<itemId>.<property>
 */
const INVENTORY_KEY_PATTERN = new RegExp(
  `^inv\\.[a-z0-9_]+\\.(${INVENTORY_ITEM_PROPERTIES.join('|')})$`
);

// ─────────────────────────────────────────────────────────────────────────────
// Key Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a key is a valid character KV key.
 *
 * Returns true for:
 * - Static keys in CHAR_KV_KEY_SET
 * - Dynamic inventory keys matching inv.<itemId>.<property>
 *
 * @param key - The key to validate
 * @returns true if the key is allowed
 */
export function isCharKvKey(key: string): boolean {
  // Check static keys first (O(1) lookup)
  if (CHAR_KV_KEY_SET.has(key)) {
    return true;
  }

  // Check dynamic inventory pattern
  if (key.startsWith('inv.')) {
    return INVENTORY_KEY_PATTERN.test(key);
  }

  return false;
}

/**
 * Validate an item ID for inventory keys.
 *
 * @param itemId - The item ID to validate
 * @returns true if the item ID is valid (lowercase alphanumeric with underscores)
 */
export function isValidItemId(itemId: string): boolean {
  return ITEM_ID_PATTERN.test(itemId) && itemId.length > 0 && itemId.length <= 64;
}

/**
 * Check if a key is an inventory key.
 */
export function isInventoryKey(key: string): boolean {
  return key.startsWith('inv.') && INVENTORY_KEY_PATTERN.test(key);
}

/**
 * Parse an inventory key into its components.
 *
 * @param key - The inventory key (e.g., "inv.longsword.name")
 * @returns Parsed components or null if invalid
 */
export function parseInventoryKey(
  key: string
): { itemId: string; property: InventoryItemProperty } | null {
  if (!key.startsWith('inv.')) return null;

  const parts = key.split('.');
  if (parts.length !== 3) return null;

  const itemId = parts[1]!;
  const property = parts[2]! as InventoryItemProperty;

  if (!isValidItemId(itemId)) return null;
  if (!INVENTORY_ITEM_PROPERTIES.includes(property)) return null;

  return { itemId, property };
}

/**
 * Get a list of invalid keys from a set of keys.
 *
 * @param keys - Keys to validate
 * @returns Array of invalid keys (empty if all valid)
 */
export function getInvalidKeys(keys: string[]): string[] {
  return keys.filter((key) => !isCharKvKey(key));
}

/**
 * Validate all keys and return detailed results.
 *
 * @param keys - Keys to validate
 * @returns Validation result with valid and invalid keys
 */
export function validateCharKvKeys(keys: string[]): {
  valid: boolean;
  validKeys: string[];
  invalidKeys: string[];
} {
  const validKeys: string[] = [];
  const invalidKeys: string[] = [];

  for (const key of keys) {
    if (isCharKvKey(key)) {
      validKeys.push(key);
    } else {
      invalidKeys.push(key);
    }
  }

  return {
    valid: invalidKeys.length === 0,
    validKeys,
    invalidKeys,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Key Groups (for help display)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Key groups for organizing help output.
 */
export const CHAR_KV_KEY_GROUPS = {
  identity: IDENTITY_KEYS,
  abilities: ABILITY_KEYS,
  combat: COMBAT_KEYS,
  equipment: EQUIP_SLOT_KEYS,
  skills: SKILL_PROFICIENCY_KEYS,
  saves: SAVE_PROFICIENCY_KEYS,
  bonuses: [...BONUS_KEYS, ...SKILL_BONUS_KEYS],
  legacy: LEGACY_WEAPON_KEYS,
} as const;

/**
 * Human-readable group names.
 */
export const CHAR_KV_GROUP_NAMES: Record<keyof typeof CHAR_KV_KEY_GROUPS, string> = {
  identity: 'Identity',
  abilities: 'Ability Scores',
  combat: 'Combat Stats',
  equipment: 'Equipment Slots',
  skills: 'Skill Proficiencies',
  saves: 'Saving Throw Proficiencies',
  bonuses: 'Misc Bonuses',
  legacy: 'Legacy Weapon',
};

/**
 * Group display order.
 */
export const CHAR_KV_GROUP_ORDER: (keyof typeof CHAR_KV_KEY_GROUPS)[] = [
  'identity',
  'abilities',
  'combat',
  'equipment',
  'skills',
  'saves',
  'bonuses',
  'legacy',
];
