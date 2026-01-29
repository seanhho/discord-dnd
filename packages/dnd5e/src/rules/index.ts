/**
 * Rules module exports.
 */

export { proficiencyBonusForLevel, calculateProficiencyBonus } from './proficiency.js';

export {
  abilityMod,
  formatAbilityMod,
  pointBuyCost,
  validatePointBuy,
} from './ability.js';

export type {
  SkillBonusResult,
  SkillCheckResult,
  AbilityCheckBonusResult,
} from './checks.js';
export {
  computeSkillBonus,
  rollSkillCheck,
  computeAbilityCheckBonus,
  rollAbilityCheck,
} from './checks.js';

// Re-export combat rules
export * from './combat/index.js';
