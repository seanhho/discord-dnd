/**
 * Equipment Slots Adapter
 *
 * Interprets equip.* and inv.* KV keys into weapon/armor selections.
 * Converts KV storage format to Weapon5e/Armor5e types for rules.
 */

import type { DamageType, AttackType, WeaponProperty, ArmorCategory } from '@discord-bot/dnd5e-types';
import type { Weapon5e, Armor5e } from '../types.js';
import type { KVRecord } from './kvCharacter.js';

/**
 * Equipment slot identifiers.
 */
export const EQUIPMENT_SLOTS = [
  'armor.body',
  'armor.shield',
  'weapon.main',
  'weapon.off',
] as const;

export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

/**
 * Result of extracting equipped items.
 */
export interface EquippedItems {
  armor?: Armor5e;
  shield?: Armor5e;
  mainWeapon?: Weapon5e;
  offWeapon?: Weapon5e;
}

/**
 * Extract a string value from KV.
 */
function getString(kv: KVRecord, key: string): string | undefined {
  const attr = kv[key];
  if (!attr) return undefined;
  return String(attr.v);
}

/**
 * Extract a number value from KV.
 */
function getNumber(kv: KVRecord, key: string): number | undefined {
  const attr = kv[key];
  if (!attr) return undefined;
  if (attr.t === 'n') return attr.v as number;
  if (typeof attr.v === 'string') {
    const parsed = parseInt(attr.v, 10);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/**
 * Extract weapon from inventory KV.
 *
 * Expected keys:
 * - inv.<id>.name
 * - inv.<id>.type = 'weapon'
 * - inv.<id>.damage (damage dice like "1d8")
 * - inv.<id>.damage_type (optional, default 'slashing')
 * - inv.<id>.attack_type (optional, default 'melee')
 * - inv.<id>.properties (optional, comma-separated)
 * - inv.<id>.attack_bonus (optional)
 * - inv.<id>.damage_bonus (optional)
 */
export function extractWeaponFromKV(
  kv: KVRecord,
  itemId: string
): Weapon5e | null {
  const prefix = `inv.${itemId}`;

  const name = getString(kv, `${prefix}.name`);
  const type = getString(kv, `${prefix}.type`);

  if (!name || type !== 'weapon') {
    return null;
  }

  const damageDice = getString(kv, `${prefix}.damage`) ?? '1d4';
  const damageType = (getString(kv, `${prefix}.damage_type`) ?? 'slashing') as DamageType;
  const attackType = (getString(kv, `${prefix}.attack_type`) ?? 'melee') as AttackType;

  const propertiesStr = getString(kv, `${prefix}.properties`);
  const properties: WeaponProperty[] | undefined = propertiesStr
    ? (propertiesStr.split(',').map((p) => p.trim()) as WeaponProperty[])
    : undefined;

  const attackBonus = getNumber(kv, `${prefix}.attack_bonus`);
  const damageBonus = getNumber(kv, `${prefix}.damage_bonus`);

  return {
    id: itemId,
    name,
    attackType,
    damageDice,
    damageType,
    properties,
    attackBonus,
    damageBonus,
  };
}

/**
 * Extract armor from inventory KV.
 *
 * Expected keys:
 * - inv.<id>.name
 * - inv.<id>.type = 'armor'
 * - inv.<id>.ac (base AC)
 * - inv.<id>.armor_category (light, medium, heavy, shield)
 * - inv.<id>.magic_bonus (optional)
 * - inv.<id>.str_req (optional, STR requirement)
 * - inv.<id>.stealth_dis (optional, boolean)
 */
export function extractArmorFromKV(
  kv: KVRecord,
  itemId: string
): Armor5e | null {
  const prefix = `inv.${itemId}`;

  const name = getString(kv, `${prefix}.name`);
  const type = getString(kv, `${prefix}.type`);

  if (!name || type !== 'armor') {
    return null;
  }

  const baseAC = getNumber(kv, `${prefix}.ac`) ?? 10;
  const category = (getString(kv, `${prefix}.armor_category`) ?? 'light') as ArmorCategory;
  const magicBonus = getNumber(kv, `${prefix}.magic_bonus`);
  const strengthRequirement = getNumber(kv, `${prefix}.str_req`);

  const stealthDisStr = getString(kv, `${prefix}.stealth_dis`);
  const stealthDisadvantage = stealthDisStr === 'true' || stealthDisStr === '1';

  return {
    id: itemId,
    name,
    category,
    baseAC,
    magicBonus,
    strengthRequirement,
    stealthDisadvantage: stealthDisadvantage || undefined,
  };
}

/**
 * Extract all equipped items from KV.
 *
 * Reads equip.<slot> keys to find equipped item IDs,
 * then extracts item data from inv.<id>.* keys.
 */
export function extractEquippedItems(kv: KVRecord): EquippedItems {
  const result: EquippedItems = {};

  // Body armor
  const bodyArmorId = getString(kv, 'equip.armor.body');
  if (bodyArmorId) {
    const armor = extractArmorFromKV(kv, bodyArmorId);
    if (armor && armor.category !== 'shield') {
      result.armor = armor;
    }
  }

  // Shield
  const shieldId = getString(kv, 'equip.armor.shield');
  if (shieldId) {
    const shield = extractArmorFromKV(kv, shieldId);
    if (shield && shield.category === 'shield') {
      result.shield = shield;
    }
  }

  // Main weapon
  const mainWeaponId = getString(kv, 'equip.weapon.main');
  if (mainWeaponId) {
    const weapon = extractWeaponFromKV(kv, mainWeaponId);
    if (weapon) {
      result.mainWeapon = weapon;
    }
  }

  // Off-hand weapon
  const offWeaponId = getString(kv, 'equip.weapon.off');
  if (offWeaponId) {
    const weapon = extractWeaponFromKV(kv, offWeaponId);
    if (weapon) {
      result.offWeapon = weapon;
    }
  }

  return result;
}

/**
 * Get all inventory item IDs from KV.
 */
export function getInventoryItemIds(kv: KVRecord): string[] {
  const ids = new Set<string>();

  for (const key of Object.keys(kv)) {
    const match = key.match(/^inv\.([^.]+)\.name$/);
    if (match && match[1]) {
      ids.add(match[1]);
    }
  }

  return Array.from(ids);
}

/**
 * Get all weapons from inventory.
 */
export function extractAllWeapons(kv: KVRecord): Weapon5e[] {
  const ids = getInventoryItemIds(kv);
  const weapons: Weapon5e[] = [];

  for (const id of ids) {
    const weapon = extractWeaponFromKV(kv, id);
    if (weapon) {
      weapons.push(weapon);
    }
  }

  return weapons;
}

/**
 * Get all armor from inventory.
 */
export function extractAllArmor(kv: KVRecord): Armor5e[] {
  const ids = getInventoryItemIds(kv);
  const armors: Armor5e[] = [];

  for (const id of ids) {
    const armor = extractArmorFromKV(kv, id);
    if (armor) {
      armors.push(armor);
    }
  }

  return armors;
}
