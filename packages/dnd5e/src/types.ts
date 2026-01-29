/**
 * D&D 5e internal types for the rules package.
 *
 * These types build on @discord-bot/dnd5e-types and add
 * rule-specific structures.
 */

import type {
  AbilityScores,
  Skill,
  SkillProficiencies,
  SavingThrowProficiencies,
  DamageType,
  AttackType,
  WeaponProperty,
  ArmorCategory,
} from '@discord-bot/dnd5e-types';

/**
 * Snapshot of a character's 5e stats for rule calculations.
 *
 * This is a read-only view of character data used by rules functions.
 * It is NOT a persistence model.
 */
export interface Character5eSnapshot {
  /** Character name (for display) */
  name: string;
  /** Character level (1-20) */
  level: number;
  /** All six ability scores */
  abilityScores: AbilityScores;
  /** Skill proficiencies */
  skillProficiencies?: SkillProficiencies;
  /** Saving throw proficiencies */
  savingThrowProficiencies?: SavingThrowProficiencies;
  /** Misc skill bonuses (e.g., from items) */
  skillBonuses?: Partial<Record<Skill, number>>;
  /** Misc AC bonus (e.g., from items, class features) */
  acBonus?: number;
  /** Misc attack bonus (e.g., from items) */
  attackBonus?: number;
  /** Misc damage bonus (e.g., from items) */
  damageBonus?: number;
}

/**
 * Weapon definition for rules calculations.
 */
export interface Weapon5e {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Melee or ranged */
  attackType: AttackType;
  /** Damage dice expression (e.g., "1d8", "2d6") */
  damageDice: string;
  /** Damage type */
  damageType: DamageType;
  /** Weapon properties */
  properties?: WeaponProperty[];
  /** Magic attack bonus */
  attackBonus?: number;
  /** Magic damage bonus */
  damageBonus?: number;
  /** Range in feet (for ranged/thrown) */
  range?: { normal: number; long: number };
  /** Weight in pounds */
  weight?: number;
}

/**
 * Armor definition for rules calculations.
 */
export interface Armor5e {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Armor category */
  category: ArmorCategory;
  /** Base AC value */
  baseAC: number;
  /** Magic bonus to AC */
  magicBonus?: number;
  /** STR requirement (for heavy armor) */
  strengthRequirement?: number;
  /** Whether wearing this armor imposes stealth disadvantage */
  stealthDisadvantage?: boolean;
  /** Weight in pounds */
  weight?: number;
}

/**
 * Result type for operations that can fail.
 */
export type RuleResult<T> =
  | { success: true; value: T }
  | { success: false; error: string };

/**
 * Create a success result.
 */
export function success<T>(value: T): RuleResult<T> {
  return { success: true, value };
}

/**
 * Create a failure result.
 */
export function failure<T>(error: string): RuleResult<T> {
  return { success: false, error };
}
