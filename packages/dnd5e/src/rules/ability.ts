/**
 * Ability score calculations.
 */

/**
 * Calculate the ability modifier for a given ability score.
 * Standard 5e formula: floor((score - 10) / 2)
 *
 * @param score - The ability score (typically 1-30)
 * @returns The ability modifier (-5 to +10 for standard range)
 */
export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Format an ability modifier for display.
 * Adds a '+' sign for positive values.
 */
export function formatAbilityMod(score: number): string {
  const mod = abilityMod(score);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Calculate point buy cost for an ability score.
 * Standard point buy: 8-15 range with escalating costs.
 */
export function pointBuyCost(score: number): number {
  if (score < 8 || score > 15) {
    throw new Error(`Point buy score must be 8-15, got ${score}`);
  }

  // 8=0, 9=1, 10=2, 11=3, 12=4, 13=5, 14=7, 15=9
  if (score <= 13) return score - 8;
  if (score === 14) return 7;
  return 9; // score === 15
}

/**
 * Validate that a set of ability scores is valid for point buy.
 * Standard point buy: 27 points, scores 8-15.
 */
export function validatePointBuy(
  scores: Record<string, number>,
  maxPoints: number = 27
): { valid: boolean; totalCost: number; error?: string } {
  let totalCost = 0;

  for (const [ability, score] of Object.entries(scores)) {
    if (score < 8 || score > 15) {
      return {
        valid: false,
        totalCost: 0,
        error: `${ability} score ${score} is outside point buy range (8-15)`,
      };
    }
    totalCost += pointBuyCost(score);
  }

  if (totalCost > maxPoints) {
    return {
      valid: false,
      totalCost,
      error: `Total cost ${totalCost} exceeds maximum ${maxPoints}`,
    };
  }

  return { valid: true, totalCost };
}
