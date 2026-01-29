/**
 * Tests for proficiency bonus calculations.
 */

import { describe, it, expect } from 'vitest';
import { proficiencyBonusForLevel, calculateProficiencyBonus } from '../../src/rules/proficiency.js';

describe('proficiencyBonusForLevel', () => {
  it('should return +2 for levels 1-4', () => {
    expect(proficiencyBonusForLevel(1)).toBe(2);
    expect(proficiencyBonusForLevel(2)).toBe(2);
    expect(proficiencyBonusForLevel(3)).toBe(2);
    expect(proficiencyBonusForLevel(4)).toBe(2);
  });

  it('should return +3 for levels 5-8', () => {
    expect(proficiencyBonusForLevel(5)).toBe(3);
    expect(proficiencyBonusForLevel(6)).toBe(3);
    expect(proficiencyBonusForLevel(7)).toBe(3);
    expect(proficiencyBonusForLevel(8)).toBe(3);
  });

  it('should return +4 for levels 9-12', () => {
    expect(proficiencyBonusForLevel(9)).toBe(4);
    expect(proficiencyBonusForLevel(10)).toBe(4);
    expect(proficiencyBonusForLevel(11)).toBe(4);
    expect(proficiencyBonusForLevel(12)).toBe(4);
  });

  it('should return +5 for levels 13-16', () => {
    expect(proficiencyBonusForLevel(13)).toBe(5);
    expect(proficiencyBonusForLevel(14)).toBe(5);
    expect(proficiencyBonusForLevel(15)).toBe(5);
    expect(proficiencyBonusForLevel(16)).toBe(5);
  });

  it('should return +6 for levels 17-20', () => {
    expect(proficiencyBonusForLevel(17)).toBe(6);
    expect(proficiencyBonusForLevel(18)).toBe(6);
    expect(proficiencyBonusForLevel(19)).toBe(6);
    expect(proficiencyBonusForLevel(20)).toBe(6);
  });

  it('should throw for invalid levels', () => {
    expect(() => proficiencyBonusForLevel(0)).toThrow();
    expect(() => proficiencyBonusForLevel(-1)).toThrow();
    expect(() => proficiencyBonusForLevel(21)).toThrow();
  });
});

describe('calculateProficiencyBonus', () => {
  it('should match the lookup table', () => {
    for (let level = 1; level <= 20; level++) {
      expect(calculateProficiencyBonus(level)).toBe(proficiencyBonusForLevel(level));
    }
  });
});
