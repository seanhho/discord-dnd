import { describe, it, expect } from 'vitest';
import {
  validateEntry,
  validatePatch,
  validateAllKeysAllowed,
  keyAffectsComputed,
} from '../kv/validators.js';
import type { ParsedEntry } from '../types.js';

describe('validateEntry', () => {
  describe('known keys - numbers', () => {
    it('should coerce valid number for str', () => {
      const result = validateEntry({ key: 'str', rawValue: '18' });
      expect(result.valid).toBe(true);
      expect(result.coercedType).toBe('number');
      expect(result.value).toBe(18);
      expect(result.error).toBeUndefined();
    });

    it('should reject non-numeric value for number key', () => {
      const result = validateEntry({ key: 'str', rawValue: 'abc' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be a number');
    });

    it('should reject non-integer for integer key', () => {
      const result = validateEntry({ key: 'level', rawValue: '5.5' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be an integer');
    });

    it('should reject value below min', () => {
      const result = validateEntry({ key: 'level', rawValue: '0' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 1');
    });

    it('should reject value above max', () => {
      const result = validateEntry({ key: 'level', rawValue: '25' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at most 20');
    });

    it('should accept value at min boundary', () => {
      const result = validateEntry({ key: 'level', rawValue: '1' });
      expect(result.valid).toBe(true);
      expect(result.value).toBe(1);
    });

    it('should accept value at max boundary', () => {
      const result = validateEntry({ key: 'level', rawValue: '20' });
      expect(result.valid).toBe(true);
      expect(result.value).toBe(20);
    });

    it('should validate hp.current with min 0', () => {
      const result = validateEntry({ key: 'hp.current', rawValue: '0' });
      expect(result.valid).toBe(true);
      expect(result.value).toBe(0);
    });

    it('should reject hp.current below 0', () => {
      const result = validateEntry({ key: 'hp.current', rawValue: '-1' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 0');
    });
  });

  describe('known keys - booleans', () => {
    it('should coerce "true" to boolean true', () => {
      const result = validateEntry({ key: 'weapon.primary.proficient', rawValue: 'true' });
      expect(result.valid).toBe(true);
      expect(result.coercedType).toBe('boolean');
      expect(result.value).toBe(true);
    });

    it('should coerce "false" to boolean false', () => {
      const result = validateEntry({ key: 'weapon.primary.proficient', rawValue: 'false' });
      expect(result.valid).toBe(true);
      expect(result.coercedType).toBe('boolean');
      expect(result.value).toBe(false);
    });

    it('should be case-insensitive for boolean', () => {
      const result1 = validateEntry({ key: 'weapon.primary.proficient', rawValue: 'TRUE' });
      expect(result1.valid).toBe(true);
      expect(result1.value).toBe(true);

      const result2 = validateEntry({ key: 'weapon.primary.proficient', rawValue: 'False' });
      expect(result2.valid).toBe(true);
      expect(result2.value).toBe(false);
    });

    it('should reject non-boolean value for boolean key', () => {
      const result = validateEntry({ key: 'weapon.primary.proficient', rawValue: 'yes' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be true or false');
    });
  });

  describe('known keys - strings', () => {
    it('should accept string for string key', () => {
      const result = validateEntry({ key: 'name', rawValue: 'Gandalf' });
      expect(result.valid).toBe(true);
      expect(result.coercedType).toBe('string');
      expect(result.value).toBe('Gandalf');
    });

    it('should accept string with spaces (from quoted input)', () => {
      const result = validateEntry({ key: 'name', rawValue: 'Gandalf the Grey' });
      expect(result.valid).toBe(true);
      expect(result.value).toBe('Gandalf the Grey');
    });

    it('should accept weapon damage expression', () => {
      const result = validateEntry({ key: 'weapon.primary.damage', rawValue: '1d8+3' });
      expect(result.valid).toBe(true);
      expect(result.value).toBe('1d8+3');
    });
  });

  describe('unknown keys', () => {
    it('should reject unknown key', () => {
      const result = validateEntry({ key: 'custom.field', rawValue: '42' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown key');
    });

    it('should include help hint in error', () => {
      const result = validateEntry({ key: 'unknown_key', rawValue: 'value' });
      expect(result.error).toContain('/char show view:help');
    });
  });

  describe('inventory keys', () => {
    it('should accept valid inventory key', () => {
      const result = validateEntry({ key: 'inv.longsword.name', rawValue: 'Longsword' });
      expect(result.valid).toBe(true);
      expect(result.coercedType).toBe('string');
      expect(result.value).toBe('Longsword');
    });

    it('should accept inventory number properties', () => {
      const result = validateEntry({ key: 'inv.sword.qty', rawValue: '2' });
      expect(result.valid).toBe(true);
      expect(result.coercedType).toBe('number');
      expect(result.value).toBe(2);
    });

    it('should accept inventory boolean properties', () => {
      const result = validateEntry({ key: 'inv.plate.stealth_dis', rawValue: 'true' });
      expect(result.valid).toBe(true);
      expect(result.coercedType).toBe('boolean');
      expect(result.value).toBe(true);
    });

    it('should reject invalid inventory property', () => {
      const result = validateEntry({ key: 'inv.sword.invalid_prop', rawValue: 'test' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown key');
    });
  });
});

describe('validatePatch', () => {
  it('should validate all entries and collect results', () => {
    const entries: ParsedEntry[] = [
      { key: 'str', rawValue: '16' },
      { key: 'dex', rawValue: '14' },
    ];

    const result = validatePatch(entries);
    expect(result.success).toBe(true);
    expect(result.validations).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should collect all errors', () => {
    const entries: ParsedEntry[] = [
      { key: 'str', rawValue: 'abc' },
      { key: 'level', rawValue: '25' },
    ];

    const result = validatePatch(entries);
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it('should reject unknown keys with errors', () => {
    // Note: In practice, validateAllKeysAllowed() should be called first
    // This tests the fallback behavior in validatePatch
    const entries: ParsedEntry[] = [
      { key: 'str', rawValue: '16' },
      { key: 'custom', rawValue: 'value' },
    ];

    const result = validatePatch(entries);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('custom'))).toBe(true);
  });

  it('should return success false if any validation fails', () => {
    const entries: ParsedEntry[] = [
      { key: 'str', rawValue: '16' }, // valid
      { key: 'level', rawValue: '99' }, // invalid
      { key: 'dex', rawValue: '14' }, // valid
    ];

    const result = validatePatch(entries);
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
  });
});

describe('validateAllKeysAllowed', () => {
  it('should return undefined for all valid static keys', () => {
    const entries: ParsedEntry[] = [
      { key: 'str', rawValue: '16' },
      { key: 'dex', rawValue: '14' },
      { key: 'name', rawValue: 'Gandalf' },
      { key: 'level', rawValue: '5' },
    ];
    expect(validateAllKeysAllowed(entries)).toBeUndefined();
  });

  it('should return undefined for valid inventory keys', () => {
    const entries: ParsedEntry[] = [
      { key: 'inv.longsword.name', rawValue: 'Longsword' },
      { key: 'inv.longsword.damage', rawValue: '1d8' },
      { key: 'inv.shield.ac', rawValue: '2' },
    ];
    expect(validateAllKeysAllowed(entries)).toBeUndefined();
  });

  it('should return error for unknown keys', () => {
    const entries: ParsedEntry[] = [
      { key: 'str', rawValue: '16' },
      { key: 'unknown_key', rawValue: 'value' },
    ];
    const result = validateAllKeysAllowed(entries);
    expect(result).toBeDefined();
    expect(result!.success).toBe(false);
    expect(result!.invalidKeys).toContain('unknown_key');
    expect(result!.error).toContain('unknown_key');
  });

  it('should list multiple invalid keys', () => {
    const entries: ParsedEntry[] = [
      { key: 'foo', rawValue: '1' },
      { key: 'bar', rawValue: '2' },
      { key: 'str', rawValue: '16' },
    ];
    const result = validateAllKeysAllowed(entries);
    expect(result).toBeDefined();
    expect(result!.invalidKeys).toContain('foo');
    expect(result!.invalidKeys).toContain('bar');
    expect(result!.invalidKeys).not.toContain('str');
  });

  it('should reject invalid inventory key patterns', () => {
    const entries: ParsedEntry[] = [
      { key: 'inv.sword.invalid_property', rawValue: 'test' },
    ];
    const result = validateAllKeysAllowed(entries);
    expect(result).toBeDefined();
    expect(result!.invalidKeys).toContain('inv.sword.invalid_property');
  });

  it('should include help hint in error message', () => {
    const entries: ParsedEntry[] = [{ key: 'custom', rawValue: 'value' }];
    const result = validateAllKeysAllowed(entries);
    expect(result).toBeDefined();
    expect(result!.error).toContain('/char show view:help');
  });

  it('should include inventory format hint in error message', () => {
    const entries: ParsedEntry[] = [{ key: 'custom', rawValue: 'value' }];
    const result = validateAllKeysAllowed(entries);
    expect(result).toBeDefined();
    expect(result!.error).toContain('inv.<item_id>');
  });
});

describe('keyAffectsComputed', () => {
  it('should return true for ability scores', () => {
    expect(keyAffectsComputed('str')).toBe(true);
    expect(keyAffectsComputed('dex')).toBe(true);
    expect(keyAffectsComputed('con')).toBe(true);
    expect(keyAffectsComputed('int')).toBe(true);
    expect(keyAffectsComputed('wis')).toBe(true);
    expect(keyAffectsComputed('cha')).toBe(true);
  });

  it('should return true for level', () => {
    expect(keyAffectsComputed('level')).toBe(true);
  });

  it('should return true for weapon proficiency', () => {
    expect(keyAffectsComputed('weapon.primary.proficient')).toBe(true);
  });

  it('should return false for non-computed keys', () => {
    expect(keyAffectsComputed('name')).toBe(false);
    expect(keyAffectsComputed('class')).toBe(false);
    expect(keyAffectsComputed('hp.max')).toBe(false);
    expect(keyAffectsComputed('ac')).toBe(false);
  });

  it('should return false for unknown keys', () => {
    expect(keyAffectsComputed('custom.key')).toBe(false);
  });
});
