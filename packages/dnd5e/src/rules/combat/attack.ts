/**
 * Attack roll calculations.
 */

import type { Ability, AdvantageState } from '@discord-bot/dnd5e-types';
import type { RNG } from '../../engine/rng.js';
import { defaultRNG } from '../../engine/rng.js';
import { rollD20 } from '../../engine/dice.js';
import { abilityMod } from '../ability.js';
import { proficiencyBonusForLevel } from '../proficiency.js';
import type { Character5eSnapshot, Weapon5e } from '../../types.js';
import {
  createModifierStack,
  addModifier,
  sumModifiers,
} from '../../engine/modifiers.js';
import { createBreakdown, formatBreakdownLine, type Breakdown } from '../../engine/explain.js';

/**
 * Options for attack bonus computation.
 */
export interface AttackBonusOptions {
  /** Override the ability used for the attack */
  overrideAbility?: Ability;
  /** Additional misc attack bonus */
  miscBonus?: number;
}

/**
 * Result of computing an attack bonus.
 */
export interface AttackBonusResult {
  total: number;
  breakdown: Breakdown;
  explain: string;
}

/**
 * Result of rolling an attack.
 */
export interface AttackRollResult {
  d20Rolls: number[];
  chosenRoll: number;
  modifier: number;
  total: number;
  isCrit: boolean;
  isCritFail: boolean;
  advantageState: AdvantageState;
  explain: string;
}

/**
 * Determine which ability to use for a weapon attack.
 */
export function getAttackAbility(
  weapon: Weapon5e,
  attackerAbilities: Record<Ability, number>
): Ability {
  // Finesse weapons can use STR or DEX, whichever is higher
  if (weapon.properties?.includes('finesse')) {
    const strMod = abilityMod(attackerAbilities.str);
    const dexMod = abilityMod(attackerAbilities.dex);
    return dexMod > strMod ? 'dex' : 'str';
  }

  // Ranged weapons use DEX
  if (weapon.attackType === 'ranged') {
    return 'dex';
  }

  // Default: melee uses STR
  return 'str';
}

/**
 * Compute the attack bonus for an attack.
 *
 * Formula: ability mod + proficiency (if proficient) + weapon bonus + misc
 */
export function computeAttackBonus(
  attacker: Character5eSnapshot,
  weapon: Weapon5e,
  options: AttackBonusOptions = {}
): AttackBonusResult {
  let stack = createModifierStack();

  // Determine ability to use
  const ability = options.overrideAbility ?? getAttackAbility(weapon, attacker.abilityScores);
  const abilityScore = attacker.abilityScores[ability];
  const mod = abilityMod(abilityScore);
  stack = addModifier(stack, mod, `${ability.toUpperCase()} mod`);

  // Proficiency bonus (assume proficient for now; could check weapon proficiencies)
  const profBonus = proficiencyBonusForLevel(attacker.level);
  stack = addModifier(stack, profBonus, 'Proficiency');

  // Weapon attack bonus (magic weapons, etc.)
  if (weapon.attackBonus) {
    stack = addModifier(stack, weapon.attackBonus, `${weapon.name} bonus`);
  }

  // Misc bonus
  if (options.miscBonus) {
    stack = addModifier(stack, options.miscBonus, 'Misc bonus');
  }

  const breakdown = createBreakdown(stack);
  const explain = formatBreakdownLine(breakdown);

  return {
    total: sumModifiers(stack),
    breakdown,
    explain,
  };
}

/**
 * Roll an attack.
 */
export function rollAttack(
  attacker: Character5eSnapshot,
  weapon: Weapon5e,
  advantageState: AdvantageState = 'none',
  options: AttackBonusOptions = {},
  rng: RNG = defaultRNG
): AttackRollResult {
  const bonusResult = computeAttackBonus(attacker, weapon, options);

  // Roll d20(s) based on advantage state
  const d20Rolls: number[] = [];
  d20Rolls.push(rollD20(rng));

  if (advantageState !== 'none') {
    d20Rolls.push(rollD20(rng));
  }

  // Choose roll based on advantage/disadvantage
  let chosenRoll: number;
  if (advantageState === 'advantage') {
    chosenRoll = Math.max(...d20Rolls);
  } else if (advantageState === 'disadvantage') {
    chosenRoll = Math.min(...d20Rolls);
  } else {
    chosenRoll = d20Rolls[0]!;
  }

  const total = chosenRoll + bonusResult.total;

  // Check for crit (natural 20) or crit fail (natural 1)
  const isCrit = chosenRoll === 20;
  const isCritFail = chosenRoll === 1;

  // Build explain string
  let explain = '';
  if (d20Rolls.length > 1) {
    const advLabel = advantageState === 'advantage' ? 'ADV' : 'DIS';
    explain = `d20 [${d20Rolls.join(', ')}] (${advLabel}: ${chosenRoll})`;
  } else {
    explain = `d20 (${chosenRoll})`;
  }

  if (isCrit) {
    explain += ' **CRIT!**';
  } else if (isCritFail) {
    explain += ' **MISS!**';
  }

  explain += ` + ${bonusResult.total} = ${total}`;

  return {
    d20Rolls,
    chosenRoll,
    modifier: bonusResult.total,
    total,
    isCrit,
    isCritFail,
    advantageState,
    explain,
  };
}
