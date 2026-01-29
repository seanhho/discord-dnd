/**
 * Adapters module exports.
 */

export type { KVAttributeValue, KVRecord, KVConversionOptions, KVConversionResult } from './kvCharacter.js';
export { kvToCharacterSnapshot, kvToAbilityScores } from './kvCharacter.js';

export type { EquipmentSlot, EquippedItems } from './equipmentSlots.js';
export {
  EQUIPMENT_SLOTS,
  extractWeaponFromKV,
  extractArmorFromKV,
  extractEquippedItems,
  getInventoryItemIds,
  extractAllWeapons,
  extractAllArmor,
} from './equipmentSlots.js';
