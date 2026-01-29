/**
 * Tests for AC calculations.
 */

import { describe, it, expect } from 'vitest';
import { computeArmorClass, meetsArmorRequirements } from '../../../src/rules/combat/ac.js';
import {
  LEATHER_ARMOR,
  CHAIN_SHIRT,
  CHAIN_MAIL,
  PLATE_ARMOR,
  SHIELD,
} from '../../../src/data/equipment/armors.js';
import type { Character5eSnapshot } from '../../../src/types.js';

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

describe('computeArmorClass', () => {
  it('should compute unarmored AC', () => {
    const char = createTestCharacter();
    const result = computeArmorClass(char);

    // 10 + DEX mod (+2)
    expect(result.total).toBe(12);
    expect(result.explain).toContain('Base');
    expect(result.explain).toContain('DEX');
  });

  it('should compute light armor AC with full DEX', () => {
    const char = createTestCharacter();
    const result = computeArmorClass(char, LEATHER_ARMOR);

    // Leather (11) + DEX mod (+2)
    expect(result.total).toBe(13);
  });

  it('should compute medium armor AC with DEX cap', () => {
    const char = createTestCharacter({
      abilityScores: {
        str: 16,
        dex: 18, // +4 mod, but capped at +2
        con: 12,
        int: 10,
        wis: 13,
        cha: 8,
      },
    });
    const result = computeArmorClass(char, CHAIN_SHIRT);

    // Chain Shirt (13) + DEX mod (capped at +2)
    expect(result.total).toBe(15);
    expect(result.explain).toContain('max 2');
  });

  it('should compute heavy armor AC without DEX', () => {
    const char = createTestCharacter();
    const result = computeArmorClass(char, CHAIN_MAIL);

    // Chain Mail (16), no DEX
    expect(result.total).toBe(16);
  });

  it('should add shield bonus', () => {
    const char = createTestCharacter();
    const result = computeArmorClass(char, CHAIN_MAIL, SHIELD);

    // Chain Mail (16) + Shield (2)
    expect(result.total).toBe(18);
  });

  it('should include misc AC bonus', () => {
    const char = createTestCharacter({ acBonus: 1 });
    const result = computeArmorClass(char, LEATHER_ARMOR);

    // Leather (11) + DEX (+2) + misc (+1)
    expect(result.total).toBe(14);
  });

  it('should handle Plate Armor', () => {
    const char = createTestCharacter();
    const result = computeArmorClass(char, PLATE_ARMOR, SHIELD);

    // Plate (18) + Shield (2)
    expect(result.total).toBe(20);
  });
});

describe('meetsArmorRequirements', () => {
  it('should pass for armor without STR requirement', () => {
    const char = createTestCharacter();
    const result = meetsArmorRequirements(char, LEATHER_ARMOR);

    expect(result.meets).toBe(true);
  });

  it('should pass when STR meets requirement', () => {
    const char = createTestCharacter({ abilityScores: { str: 15, dex: 14, con: 12, int: 10, wis: 13, cha: 8 } });
    const result = meetsArmorRequirements(char, PLATE_ARMOR);

    expect(result.meets).toBe(true);
  });

  it('should fail when STR is below requirement', () => {
    const char = createTestCharacter({ abilityScores: { str: 12, dex: 14, con: 12, int: 10, wis: 13, cha: 8 } });
    const result = meetsArmorRequirements(char, PLATE_ARMOR);

    expect(result.meets).toBe(false);
    expect(result.reason).toContain('15 STR');
  });
});
