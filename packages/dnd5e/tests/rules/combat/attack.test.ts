/**
 * Tests for attack calculations.
 */

import { describe, it, expect } from 'vitest';
import {
  getAttackAbility,
  computeAttackBonus,
  rollAttack,
} from '../../../src/rules/combat/attack.js';
import { createMockRNG } from '../../../src/engine/rng.js';
import { LONGSWORD, DAGGER, SHORTBOW } from '../../../src/data/equipment/weapons.js';
import type { Character5eSnapshot, Weapon5e } from '../../../src/types.js';

function createTestCharacter(overrides: Partial<Character5eSnapshot> = {}): Character5eSnapshot {
  return {
    name: 'Fighter',
    level: 5,
    abilityScores: {
      str: 16,
      dex: 14,
      con: 12,
      int: 10,
      wis: 13,
      cha: 8,
    },
    ...overrides,
  };
}

describe('getAttackAbility', () => {
  it('should return STR for melee weapons', () => {
    const char = createTestCharacter();
    expect(getAttackAbility(LONGSWORD, char.abilityScores)).toBe('str');
  });

  it('should return DEX for ranged weapons', () => {
    const char = createTestCharacter();
    expect(getAttackAbility(SHORTBOW, char.abilityScores)).toBe('dex');
  });

  it('should use higher of STR/DEX for finesse weapons', () => {
    // STR 16 (+3) > DEX 14 (+2)
    const char = createTestCharacter();
    expect(getAttackAbility(DAGGER, char.abilityScores)).toBe('str');

    // DEX higher
    const dexChar = createTestCharacter({
      abilityScores: {
        str: 10,
        dex: 18,
        con: 12,
        int: 10,
        wis: 13,
        cha: 8,
      },
    });
    expect(getAttackAbility(DAGGER, dexChar.abilityScores)).toBe('dex');
  });
});

describe('computeAttackBonus', () => {
  it('should compute basic attack bonus', () => {
    const char = createTestCharacter();
    const result = computeAttackBonus(char, LONGSWORD);

    // STR mod (+3) + prof (+3 at level 5)
    expect(result.total).toBe(6);
  });

  it('should include weapon attack bonus', () => {
    const char = createTestCharacter();
    const magicSword: Weapon5e = {
      ...LONGSWORD,
      id: 'magic_longsword',
      name: '+1 Longsword',
      attackBonus: 1,
    };
    const result = computeAttackBonus(char, magicSword);

    // STR mod (+3) + prof (+3) + weapon (+1)
    expect(result.total).toBe(7);
  });

  it('should generate explain string with breakdown', () => {
    const char = createTestCharacter();
    const result = computeAttackBonus(char, LONGSWORD);

    expect(result.explain).toContain('STR');
    expect(result.explain).toContain('Proficiency');
  });
});

describe('rollAttack', () => {
  it('should roll d20 and add attack bonus', () => {
    const char = createTestCharacter();
    const rng = createMockRNG([15]);

    const result = rollAttack(char, LONGSWORD, 'none', {}, rng);

    expect(result.d20Rolls).toEqual([15]);
    expect(result.chosenRoll).toBe(15);
    expect(result.modifier).toBe(6);
    expect(result.total).toBe(21);
    expect(result.isCrit).toBe(false);
    expect(result.isCritFail).toBe(false);
  });

  it('should detect critical hit on natural 20', () => {
    const char = createTestCharacter();
    const rng = createMockRNG([20]);

    const result = rollAttack(char, LONGSWORD, 'none', {}, rng);

    expect(result.chosenRoll).toBe(20);
    expect(result.isCrit).toBe(true);
    expect(result.explain).toContain('CRIT');
  });

  it('should detect critical fail on natural 1', () => {
    const char = createTestCharacter();
    const rng = createMockRNG([1]);

    const result = rollAttack(char, LONGSWORD, 'none', {}, rng);

    expect(result.chosenRoll).toBe(1);
    expect(result.isCritFail).toBe(true);
    expect(result.explain).toContain('MISS');
  });

  it('should roll with advantage', () => {
    const char = createTestCharacter();
    const rng = createMockRNG([8, 17]);

    const result = rollAttack(char, LONGSWORD, 'advantage', {}, rng);

    expect(result.d20Rolls).toEqual([8, 17]);
    expect(result.chosenRoll).toBe(17);
    expect(result.advantageState).toBe('advantage');
  });

  it('should roll with disadvantage', () => {
    const char = createTestCharacter();
    const rng = createMockRNG([17, 8]);

    const result = rollAttack(char, LONGSWORD, 'disadvantage', {}, rng);

    expect(result.d20Rolls).toEqual([17, 8]);
    expect(result.chosenRoll).toBe(8);
    expect(result.advantageState).toBe('disadvantage');
  });
});
