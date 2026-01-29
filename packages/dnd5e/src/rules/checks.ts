/**
 * Ability checks and skill checks.
 */

import type { Ability, Skill, AdvantageState } from '@discord-bot/dnd5e-types';
import { SKILL_TO_ABILITY } from '@discord-bot/dnd5e-types';
import type { RNG } from '../engine/rng.js';
import { defaultRNG } from '../engine/rng.js';
import { rollD20 } from '../engine/dice.js';
import { abilityMod } from './ability.js';
import { proficiencyBonusForLevel } from './proficiency.js';
import type { Character5eSnapshot } from '../types.js';
import {
  createModifierStack,
  addModifier,
  sumModifiers,
} from '../engine/modifiers.js';
import { createBreakdown, formatBreakdownLine, type Breakdown } from '../engine/explain.js';

/**
 * Result of computing a skill bonus.
 */
export interface SkillBonusResult {
  total: number;
  breakdown: Breakdown;
  explain: string;
}

/**
 * Result of rolling a skill check.
 */
export interface SkillCheckResult {
  d20Rolls: number[];
  chosenRoll: number;
  modifier: number;
  total: number;
  advantageState: AdvantageState;
  explain: string;
}

/**
 * Compute the skill bonus for a character.
 */
export function computeSkillBonus(
  character: Character5eSnapshot,
  skill: Skill
): SkillBonusResult {
  const ability = SKILL_TO_ABILITY[skill];
  const abilityScore = character.abilityScores[ability];
  const mod = abilityMod(abilityScore);

  let stack = createModifierStack();
  stack = addModifier(stack, mod, `${ability.toUpperCase()} mod`);

  // Check proficiency
  const profLevel = character.skillProficiencies?.[skill];
  if (profLevel) {
    const profBonus = proficiencyBonusForLevel(character.level);

    if (profLevel === 'expertise') {
      stack = addModifier(stack, profBonus * 2, 'Expertise');
    } else {
      stack = addModifier(stack, profBonus, 'Proficiency');
    }
  }

  // Add any misc skill bonus
  const miscBonus = character.skillBonuses?.[skill];
  if (miscBonus) {
    stack = addModifier(stack, miscBonus, 'Misc bonus');
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
 * Roll a skill check.
 */
export function rollSkillCheck(
  character: Character5eSnapshot,
  skill: Skill,
  advantageState: AdvantageState = 'none',
  rng: RNG = defaultRNG
): SkillCheckResult {
  const bonusResult = computeSkillBonus(character, skill);

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

  // Build explain string
  let explain = '';
  if (d20Rolls.length > 1) {
    const advLabel = advantageState === 'advantage' ? 'ADV' : 'DIS';
    explain = `d20 [${d20Rolls.join(', ')}] (${advLabel}: ${chosenRoll}) + ${bonusResult.total} = ${total}`;
  } else {
    explain = `d20 (${chosenRoll}) + ${bonusResult.total} = ${total}`;
  }

  return {
    d20Rolls,
    chosenRoll,
    modifier: bonusResult.total,
    total,
    advantageState,
    explain,
  };
}

/**
 * Result of computing an ability check bonus (raw ability, no skill).
 */
export interface AbilityCheckBonusResult {
  total: number;
  breakdown: Breakdown;
  explain: string;
}

/**
 * Compute a raw ability check bonus (no skill proficiency).
 */
export function computeAbilityCheckBonus(
  character: Character5eSnapshot,
  ability: Ability
): AbilityCheckBonusResult {
  const abilityScore = character.abilityScores[ability];
  const mod = abilityMod(abilityScore);

  let stack = createModifierStack();
  stack = addModifier(stack, mod, `${ability.toUpperCase()} mod`);

  const breakdown = createBreakdown(stack);
  const explain = formatBreakdownLine(breakdown);

  return {
    total: sumModifiers(stack),
    breakdown,
    explain,
  };
}

/**
 * Roll a raw ability check.
 */
export function rollAbilityCheck(
  character: Character5eSnapshot,
  ability: Ability,
  advantageState: AdvantageState = 'none',
  rng: RNG = defaultRNG
): SkillCheckResult {
  const bonusResult = computeAbilityCheckBonus(character, ability);

  const d20Rolls: number[] = [];
  d20Rolls.push(rollD20(rng));

  if (advantageState !== 'none') {
    d20Rolls.push(rollD20(rng));
  }

  let chosenRoll: number;
  if (advantageState === 'advantage') {
    chosenRoll = Math.max(...d20Rolls);
  } else if (advantageState === 'disadvantage') {
    chosenRoll = Math.min(...d20Rolls);
  } else {
    chosenRoll = d20Rolls[0]!;
  }

  const total = chosenRoll + bonusResult.total;

  let explain = '';
  if (d20Rolls.length > 1) {
    const advLabel = advantageState === 'advantage' ? 'ADV' : 'DIS';
    explain = `d20 [${d20Rolls.join(', ')}] (${advLabel}: ${chosenRoll}) + ${bonusResult.total} = ${total}`;
  } else {
    explain = `d20 (${chosenRoll}) + ${bonusResult.total} = ${total}`;
  }

  return {
    d20Rolls,
    chosenRoll,
    modifier: bonusResult.total,
    total,
    advantageState,
    explain,
  };
}
