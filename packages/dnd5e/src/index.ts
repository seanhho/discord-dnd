/**
 * @discord-bot/dnd5e
 *
 * D&D 5e rules engine, data, and adapters.
 *
 * This package implements D&D 5e game mechanics and provides
 * adapters for converting storage formats to rule-compatible types.
 *
 * Dependencies:
 * - @discord-bot/dnd5e-types (stable types)
 *
 * This package does NOT depend on:
 * - Persistence layer
 * - Discord.js
 */

// Re-export types from dnd5e-types for convenience
export type {
  Ability,
  AbilityScores,
  Skill,
  SkillProficiencies,
  ProficiencyLevel,
  SavingThrowProficiencies,
  DamageType,
  Condition,
  AdvantageState,
  AttackType,
  WeaponProperty,
  ArmorCategory,
} from '@discord-bot/dnd5e-types';

export {
  ABILITIES,
  SKILLS,
  SKILL_TO_ABILITY,
  DAMAGE_TYPES,
  CONDITIONS,
  isAbility,
  isSkill,
} from '@discord-bot/dnd5e-types';

// Internal types
export type {
  Character5eSnapshot,
  Weapon5e,
  Armor5e,
  RuleResult,
} from './types.js';
export { success, failure } from './types.js';

// Engine
export type { RNG } from './engine/rng.js';
export { defaultRNG, createSeededRNG, createMockRNG } from './engine/rng.js';

export type { DiceRollResult, ParsedDice } from './engine/dice.js';
export {
  parseDice,
  rollParsedDice,
  rollDice,
  rollD,
  rollD20,
  formatDiceRoll,
} from './engine/dice.js';

export type { Modifier, ModifierStack } from './engine/modifiers.js';
export {
  createModifierStack,
  addModifier,
  addAdvantage,
  addDisadvantage,
  sumModifiers,
} from './engine/modifiers.js';

export type { Breakdown, BreakdownItem } from './engine/explain.js';
export {
  createBreakdown,
  formatSignedNumber,
  formatBreakdownLine,
  formatBreakdownMultiline,
  buildExplainString,
} from './engine/explain.js';

// Rules
export {
  proficiencyBonusForLevel,
  calculateProficiencyBonus,
} from './rules/proficiency.js';

export { abilityMod, formatAbilityMod } from './rules/ability.js';

export type { SkillBonusResult, SkillCheckResult } from './rules/checks.js';
export {
  computeSkillBonus,
  rollSkillCheck,
  computeAbilityCheckBonus,
  rollAbilityCheck,
} from './rules/checks.js';

export type { AttackBonusResult, AttackRollResult } from './rules/combat/attack.js';
export {
  getAttackAbility,
  computeAttackBonus,
  rollAttack,
} from './rules/combat/attack.js';

export type { DamageRollResult } from './rules/combat/damage.js';
export { rollDamage, rollGenericDamage } from './rules/combat/damage.js';

export type { ACResult } from './rules/combat/ac.js';
export {
  computeArmorClass,
  meetsArmorRequirements,
  hasStealthDisadvantage,
} from './rules/combat/ac.js';

// Data
export {
  GREATAXE,
  LONGSWORD,
  DAGGER,
  SHORTBOW,
  RAPIER,
  HANDAXE,
  WEAPONS,
  getWeaponById,
} from './data/equipment/weapons.js';

export {
  LEATHER_ARMOR,
  STUDDED_LEATHER,
  CHAIN_SHIRT,
  SCALE_MAIL,
  HALF_PLATE,
  CHAIN_MAIL,
  PLATE_ARMOR,
  SHIELD,
  ARMORS,
  getArmorById,
  getArmorsByCategory,
} from './data/equipment/armors.js';

export { SKILLS_BY_ABILITY, getSkillsForAbility } from './data/skills.js';

export {
  CONDITION_EFFECTS,
  getConditionsAffectingAttacks,
  getConditionsGrantingAdvantage,
} from './data/conditions.js';

// Adapters
export type {
  KVAttributeValue,
  KVRecord,
  KVConversionOptions,
  KVConversionResult,
} from './adapters/kvCharacter.js';
export { kvToCharacterSnapshot, kvToAbilityScores } from './adapters/kvCharacter.js';

export type { EquipmentSlot, EquippedItems } from './adapters/equipmentSlots.js';
export {
  EQUIPMENT_SLOTS,
  extractWeaponFromKV,
  extractArmorFromKV,
  extractEquippedItems,
  getInventoryItemIds,
  extractAllWeapons,
  extractAllArmor,
} from './adapters/equipmentSlots.js';
