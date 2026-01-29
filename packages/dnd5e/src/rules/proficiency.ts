/**
 * Proficiency bonus calculations.
 */

/**
 * Proficiency bonus by character level (1-20).
 * Standard 5e progression: +2 at levels 1-4, +3 at 5-8, etc.
 */
const PROFICIENCY_BY_LEVEL: readonly number[] = [
  0, // Index 0 unused
  2, 2, 2, 2,     // Levels 1-4
  3, 3, 3, 3,     // Levels 5-8
  4, 4, 4, 4,     // Levels 9-12
  5, 5, 5, 5,     // Levels 13-16
  6, 6, 6, 6,     // Levels 17-20
];

/**
 * Get the proficiency bonus for a given character level.
 *
 * @param level - Character level (1-20)
 * @returns Proficiency bonus (+2 to +6)
 * @throws Error if level is outside 1-20 range
 */
export function proficiencyBonusForLevel(level: number): number {
  if (level < 1 || level > 20) {
    throw new Error(`Invalid level: ${level}. Must be 1-20.`);
  }
  return PROFICIENCY_BY_LEVEL[level]!;
}

/**
 * Calculate proficiency bonus using the formula: floor((level - 1) / 4) + 2
 * This is equivalent to the table lookup but computes dynamically.
 */
export function calculateProficiencyBonus(level: number): number {
  if (level < 1 || level > 20) {
    throw new Error(`Invalid level: ${level}. Must be 1-20.`);
  }
  return Math.floor((level - 1) / 4) + 2;
}
