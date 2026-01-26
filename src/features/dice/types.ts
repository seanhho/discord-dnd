/**
 * Parameters for rolling dice
 */
export interface DiceRollParams {
  /**
   * Number of sides on each die (e.g., 6 for d6, 20 for d20)
   */
  sides: number;

  /**
   * Number of dice to roll
   */
  count: number;

  /**
   * Modifier to add to the total (can be negative)
   */
  modifier: number;

  /**
   * Optional label for the roll (e.g., "Attack Roll", "Damage")
   */
  label?: string;
}

/**
 * Result of a dice roll operation
 */
export interface DiceRollResult {
  /**
   * Individual die results
   */
  rolls: number[];

  /**
   * Modifier applied
   */
  modifier: number;

  /**
   * Sum of all rolls (before modifier)
   */
  subtotal: number;

  /**
   * Final total (subtotal + modifier)
   */
  total: number;

  /**
   * Optional label
   */
  label?: string;
}

/**
 * Random number generator function signature
 * Returns a random integer between 1 and max (inclusive)
 */
export type RandomNumberGenerator = (max: number) => number;
