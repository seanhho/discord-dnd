/**
 * Combat rules exports.
 */

export type { AttackBonusOptions, AttackBonusResult, AttackRollResult } from './attack.js';
export { getAttackAbility, computeAttackBonus, rollAttack } from './attack.js';

export type { DamageOptions, DamageRollResult } from './damage.js';
export { rollDamage, rollGenericDamage } from './damage.js';

export type { ACResult } from './ac.js';
export {
  computeArmorClass,
  meetsArmorRequirements,
  hasStealthDisadvantage,
} from './ac.js';
