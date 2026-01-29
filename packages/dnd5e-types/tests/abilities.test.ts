/**
 * Tests for ability score types and constants.
 */

import { describe, it, expect } from 'vitest';
import {
  ABILITIES,
  ABILITY_NAMES,
  ABILITY_ABBREV,
  type Ability,
  type AbilityScores,
} from '../src/index.js';

describe('ABILITIES', () => {
  it('should contain exactly 6 abilities', () => {
    expect(ABILITIES).toHaveLength(6);
  });

  it('should contain the core 6 abilities', () => {
    expect(ABILITIES).toContain('str');
    expect(ABILITIES).toContain('dex');
    expect(ABILITIES).toContain('con');
    expect(ABILITIES).toContain('int');
    expect(ABILITIES).toContain('wis');
    expect(ABILITIES).toContain('cha');
  });

  it('should be a const array (readonly at compile time)', () => {
    // TypeScript's 'as const' makes the array readonly at compile time
    // We verify the array has the expected structure
    expect(Array.isArray(ABILITIES)).toBe(true);
    expect(ABILITIES.length).toBe(6);
  });
});

describe('ABILITY_NAMES', () => {
  it('should have display names for all abilities', () => {
    for (const ability of ABILITIES) {
      expect(ABILITY_NAMES[ability]).toBeDefined();
      expect(typeof ABILITY_NAMES[ability]).toBe('string');
    }
  });

  it('should have correct display names', () => {
    expect(ABILITY_NAMES.str).toBe('Strength');
    expect(ABILITY_NAMES.dex).toBe('Dexterity');
    expect(ABILITY_NAMES.con).toBe('Constitution');
    expect(ABILITY_NAMES.int).toBe('Intelligence');
    expect(ABILITY_NAMES.wis).toBe('Wisdom');
    expect(ABILITY_NAMES.cha).toBe('Charisma');
  });
});

describe('ABILITY_ABBREV', () => {
  it('should have 3-letter abbreviations for all abilities', () => {
    for (const ability of ABILITIES) {
      expect(ABILITY_ABBREV[ability]).toBeDefined();
      expect(ABILITY_ABBREV[ability]).toHaveLength(3);
    }
  });
});

describe('AbilityScores type', () => {
  it('should allow a complete set of scores', () => {
    const scores: AbilityScores = {
      str: 10,
      dex: 14,
      con: 12,
      int: 16,
      wis: 13,
      cha: 8,
    };

    expect(scores.str).toBe(10);
    expect(scores.dex).toBe(14);
  });
});

describe('Ability type', () => {
  it('should accept valid ability strings', () => {
    const ability: Ability = 'str';
    expect(ability).toBe('str');
  });
});
