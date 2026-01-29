/**
 * D&D 5e Ability Scores
 *
 * The six core abilities used throughout the game system.
 */

/**
 * The six ability score identifiers.
 */
export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

/**
 * Ability score type derived from the constant array.
 */
export type Ability = (typeof ABILITIES)[number];

/**
 * Display names for abilities.
 */
export const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

/**
 * Short display names (3-letter abbreviations).
 */
export const ABILITY_ABBREV: Record<Ability, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
};

/**
 * A complete set of ability scores.
 */
export type AbilityScores = Record<Ability, number>;

/**
 * Saving throw proficiency state for each ability.
 */
export type SavingThrowProficiencies = Partial<Record<Ability, boolean>>;
