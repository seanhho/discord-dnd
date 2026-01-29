/**
 * Tests for type guard functions.
 */

import { describe, it, expect } from 'vitest';
import {
  isAbility,
  isSkill,
  isDamageType,
  isCondition,
  isWeaponProperty,
} from '../src/index.js';

describe('isAbility', () => {
  it('should return true for valid abilities', () => {
    expect(isAbility('str')).toBe(true);
    expect(isAbility('dex')).toBe(true);
    expect(isAbility('con')).toBe(true);
    expect(isAbility('int')).toBe(true);
    expect(isAbility('wis')).toBe(true);
    expect(isAbility('cha')).toBe(true);
  });

  it('should return false for invalid strings', () => {
    expect(isAbility('strength')).toBe(false);
    expect(isAbility('STR')).toBe(false);
    expect(isAbility('Str')).toBe(false);
    expect(isAbility('invalid')).toBe(false);
    expect(isAbility('')).toBe(false);
  });

  it('should return false for non-strings', () => {
    expect(isAbility(null)).toBe(false);
    expect(isAbility(undefined)).toBe(false);
    expect(isAbility(123)).toBe(false);
    expect(isAbility({})).toBe(false);
    expect(isAbility([])).toBe(false);
  });
});

describe('isSkill', () => {
  it('should return true for valid skills', () => {
    expect(isSkill('acrobatics')).toBe(true);
    expect(isSkill('perception')).toBe(true);
    expect(isSkill('stealth')).toBe(true);
    expect(isSkill('animal_handling')).toBe(true);
    expect(isSkill('sleight_of_hand')).toBe(true);
  });

  it('should return false for invalid strings', () => {
    expect(isSkill('Acrobatics')).toBe(false);
    expect(isSkill('STEALTH')).toBe(false);
    expect(isSkill('invalid')).toBe(false);
    expect(isSkill('animal handling')).toBe(false);
  });

  it('should return false for non-strings', () => {
    expect(isSkill(null)).toBe(false);
    expect(isSkill(undefined)).toBe(false);
    expect(isSkill(42)).toBe(false);
  });
});

describe('isDamageType', () => {
  it('should return true for valid damage types', () => {
    expect(isDamageType('bludgeoning')).toBe(true);
    expect(isDamageType('piercing')).toBe(true);
    expect(isDamageType('slashing')).toBe(true);
    expect(isDamageType('fire')).toBe(true);
    expect(isDamageType('necrotic')).toBe(true);
  });

  it('should return false for invalid strings', () => {
    expect(isDamageType('Bludgeoning')).toBe(false);
    expect(isDamageType('FIRE')).toBe(false);
    expect(isDamageType('magical')).toBe(false);
  });
});

describe('isCondition', () => {
  it('should return true for valid conditions', () => {
    expect(isCondition('blinded')).toBe(true);
    expect(isCondition('charmed')).toBe(true);
    expect(isCondition('poisoned')).toBe(true);
    expect(isCondition('unconscious')).toBe(true);
  });

  it('should return false for invalid strings', () => {
    expect(isCondition('Blinded')).toBe(false);
    expect(isCondition('dead')).toBe(false);
    expect(isCondition('healthy')).toBe(false);
  });
});

describe('isWeaponProperty', () => {
  it('should return true for valid weapon properties', () => {
    expect(isWeaponProperty('finesse')).toBe(true);
    expect(isWeaponProperty('heavy')).toBe(true);
    expect(isWeaponProperty('light')).toBe(true);
    expect(isWeaponProperty('two_handed')).toBe(true);
    expect(isWeaponProperty('versatile')).toBe(true);
  });

  it('should return false for invalid strings', () => {
    expect(isWeaponProperty('Finesse')).toBe(false);
    expect(isWeaponProperty('magical')).toBe(false);
  });
});
