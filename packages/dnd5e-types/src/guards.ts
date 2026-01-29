/**
 * Type guards for D&D 5e identifiers.
 *
 * Simple validation functions that check if a value is a valid identifier.
 */

import { ABILITIES, type Ability } from './abilities.js';
import { SKILLS, type Skill } from './skills.js';
import { DAMAGE_TYPES, type DamageType } from './damage.js';
import { CONDITIONS, type Condition } from './conditions.js';
import { WEAPON_PROPERTIES, type WeaponProperty } from './combat.js';

/**
 * Check if a value is a valid ability identifier.
 */
export function isAbility(value: unknown): value is Ability {
  return typeof value === 'string' && ABILITIES.includes(value as Ability);
}

/**
 * Check if a value is a valid skill identifier.
 */
export function isSkill(value: unknown): value is Skill {
  return typeof value === 'string' && SKILLS.includes(value as Skill);
}

/**
 * Check if a value is a valid damage type identifier.
 */
export function isDamageType(value: unknown): value is DamageType {
  return typeof value === 'string' && DAMAGE_TYPES.includes(value as DamageType);
}

/**
 * Check if a value is a valid condition identifier.
 */
export function isCondition(value: unknown): value is Condition {
  return typeof value === 'string' && CONDITIONS.includes(value as Condition);
}

/**
 * Check if a value is a valid weapon property identifier.
 */
export function isWeaponProperty(value: unknown): value is WeaponProperty {
  return typeof value === 'string' && WEAPON_PROPERTIES.includes(value as WeaponProperty);
}
