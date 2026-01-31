import { describe, it, expect } from 'vitest';
import { parsePatch, validateEntry, validatePatch } from '../parser.js';

describe('parsePatch', () => {
  describe('valid inputs', () => {
    it('should parse empty patch', () => {
      const result = parsePatch('{}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toEqual([]);
      }
    });

    it('should parse single number value', () => {
      const result = parsePatch('{ac:15}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toEqual([{ key: 'ac', rawValue: '15' }]);
      }
    });

    it('should parse negative number', () => {
      const result = parsePatch('{modifier:-2}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toEqual([{ key: 'modifier', rawValue: '-2' }]);
      }
    });

    it('should parse zero', () => {
      const result = parsePatch('{hp.current:0}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toEqual([{ key: 'hp.current', rawValue: '0' }]);
      }
    });

    it('should parse boolean true', () => {
      const result = parsePatch('{legendary:true}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toEqual([{ key: 'legendary', rawValue: 'true' }]);
      }
    });

    it('should parse boolean false', () => {
      const result = parsePatch('{legendary:false}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toEqual([{ key: 'legendary', rawValue: 'false' }]);
      }
    });

    it('should parse quoted string', () => {
      const result = parsePatch('{name:"Goblin Boss"}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toEqual([{ key: 'name', rawValue: 'Goblin Boss' }]);
      }
    });

    it('should parse unquoted string token', () => {
      const result = parsePatch('{type:humanoid}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toEqual([{ key: 'type', rawValue: 'humanoid' }]);
      }
    });

    it('should parse multiple values', () => {
      const result = parsePatch('{ac:15, hp.max:22, speed:30}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toHaveLength(3);
        expect(result.entries).toContainEqual({ key: 'ac', rawValue: '15' });
        expect(result.entries).toContainEqual({ key: 'hp.max', rawValue: '22' });
        expect(result.entries).toContainEqual({ key: 'speed', rawValue: '30' });
      }
    });

    it('should handle mixed types', () => {
      const result = parsePatch('{ac:15, name:"Goblin", legendary:false}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toHaveLength(3);
      }
    });

    it('should handle dotted keys for nested attributes', () => {
      const result = parsePatch('{attack.bite.name:"Bite", attack.bite.bonus:4}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toContainEqual({ key: 'attack.bite.name', rawValue: 'Bite' });
        expect(result.entries).toContainEqual({ key: 'attack.bite.bonus', rawValue: '4' });
      }
    });

    it('should handle keys with underscores and hyphens', () => {
      const result = parsePatch('{damage_type:slashing, armor-class:16}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toContainEqual({ key: 'damage_type', rawValue: 'slashing' });
        expect(result.entries).toContainEqual({ key: 'armor-class', rawValue: '16' });
      }
    });

    it('should ignore whitespace', () => {
      const result = parsePatch('{  ac : 15 ,  hp.max : 22  }');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toHaveLength(2);
        expect(result.entries).toContainEqual({ key: 'ac', rawValue: '15' });
        expect(result.entries).toContainEqual({ key: 'hp.max', rawValue: '22' });
      }
    });

    it('should handle escaped quotes in strings', () => {
      const result = parsePatch('{note:"He said \\"hello\\""}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toEqual([{ key: 'note', rawValue: 'He said "hello"' }]);
      }
    });

    it('should handle trailing comma gracefully', () => {
      const result = parsePatch('{ac:15, }');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toHaveLength(1);
        expect(result.entries[0]).toEqual({ key: 'ac', rawValue: '15' });
      }
    });

    it('should accept arbitrary keys (no allowlist)', () => {
      // Unlike /char, monster keys are NOT restricted
      const result = parsePatch('{customAttribute:42, weirdKey:value, x.y.z:deep}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toHaveLength(3);
        expect(result.entries).toContainEqual({ key: 'customAttribute', rawValue: '42' });
        expect(result.entries).toContainEqual({ key: 'weirdKey', rawValue: 'value' });
        expect(result.entries).toContainEqual({ key: 'x.y.z', rawValue: 'deep' });
      }
    });
  });

  describe('duplicate keys', () => {
    it('should use last value for duplicate keys', () => {
      const result = parsePatch('{ac:15, ac:18}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toHaveLength(1);
        expect(result.entries[0]).toEqual({ key: 'ac', rawValue: '18' });
      }
    });
  });

  describe('invalid inputs', () => {
    it('should reject input not starting with {', () => {
      const result = parsePatch('ac:15}');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('start with "{"');
      }
    });

    it('should reject input not ending with }', () => {
      const result = parsePatch('{ac:15');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('end with "}"');
      }
    });

    it('should reject missing colon', () => {
      const result = parsePatch('{ac 15}');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Expected ":"');
      }
    });

    it('should reject unterminated quoted string', () => {
      const result = parsePatch('{name:"Goblin}');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Unterminated');
      }
    });

    it('should reject invalid key characters', () => {
      const result = parsePatch('{ac@:15}');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid key format');
      }
    });
  });

  describe('prototype pollution protection', () => {
    it('should reject __proto__ key', () => {
      const result = parsePatch('{__proto__:malicious}');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Forbidden key');
      }
    });

    it('should reject constructor key', () => {
      const result = parsePatch('{constructor:malicious}');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Forbidden key');
      }
    });

    it('should reject prototype key', () => {
      const result = parsePatch('{prototype:malicious}');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Forbidden key');
      }
    });

    it('should reject case variations of forbidden keys', () => {
      const result = parsePatch('{__PROTO__:malicious}');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Forbidden key');
      }
    });
  });
});

describe('validateEntry', () => {
  it('should coerce integer to number', () => {
    const result = validateEntry({ key: 'ac', rawValue: '15' });
    expect(result.valid).toBe(true);
    expect(result.coercedType).toBe('number');
    expect(result.value).toBe(15);
  });

  it('should coerce float to number', () => {
    const result = validateEntry({ key: 'cr', rawValue: '0.5' });
    expect(result.valid).toBe(true);
    expect(result.coercedType).toBe('number');
    expect(result.value).toBe(0.5);
  });

  it('should coerce negative number', () => {
    const result = validateEntry({ key: 'modifier', rawValue: '-2' });
    expect(result.valid).toBe(true);
    expect(result.coercedType).toBe('number');
    expect(result.value).toBe(-2);
  });

  it('should coerce true to boolean', () => {
    const result = validateEntry({ key: 'legendary', rawValue: 'true' });
    expect(result.valid).toBe(true);
    expect(result.coercedType).toBe('boolean');
    expect(result.value).toBe(true);
  });

  it('should coerce false to boolean', () => {
    const result = validateEntry({ key: 'legendary', rawValue: 'false' });
    expect(result.valid).toBe(true);
    expect(result.coercedType).toBe('boolean');
    expect(result.value).toBe(false);
  });

  it('should coerce TRUE (case insensitive) to boolean', () => {
    const result = validateEntry({ key: 'legendary', rawValue: 'TRUE' });
    expect(result.valid).toBe(true);
    expect(result.coercedType).toBe('boolean');
    expect(result.value).toBe(true);
  });

  it('should treat non-numeric/boolean values as strings', () => {
    const result = validateEntry({ key: 'name', rawValue: 'Goblin' });
    expect(result.valid).toBe(true);
    expect(result.coercedType).toBe('string');
    expect(result.value).toBe('Goblin');
  });

  it('should allow any key (no allowlist enforcement)', () => {
    // Unlike /char, monster keys are NOT restricted to an allowlist
    const result = validateEntry({ key: 'customKey', rawValue: '42' });
    expect(result.valid).toBe(true);
    expect(result.coercedType).toBe('number');
    expect(result.value).toBe(42);
  });

  it('should allow deeply nested keys', () => {
    const result = validateEntry({ key: 'attack.bite.damage.dice', rawValue: '1d6' });
    expect(result.valid).toBe(true);
    expect(result.coercedType).toBe('string');
    expect(result.value).toBe('1d6');
  });
});

describe('validatePatch', () => {
  it('should return success for valid entries', () => {
    const result = validatePatch([
      { key: 'ac', rawValue: '15' },
      { key: 'hp.max', rawValue: '22' },
      { key: 'legendary', rawValue: 'false' },
    ]);

    expect(result.success).toBe(true);
    expect(result.validations).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
  });

  it('should return empty arrays for empty input', () => {
    const result = validatePatch([]);

    expect(result.success).toBe(true);
    expect(result.validations).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should validate arbitrary keys without errors', () => {
    // Monster keys are not restricted - no errors for unknown keys
    const result = validatePatch([
      { key: 'anyKey', rawValue: '42' },
      { key: 'deeply.nested.key', rawValue: 'value' },
      { key: 'customAttribute', rawValue: 'true' },
    ]);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
