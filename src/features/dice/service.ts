import type { DiceRollParams, DiceRollResult, RandomNumberGenerator } from './types.js';

/**
 * Default random number generator using Math.random
 * Returns a random integer between 1 and max (inclusive)
 */
export const defaultRng: RandomNumberGenerator = (max: number): number => {
  return Math.floor(Math.random() * max) + 1;
};

/**
 * Roll dice with the specified parameters
 *
 * This is pure domain logic with NO Discord.js dependencies.
 * RNG is injected for testability.
 *
 * @param params - Dice roll parameters
 * @param rng - Random number generator function (defaults to Math.random-based RNG)
 * @returns The result of the dice roll
 */
export function rollDice(
  params: DiceRollParams,
  rng: RandomNumberGenerator = defaultRng
): DiceRollResult {
  const { sides, count, modifier, label } = params;

  // Roll each die
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(rng(sides));
  }

  // Calculate totals
  const subtotal = rolls.reduce((sum, roll) => sum + roll, 0);
  const total = subtotal + modifier;

  return {
    rolls,
    modifier,
    subtotal,
    total,
    label,
  };
}

/**
 * Format a dice roll result as a human-readable string
 *
 * Example outputs:
 * - "1d20 + 5 = **18** (rolled: 13)"
 * - "3d6 = **12** (rolled: 4, 5, 3)"
 * - "Attack Roll: 1d20 + 2 = **15** (rolled: 13)"
 *
 * @param params - Original roll parameters
 * @param result - Roll result
 * @returns Formatted string
 */
export function formatRollResult(
  params: DiceRollParams,
  result: DiceRollResult
): string {
  const { sides, count, modifier } = params;
  const { rolls, total, label } = result;

  // Build the dice notation (e.g., "1d20", "3d6")
  const diceNotation = `${count}d${sides}`;

  // Build the modifier part (e.g., "+ 5", "- 2", or empty)
  let modifierPart = '';
  if (modifier > 0) {
    modifierPart = ` + ${modifier}`;
  } else if (modifier < 0) {
    modifierPart = ` - ${Math.abs(modifier)}`;
  }

  // Format the individual rolls
  const rollsList = rolls.join(', ');

  // Build the label prefix if present
  const labelPrefix = label ? `**${label}**: ` : '';

  // Assemble the full message
  return `${labelPrefix}${diceNotation}${modifierPart} = **${total}** (rolled: ${rollsList})`;
}
