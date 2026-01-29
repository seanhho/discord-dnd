/**
 * Tests for ability score calculations.
 */

import { describe, it, expect } from 'vitest';
import { abilityMod, formatAbilityMod } from '../../src/rules/ability.js';

describe('abilityMod', () => {
  it('should calculate modifier for standard scores', () => {
    expect(abilityMod(1)).toBe(-5);
    expect(abilityMod(2)).toBe(-4);
    expect(abilityMod(3)).toBe(-4);
    expect(abilityMod(8)).toBe(-1);
    expect(abilityMod(9)).toBe(-1);
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(11)).toBe(0);
    expect(abilityMod(12)).toBe(1);
    expect(abilityMod(13)).toBe(1);
    expect(abilityMod(14)).toBe(2);
    expect(abilityMod(15)).toBe(2);
    expect(abilityMod(16)).toBe(3);
    expect(abilityMod(17)).toBe(3);
    expect(abilityMod(18)).toBe(4);
    expect(abilityMod(19)).toBe(4);
    expect(abilityMod(20)).toBe(5);
  });

  it('should handle high scores', () => {
    expect(abilityMod(22)).toBe(6);
    expect(abilityMod(24)).toBe(7);
    expect(abilityMod(30)).toBe(10);
  });
});

describe('formatAbilityMod', () => {
  it('should format positive modifiers with +', () => {
    expect(formatAbilityMod(12)).toBe('+1');
    expect(formatAbilityMod(14)).toBe('+2');
    expect(formatAbilityMod(18)).toBe('+4');
  });

  it('should format zero modifier with +', () => {
    expect(formatAbilityMod(10)).toBe('+0');
    expect(formatAbilityMod(11)).toBe('+0');
  });

  it('should format negative modifiers without +', () => {
    expect(formatAbilityMod(8)).toBe('-1');
    expect(formatAbilityMod(6)).toBe('-2');
    expect(formatAbilityMod(1)).toBe('-5');
  });
});
