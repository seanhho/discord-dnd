/**
 * Dice rolling utilities.
 *
 * Handles standard dice notation like "1d20", "2d6+3", etc.
 */

import type { RNG } from './rng.js';
import { defaultRNG } from './rng.js';

/**
 * Result of rolling dice.
 */
export interface DiceRollResult {
  /** The dice expression that was rolled */
  expression: string;
  /** Individual die results */
  rolls: number[];
  /** Flat modifier added */
  modifier: number;
  /** Total result */
  total: number;
}

/**
 * Parsed dice expression.
 */
export interface ParsedDice {
  count: number;
  sides: number;
  modifier: number;
}

/**
 * Parse a dice expression like "2d6+3" or "1d20-2".
 */
export function parseDice(expression: string): ParsedDice | null {
  const match = expression.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
  if (!match) return null;

  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2]!, 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  if (count < 1 || sides < 1) return null;

  return { count, sides, modifier };
}

/**
 * Roll dice from a parsed expression.
 */
export function rollParsedDice(
  parsed: ParsedDice,
  rng: RNG = defaultRNG
): DiceRollResult {
  const rolls: number[] = [];

  for (let i = 0; i < parsed.count; i++) {
    rolls.push(rng.rollInt(1, parsed.sides));
  }

  const rollTotal = rolls.reduce((sum, r) => sum + r, 0);
  const total = rollTotal + parsed.modifier;

  const modStr =
    parsed.modifier > 0
      ? `+${parsed.modifier}`
      : parsed.modifier < 0
        ? `${parsed.modifier}`
        : '';
  const expression = `${parsed.count}d${parsed.sides}${modStr}`;

  return { expression, rolls, modifier: parsed.modifier, total };
}

/**
 * Roll dice from a string expression.
 */
export function rollDice(
  expression: string,
  rng: RNG = defaultRNG
): DiceRollResult | null {
  const parsed = parseDice(expression);
  if (!parsed) return null;
  return rollParsedDice(parsed, rng);
}

/**
 * Roll a single die with a given number of sides.
 */
export function rollD(sides: number, rng: RNG = defaultRNG): number {
  return rng.rollInt(1, sides);
}

/**
 * Roll a d20.
 */
export function rollD20(rng: RNG = defaultRNG): number {
  return rollD(20, rng);
}

/**
 * Format dice roll result for display.
 */
export function formatDiceRoll(result: DiceRollResult): string {
  const rollsStr = result.rolls.length > 1 ? `[${result.rolls.join(', ')}]` : `${result.rolls[0]}`;

  if (result.modifier === 0) {
    return `${result.expression}: ${rollsStr} = ${result.total}`;
  }

  const modStr = result.modifier > 0 ? `+${result.modifier}` : `${result.modifier}`;
  const rollSum = result.rolls.reduce((a, b) => a + b, 0);
  return `${result.expression}: ${rollsStr} (${rollSum}) ${modStr} = ${result.total}`;
}
