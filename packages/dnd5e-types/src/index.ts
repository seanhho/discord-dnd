/**
 * @discord-bot/dnd5e-types
 *
 * Stable D&D 5e type definitions.
 *
 * This package contains ONLY types, constants, and simple guards.
 * It has NO dependencies on rules logic, data lists, or persistence.
 *
 * Safe for import by:
 * - @discord-bot/persistence
 * - @discord-bot/dnd5e
 * - Any bot feature
 */

// Version
export { VERSION } from './version.js';

// Abilities
export {
  ABILITIES,
  ABILITY_NAMES,
  ABILITY_ABBREV,
  type Ability,
  type AbilityScores,
  type SavingThrowProficiencies,
} from './abilities.js';

// Skills
export {
  SKILLS,
  SKILL_NAMES,
  SKILL_TO_ABILITY,
  type Skill,
  type ProficiencyLevel,
  type SkillProficiencies,
} from './skills.js';

// Damage
export {
  DAMAGE_TYPES,
  DAMAGE_TYPE_NAMES,
  PHYSICAL_DAMAGE_TYPES,
  type DamageType,
} from './damage.js';

// Conditions
export { CONDITIONS, CONDITION_NAMES, type Condition } from './conditions.js';

// Combat
export {
  WEAPON_PROPERTIES,
  type AdvantageState,
  type AttackType,
  type WeaponProperty,
  type ArmorCategory,
} from './combat.js';

// Guards
export {
  isAbility,
  isSkill,
  isDamageType,
  isCondition,
  isWeaponProperty,
} from './guards.js';

// Character KV Keys
export {
  CHAR_KV_KEYS,
  CHAR_KV_KEY_SET,
  CHAR_KV_KEY_GROUPS,
  CHAR_KV_GROUP_NAMES,
  CHAR_KV_GROUP_ORDER,
  INVENTORY_ITEM_PROPERTIES,
  type InventoryItemProperty,
  isCharKvKey,
  isValidItemId,
  isInventoryKey,
  parseInventoryKey,
  getInvalidKeys,
  validateCharKvKeys,
} from './charKvKeys.js';
