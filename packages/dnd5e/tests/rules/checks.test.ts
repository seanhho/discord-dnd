/**
 * Tests for skill and ability checks.
 */

import { describe, it, expect } from 'vitest';
import { computeSkillBonus, rollSkillCheck } from '../../src/rules/checks.js';
import { createMockRNG } from '../../src/engine/rng.js';
import type { Character5eSnapshot } from '../../src/types.js';

function createTestCharacter(overrides: Partial<Character5eSnapshot> = {}): Character5eSnapshot {
  return {
    name: 'Test Character',
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

describe('computeSkillBonus', () => {
  it('should compute basic skill bonus from ability', () => {
    const char = createTestCharacter();
    const result = computeSkillBonus(char, 'athletics');

    // STR mod (+3) only, no proficiency
    expect(result.total).toBe(3);
  });

  it('should add proficiency bonus when proficient', () => {
    const char = createTestCharacter({
      skillProficiencies: { athletics: 'proficient' },
    });
    const result = computeSkillBonus(char, 'athletics');

    // STR mod (+3) + prof (+3 at level 5)
    expect(result.total).toBe(6);
  });

  it('should double proficiency for expertise', () => {
    const char = createTestCharacter({
      skillProficiencies: { stealth: 'expertise' },
    });
    const result = computeSkillBonus(char, 'stealth');

    // DEX mod (+2) + expertise (+6 at level 5)
    expect(result.total).toBe(8);
  });

  it('should include misc skill bonuses', () => {
    const char = createTestCharacter({
      skillProficiencies: { perception: 'proficient' },
      skillBonuses: { perception: 2 },
    });
    const result = computeSkillBonus(char, 'perception');

    // WIS mod (+1) + prof (+3) + misc (+2)
    expect(result.total).toBe(6);
  });

  it('should generate explain string', () => {
    const char = createTestCharacter({
      skillProficiencies: { athletics: 'proficient' },
    });
    const result = computeSkillBonus(char, 'athletics');

    expect(result.explain).toContain('STR');
    expect(result.explain).toContain('Proficiency');
  });
});

describe('rollSkillCheck', () => {
  it('should roll d20 and add modifier', () => {
    const char = createTestCharacter();
    const rng = createMockRNG([15]);

    const result = rollSkillCheck(char, 'athletics', 'none', rng);

    expect(result.d20Rolls).toEqual([15]);
    expect(result.chosenRoll).toBe(15);
    expect(result.modifier).toBe(3); // STR mod
    expect(result.total).toBe(18);
  });

  it('should roll with advantage and take higher', () => {
    const char = createTestCharacter();
    const rng = createMockRNG([8, 15]);

    const result = rollSkillCheck(char, 'athletics', 'advantage', rng);

    expect(result.d20Rolls).toEqual([8, 15]);
    expect(result.chosenRoll).toBe(15);
    expect(result.advantageState).toBe('advantage');
  });

  it('should roll with disadvantage and take lower', () => {
    const char = createTestCharacter();
    const rng = createMockRNG([15, 8]);

    const result = rollSkillCheck(char, 'athletics', 'disadvantage', rng);

    expect(result.d20Rolls).toEqual([15, 8]);
    expect(result.chosenRoll).toBe(8);
    expect(result.advantageState).toBe('disadvantage');
  });
});
