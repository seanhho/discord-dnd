/**
 * Damage roll calculations.
 */

import type { Ability, DamageType } from '@discord-bot/dnd5e-types';
import type { RNG } from '../../engine/rng.js';
import { defaultRNG } from '../../engine/rng.js';
import { parseDice, rollParsedDice } from '../../engine/dice.js';
import { abilityMod } from '../ability.js';
import type { Character5eSnapshot, Weapon5e } from '../../types.js';
import { getAttackAbility } from './attack.js';

/**
 * Options for damage roll.
 */
export interface DamageOptions {
  /** Override the ability used for damage */
  overrideAbility?: Ability;
  /** Additional flat damage bonus */
  miscBonus?: number;
  /** Whether this is a critical hit (doubles dice) */
  isCrit?: boolean;
}

/**
 * Result of a damage roll.
 */
export interface DamageRollResult {
  /** The weapon/source name */
  source: string;
  /** Individual dice rolls */
  diceRolls: number[];
  /** Sum of dice */
  diceTotal: number;
  /** Flat modifiers */
  modifier: number;
  /** Total damage */
  total: number;
  /** Damage type */
  damageType: DamageType;
  /** Whether this was a critical hit */
  isCrit: boolean;
  /** Human-readable explanation */
  explain: string;
}

/**
 * Roll damage for a weapon attack.
 *
 * Standard 5e damage: weapon dice + ability mod + weapon bonus
 * Critical hits double the dice (not the modifiers).
 */
export function rollDamage(
  attacker: Character5eSnapshot,
  weapon: Weapon5e,
  options: DamageOptions = {},
  rng: RNG = defaultRNG
): DamageRollResult {
  const isCrit = options.isCrit ?? false;

  // Parse the weapon's damage dice
  const parsed = parseDice(weapon.damageDice);
  if (!parsed) {
    throw new Error(`Invalid damage dice expression: ${weapon.damageDice}`);
  }

  // Double dice count on crit
  const diceCount = isCrit ? parsed.count * 2 : parsed.count;
  const critParsed = { ...parsed, count: diceCount, modifier: 0 };

  // Roll the dice
  const diceResult = rollParsedDice(critParsed, rng);

  // Calculate modifier
  const ability = options.overrideAbility ?? getAttackAbility(weapon, attacker.abilityScores);
  const abilityScore = attacker.abilityScores[ability];
  const abMod = abilityMod(abilityScore);

  let modifier = abMod;

  // Add weapon damage bonus
  if (weapon.damageBonus) {
    modifier += weapon.damageBonus;
  }

  // Add misc bonus
  if (options.miscBonus) {
    modifier += options.miscBonus;
  }

  const total = diceResult.total + modifier;

  // Build explain string
  const diceStr = isCrit
    ? `${diceCount}d${parsed.sides} (crit)`
    : `${parsed.count}d${parsed.sides}`;

  const rollsStr = `[${diceResult.rolls.join(', ')}]`;
  let explain = `${diceStr}: ${rollsStr} (${diceResult.total})`;

  if (modifier !== 0) {
    const modSign = modifier >= 0 ? '+' : '';
    explain += ` ${modSign}${modifier}`;
  }

  explain += ` = ${total} ${weapon.damageType}`;

  if (isCrit) {
    explain = `**CRIT** ${explain}`;
  }

  return {
    source: weapon.name,
    diceRolls: diceResult.rolls,
    diceTotal: diceResult.total,
    modifier,
    total,
    damageType: weapon.damageType,
    isCrit,
    explain,
  };
}

/**
 * Roll generic damage from a dice expression.
 */
export function rollGenericDamage(
  diceExpression: string,
  damageType: DamageType,
  source: string,
  options: { isCrit?: boolean; miscBonus?: number } = {},
  rng: RNG = defaultRNG
): DamageRollResult {
  const parsed = parseDice(diceExpression);
  if (!parsed) {
    throw new Error(`Invalid damage dice expression: ${diceExpression}`);
  }

  const isCrit = options.isCrit ?? false;
  const diceCount = isCrit ? parsed.count * 2 : parsed.count;

  const diceResult = rollParsedDice(
    { count: diceCount, sides: parsed.sides, modifier: 0 },
    rng
  );

  const modifier = parsed.modifier + (options.miscBonus ?? 0);
  const total = diceResult.total + modifier;

  const diceStr = isCrit
    ? `${diceCount}d${parsed.sides} (crit)`
    : `${parsed.count}d${parsed.sides}`;

  const rollsStr = `[${diceResult.rolls.join(', ')}]`;
  let explain = `${diceStr}: ${rollsStr} (${diceResult.total})`;

  if (modifier !== 0) {
    const modSign = modifier >= 0 ? '+' : '';
    explain += ` ${modSign}${modifier}`;
  }

  explain += ` = ${total} ${damageType}`;

  return {
    source,
    diceRolls: diceResult.rolls,
    diceTotal: diceResult.total,
    modifier,
    total,
    damageType,
    isCrit,
    explain,
  };
}
