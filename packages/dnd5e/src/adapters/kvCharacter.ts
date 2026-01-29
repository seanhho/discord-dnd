/**
 * KV Character Adapter
 *
 * Converts generic KV record storage (Record<string, {t, v}>) into
 * Character5eSnapshot used by rules functions.
 *
 * This adapter reads ability scores and other stats from KV storage
 * without coupling to specific persistence implementations.
 */

import {
  ABILITIES,
  SKILLS,
  type Skill,
  type AbilityScores,
  type SkillProficiencies,
  type SavingThrowProficiencies,
} from '@discord-bot/dnd5e-types';
import type { Character5eSnapshot } from '../types.js';

/**
 * KV attribute value structure.
 * Matches the persistence layer's AttributeValue type.
 */
export interface KVAttributeValue {
  /** Type: 'n' = number, 's' = string, 'b' = boolean */
  t: 'n' | 's' | 'b';
  /** Value */
  v: number | string | boolean;
}

/**
 * Generic KV record type.
 */
export type KVRecord = Record<string, KVAttributeValue>;

/**
 * Options for KV conversion.
 */
export interface KVConversionOptions {
  /** Default level if not found (default: 1) */
  defaultLevel?: number;
  /** Default ability score if not found (default: 10) */
  defaultAbilityScore?: number;
  /** Whether to throw on missing required fields (default: false) */
  strict?: boolean;
}

/**
 * Result of KV conversion.
 */
export type KVConversionResult =
  | { success: true; snapshot: Character5eSnapshot }
  | { success: false; error: string };

/**
 * Extract a number from KV.
 */
function getNumber(kv: KVRecord, key: string): number | undefined {
  const attr = kv[key];
  if (!attr) return undefined;
  if (attr.t === 'n') return attr.v as number;
  if (typeof attr.v === 'string') {
    const parsed = parseInt(attr.v, 10);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/**
 * Extract a string from KV.
 */
function getString(kv: KVRecord, key: string): string | undefined {
  const attr = kv[key];
  if (!attr) return undefined;
  return String(attr.v);
}

/**
 * Extract a boolean from KV.
 */
function getBoolean(kv: KVRecord, key: string): boolean | undefined {
  const attr = kv[key];
  if (!attr) return undefined;
  if (attr.t === 'b') return attr.v as boolean;
  if (attr.v === 'true') return true;
  if (attr.v === 'false') return false;
  return undefined;
}

/**
 * Convert KV record to Character5eSnapshot.
 *
 * Expected KV keys:
 * - name: character name
 * - level: character level (1-20)
 * - str, dex, con, int, wis, cha: ability scores
 * - skill.<skillName>: 'proficient' | 'expertise'
 * - save.<ability>: boolean for saving throw proficiency
 * - skill_bonus.<skillName>: misc skill bonus
 * - ac_bonus: misc AC bonus
 * - attack_bonus: misc attack bonus
 * - damage_bonus: misc damage bonus
 */
export function kvToCharacterSnapshot(
  kv: KVRecord,
  options: KVConversionOptions = {}
): KVConversionResult {
  const {
    defaultLevel = 1,
    defaultAbilityScore = 10,
    strict = false,
  } = options;

  // Extract name
  const name = getString(kv, 'name');
  if (!name && strict) {
    return { success: false, error: 'Missing required field: name' };
  }

  // Extract level
  let level = getNumber(kv, 'level');
  if (level === undefined) {
    if (strict) {
      return { success: false, error: 'Missing required field: level' };
    }
    level = defaultLevel;
  }
  if (level < 1 || level > 20) {
    return { success: false, error: `Invalid level: ${level}. Must be 1-20.` };
  }

  // Extract ability scores
  const abilityScores: AbilityScores = {
    str: defaultAbilityScore,
    dex: defaultAbilityScore,
    con: defaultAbilityScore,
    int: defaultAbilityScore,
    wis: defaultAbilityScore,
    cha: defaultAbilityScore,
  };

  for (const ability of ABILITIES) {
    const score = getNumber(kv, ability);
    if (score !== undefined) {
      if (score < 1 || score > 30) {
        return {
          success: false,
          error: `Invalid ${ability} score: ${score}. Must be 1-30.`,
        };
      }
      abilityScores[ability] = score;
    } else if (strict) {
      return { success: false, error: `Missing required field: ${ability}` };
    }
  }

  // Extract skill proficiencies
  const skillProficiencies: SkillProficiencies = {};
  for (const skill of SKILLS) {
    const prof = getString(kv, `skill.${skill}`);
    if (prof === 'proficient' || prof === 'expertise') {
      skillProficiencies[skill] = prof;
    }
  }

  // Extract saving throw proficiencies
  const savingThrowProficiencies: SavingThrowProficiencies = {};
  for (const ability of ABILITIES) {
    const prof = getBoolean(kv, `save.${ability}`);
    if (prof !== undefined) {
      savingThrowProficiencies[ability] = prof;
    }
  }

  // Extract misc skill bonuses
  const skillBonuses: Partial<Record<Skill, number>> = {};
  for (const skill of SKILLS) {
    const bonus = getNumber(kv, `skill_bonus.${skill}`);
    if (bonus !== undefined) {
      skillBonuses[skill] = bonus;
    }
  }

  // Extract misc bonuses
  const acBonus = getNumber(kv, 'ac_bonus');
  const attackBonus = getNumber(kv, 'attack_bonus');
  const damageBonus = getNumber(kv, 'damage_bonus');

  const snapshot: Character5eSnapshot = {
    name: name ?? 'Unknown',
    level,
    abilityScores,
    skillProficiencies:
      Object.keys(skillProficiencies).length > 0 ? skillProficiencies : undefined,
    savingThrowProficiencies:
      Object.keys(savingThrowProficiencies).length > 0
        ? savingThrowProficiencies
        : undefined,
    skillBonuses: Object.keys(skillBonuses).length > 0 ? skillBonuses : undefined,
    acBonus,
    attackBonus,
    damageBonus,
  };

  return { success: true, snapshot };
}

/**
 * Extract just ability scores from KV.
 * Useful for quick lookups without full snapshot.
 */
export function kvToAbilityScores(
  kv: KVRecord,
  defaultScore: number = 10
): AbilityScores {
  const scores: AbilityScores = {
    str: defaultScore,
    dex: defaultScore,
    con: defaultScore,
    int: defaultScore,
    wis: defaultScore,
    cha: defaultScore,
  };

  for (const ability of ABILITIES) {
    const score = getNumber(kv, ability);
    if (score !== undefined && score >= 1 && score <= 30) {
      scores[ability] = score;
    }
  }

  return scores;
}
