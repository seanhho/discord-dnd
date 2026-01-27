import { describe, it, expect } from 'vitest';
import { parsePatch } from '../kv/parser.js';

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
      const result = parsePatch('{str:18}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toEqual([{ key: 'str', rawValue: '18' }]);
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
      const result = parsePatch('{proficient:true}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toEqual([{ key: 'proficient', rawValue: 'true' }]);
      }
    });

    it('should parse boolean false', () => {
      const result = parsePatch('{proficient:false}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toEqual([{ key: 'proficient', rawValue: 'false' }]);
      }
    });

    it('should parse quoted string', () => {
      const result = parsePatch('{name:"Gandalf the Grey"}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toEqual([{ key: 'name', rawValue: 'Gandalf the Grey' }]);
      }
    });

    it('should parse unquoted string token', () => {
      const result = parsePatch('{class:Wizard}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toEqual([{ key: 'class', rawValue: 'Wizard' }]);
      }
    });

    it('should parse multiple values', () => {
      const result = parsePatch('{str:16, dex:14, con:12}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toHaveLength(3);
        expect(result.entries).toContainEqual({ key: 'str', rawValue: '16' });
        expect(result.entries).toContainEqual({ key: 'dex', rawValue: '14' });
        expect(result.entries).toContainEqual({ key: 'con', rawValue: '12' });
      }
    });

    it('should handle mixed types', () => {
      const result = parsePatch('{level:5, name:"Gandalf", proficient:true}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toHaveLength(3);
      }
    });

    it('should handle dotted keys', () => {
      const result = parsePatch('{hp.max:45, hp.current:32}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toContainEqual({ key: 'hp.max', rawValue: '45' });
        expect(result.entries).toContainEqual({ key: 'hp.current', rawValue: '32' });
      }
    });

    it('should handle keys with underscores and hyphens', () => {
      const result = parsePatch('{weapon_name:Sword, armor-class:16}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toContainEqual({ key: 'weapon_name', rawValue: 'Sword' });
        expect(result.entries).toContainEqual({ key: 'armor-class', rawValue: '16' });
      }
    });

    it('should ignore whitespace', () => {
      const result = parsePatch('{  str : 18 ,  dex : 14  }');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toHaveLength(2);
        expect(result.entries).toContainEqual({ key: 'str', rawValue: '18' });
        expect(result.entries).toContainEqual({ key: 'dex', rawValue: '14' });
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
      // After the last value, trailing comma + whitespace is accepted
      // because the parser skips whitespace and finds end of content
      const result = parsePatch('{str:18, }');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toHaveLength(1);
        expect(result.entries[0]).toEqual({ key: 'str', rawValue: '18' });
      }
    });
  });

  describe('duplicate keys', () => {
    it('should use last value for duplicate keys', () => {
      const result = parsePatch('{str:16, str:18}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.entries).toHaveLength(1);
        expect(result.entries[0]).toEqual({ key: 'str', rawValue: '18' });
      }
    });
  });

  describe('invalid inputs', () => {
    it('should reject input not starting with {', () => {
      const result = parsePatch('str:18}');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('start with "{"');
      }
    });

    it('should reject input not ending with }', () => {
      const result = parsePatch('{str:18');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('end with "}"');
      }
    });

    it('should reject missing colon', () => {
      const result = parsePatch('{str 18}');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Expected ":"');
      }
    });

    it('should reject unterminated quoted string', () => {
      const result = parsePatch('{name:"Gandalf}');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Unterminated');
      }
    });

    it('should reject invalid key characters', () => {
      const result = parsePatch('{str@:18}');
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
