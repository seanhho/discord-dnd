/**
 * D&D 5e Combat Types
 *
 * Types related to combat mechanics.
 */

/**
 * Advantage/disadvantage state for a roll.
 */
export type AdvantageState = 'none' | 'advantage' | 'disadvantage';

/**
 * Attack type classification.
 */
export type AttackType = 'melee' | 'ranged';

/**
 * Weapon property identifiers.
 */
export const WEAPON_PROPERTIES = [
  'ammunition',
  'finesse',
  'heavy',
  'light',
  'loading',
  'range',
  'reach',
  'special',
  'thrown',
  'two_handed',
  'versatile',
] as const;

/**
 * Weapon property type.
 */
export type WeaponProperty = (typeof WEAPON_PROPERTIES)[number];

/**
 * Armor category classification.
 */
export type ArmorCategory = 'light' | 'medium' | 'heavy' | 'shield';
