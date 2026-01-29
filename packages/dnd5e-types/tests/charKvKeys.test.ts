import { describe, it, expect } from 'vitest';
import {
  CHAR_KV_KEYS,
  CHAR_KV_KEY_SET,
  isCharKvKey,
  isValidItemId,
  isInventoryKey,
  parseInventoryKey,
  getInvalidKeys,
  validateCharKvKeys,
  INVENTORY_ITEM_PROPERTIES,
} from '../src/charKvKeys.js';

describe('CHAR_KV_KEYS', () => {
  it('should include identity keys', () => {
    expect(CHAR_KV_KEYS).toContain('name');
    expect(CHAR_KV_KEYS).toContain('class');
    expect(CHAR_KV_KEYS).toContain('level');
    expect(CHAR_KV_KEYS).toContain('race');
    expect(CHAR_KV_KEYS).toContain('background');
  });

  it('should include ability score keys', () => {
    expect(CHAR_KV_KEYS).toContain('str');
    expect(CHAR_KV_KEYS).toContain('dex');
    expect(CHAR_KV_KEYS).toContain('con');
    expect(CHAR_KV_KEYS).toContain('int');
    expect(CHAR_KV_KEYS).toContain('wis');
    expect(CHAR_KV_KEYS).toContain('cha');
  });

  it('should include combat keys', () => {
    expect(CHAR_KV_KEYS).toContain('hp.max');
    expect(CHAR_KV_KEYS).toContain('hp.current');
    expect(CHAR_KV_KEYS).toContain('hp.temp');
    expect(CHAR_KV_KEYS).toContain('ac');
    expect(CHAR_KV_KEYS).toContain('speed');
    expect(CHAR_KV_KEYS).toContain('initiative');
  });

  it('should include equipment slot keys', () => {
    expect(CHAR_KV_KEYS).toContain('equip.armor.body');
    expect(CHAR_KV_KEYS).toContain('equip.armor.shield');
    expect(CHAR_KV_KEYS).toContain('equip.weapon.main');
    expect(CHAR_KV_KEYS).toContain('equip.weapon.off');
  });

  it('should include skill proficiency keys', () => {
    expect(CHAR_KV_KEYS).toContain('skill.acrobatics');
    expect(CHAR_KV_KEYS).toContain('skill.athletics');
    expect(CHAR_KV_KEYS).toContain('skill.perception');
    expect(CHAR_KV_KEYS).toContain('skill.stealth');
  });

  it('should include saving throw proficiency keys', () => {
    expect(CHAR_KV_KEYS).toContain('save.str');
    expect(CHAR_KV_KEYS).toContain('save.dex');
    expect(CHAR_KV_KEYS).toContain('save.con');
    expect(CHAR_KV_KEYS).toContain('save.int');
    expect(CHAR_KV_KEYS).toContain('save.wis');
    expect(CHAR_KV_KEYS).toContain('save.cha');
  });

  it('should include bonus keys', () => {
    expect(CHAR_KV_KEYS).toContain('ac_bonus');
    expect(CHAR_KV_KEYS).toContain('attack_bonus');
    expect(CHAR_KV_KEYS).toContain('damage_bonus');
    expect(CHAR_KV_KEYS).toContain('skill_bonus.stealth');
    expect(CHAR_KV_KEYS).toContain('skill_bonus.perception');
  });

  it('should include legacy weapon keys', () => {
    expect(CHAR_KV_KEYS).toContain('weapon.primary.name');
    expect(CHAR_KV_KEYS).toContain('weapon.primary.damage');
    expect(CHAR_KV_KEYS).toContain('weapon.primary.proficient');
  });
});

describe('CHAR_KV_KEY_SET', () => {
  it('should contain all keys from CHAR_KV_KEYS', () => {
    for (const key of CHAR_KV_KEYS) {
      expect(CHAR_KV_KEY_SET.has(key)).toBe(true);
    }
  });

  it('should have same size as CHAR_KV_KEYS', () => {
    expect(CHAR_KV_KEY_SET.size).toBe(CHAR_KV_KEYS.length);
  });
});

describe('isCharKvKey', () => {
  it('should return true for static keys', () => {
    expect(isCharKvKey('str')).toBe(true);
    expect(isCharKvKey('name')).toBe(true);
    expect(isCharKvKey('hp.max')).toBe(true);
    expect(isCharKvKey('skill.stealth')).toBe(true);
    expect(isCharKvKey('save.dex')).toBe(true);
  });

  it('should return true for valid inventory keys', () => {
    expect(isCharKvKey('inv.longsword.name')).toBe(true);
    expect(isCharKvKey('inv.shield.ac')).toBe(true);
    expect(isCharKvKey('inv.plate_armor.stealth_dis')).toBe(true);
    expect(isCharKvKey('inv.item123.qty')).toBe(true);
  });

  it('should return false for unknown keys', () => {
    expect(isCharKvKey('unknown')).toBe(false);
    expect(isCharKvKey('custom.field')).toBe(false);
    expect(isCharKvKey('')).toBe(false);
  });

  it('should return false for invalid inventory keys', () => {
    expect(isCharKvKey('inv.sword.invalid_prop')).toBe(false);
    expect(isCharKvKey('inv..name')).toBe(false);
    expect(isCharKvKey('inv.sword')).toBe(false);
    expect(isCharKvKey('inv.CAPS.name')).toBe(false);
  });
});

describe('isValidItemId', () => {
  it('should return true for valid item IDs', () => {
    expect(isValidItemId('longsword')).toBe(true);
    expect(isValidItemId('plate_armor')).toBe(true);
    expect(isValidItemId('item123')).toBe(true);
    expect(isValidItemId('a')).toBe(true);
  });

  it('should return false for invalid item IDs', () => {
    expect(isValidItemId('')).toBe(false);
    expect(isValidItemId('CAPS')).toBe(false);
    expect(isValidItemId('has-dash')).toBe(false);
    expect(isValidItemId('has space')).toBe(false);
    expect(isValidItemId('a'.repeat(65))).toBe(false); // Too long
  });
});

describe('isInventoryKey', () => {
  it('should return true for valid inventory keys', () => {
    expect(isInventoryKey('inv.sword.name')).toBe(true);
    expect(isInventoryKey('inv.shield.ac')).toBe(true);
  });

  it('should return false for non-inventory keys', () => {
    expect(isInventoryKey('str')).toBe(false);
    expect(isInventoryKey('name')).toBe(false);
    expect(isInventoryKey('inv.sword')).toBe(false);
  });
});

describe('parseInventoryKey', () => {
  it('should parse valid inventory key', () => {
    const result = parseInventoryKey('inv.longsword.name');
    expect(result).toEqual({ itemId: 'longsword', property: 'name' });
  });

  it('should parse all valid properties', () => {
    for (const prop of INVENTORY_ITEM_PROPERTIES) {
      const result = parseInventoryKey(`inv.test.${prop}`);
      expect(result).toEqual({ itemId: 'test', property: prop });
    }
  });

  it('should return null for invalid keys', () => {
    expect(parseInventoryKey('str')).toBeNull();
    expect(parseInventoryKey('inv.sword')).toBeNull();
    expect(parseInventoryKey('inv.sword.invalid')).toBeNull();
    expect(parseInventoryKey('inv..name')).toBeNull();
  });
});

describe('getInvalidKeys', () => {
  it('should return empty array for all valid keys', () => {
    const keys = ['str', 'dex', 'name', 'inv.sword.name'];
    expect(getInvalidKeys(keys)).toEqual([]);
  });

  it('should return invalid keys', () => {
    const keys = ['str', 'unknown', 'foo.bar'];
    expect(getInvalidKeys(keys)).toEqual(['unknown', 'foo.bar']);
  });

  it('should return all keys if none are valid', () => {
    const keys = ['foo', 'bar', 'baz'];
    expect(getInvalidKeys(keys)).toEqual(['foo', 'bar', 'baz']);
  });
});

describe('validateCharKvKeys', () => {
  it('should return valid true when all keys are valid', () => {
    const result = validateCharKvKeys(['str', 'dex', 'name']);
    expect(result.valid).toBe(true);
    expect(result.validKeys).toEqual(['str', 'dex', 'name']);
    expect(result.invalidKeys).toEqual([]);
  });

  it('should separate valid and invalid keys', () => {
    const result = validateCharKvKeys(['str', 'unknown', 'dex', 'foo']);
    expect(result.valid).toBe(false);
    expect(result.validKeys).toEqual(['str', 'dex']);
    expect(result.invalidKeys).toEqual(['unknown', 'foo']);
  });

  it('should handle inventory keys', () => {
    const result = validateCharKvKeys(['inv.sword.name', 'inv.sword.invalid']);
    expect(result.validKeys).toEqual(['inv.sword.name']);
    expect(result.invalidKeys).toEqual(['inv.sword.invalid']);
  });
});
