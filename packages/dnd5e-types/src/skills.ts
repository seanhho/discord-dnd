/**
 * D&D 5e Skills
 *
 * The 18 skills and their associated abilities.
 */

import type { Ability } from './abilities.js';

/**
 * The 18 standard 5e skills.
 */
export const SKILLS = [
  'acrobatics',
  'animal_handling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleight_of_hand',
  'stealth',
  'survival',
] as const;

/**
 * Skill type derived from the constant array.
 */
export type Skill = (typeof SKILLS)[number];

/**
 * Maps each skill to its governing ability.
 */
export const SKILL_TO_ABILITY: Record<Skill, Ability> = {
  acrobatics: 'dex',
  animal_handling: 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  sleight_of_hand: 'dex',
  stealth: 'dex',
  survival: 'wis',
};

/**
 * Display names for skills.
 */
export const SKILL_NAMES: Record<Skill, string> = {
  acrobatics: 'Acrobatics',
  animal_handling: 'Animal Handling',
  arcana: 'Arcana',
  athletics: 'Athletics',
  deception: 'Deception',
  history: 'History',
  insight: 'Insight',
  intimidation: 'Intimidation',
  investigation: 'Investigation',
  medicine: 'Medicine',
  nature: 'Nature',
  perception: 'Perception',
  performance: 'Performance',
  persuasion: 'Persuasion',
  religion: 'Religion',
  sleight_of_hand: 'Sleight of Hand',
  stealth: 'Stealth',
  survival: 'Survival',
};

/**
 * Proficiency level for a skill.
 */
export type ProficiencyLevel = 'proficient' | 'expertise';

/**
 * Skill proficiency map for a character.
 */
export type SkillProficiencies = Partial<Record<Skill, ProficiencyLevel>>;
