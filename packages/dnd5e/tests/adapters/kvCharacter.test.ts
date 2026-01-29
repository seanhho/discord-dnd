/**
 * Tests for KV character adapter.
 */

import { describe, it, expect } from 'vitest';
import { kvToCharacterSnapshot, kvToAbilityScores } from '../../src/adapters/kvCharacter.js';
import type { KVRecord } from '../../src/adapters/kvCharacter.js';

describe('kvToCharacterSnapshot', () => {
  it('should convert basic character data', () => {
    const kv: KVRecord = {
      name: { t: 's', v: 'Aragorn' },
      level: { t: 'n', v: 8 },
      str: { t: 'n', v: 16 },
      dex: { t: 'n', v: 14 },
      con: { t: 'n', v: 14 },
      int: { t: 'n', v: 12 },
      wis: { t: 'n', v: 13 },
      cha: { t: 'n', v: 10 },
    };

    const result = kvToCharacterSnapshot(kv);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.snapshot.name).toBe('Aragorn');
      expect(result.snapshot.level).toBe(8);
      expect(result.snapshot.abilityScores.str).toBe(16);
      expect(result.snapshot.abilityScores.dex).toBe(14);
    }
  });

  it('should use defaults for missing values', () => {
    const kv: KVRecord = {
      name: { t: 's', v: 'Newbie' },
    };

    const result = kvToCharacterSnapshot(kv);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.snapshot.level).toBe(1);
      expect(result.snapshot.abilityScores.str).toBe(10);
    }
  });

  it('should extract skill proficiencies', () => {
    const kv: KVRecord = {
      name: { t: 's', v: 'Rogue' },
      level: { t: 'n', v: 3 },
      str: { t: 'n', v: 10 },
      dex: { t: 'n', v: 18 },
      con: { t: 'n', v: 12 },
      int: { t: 'n', v: 14 },
      wis: { t: 'n', v: 10 },
      cha: { t: 'n', v: 12 },
      'skill.stealth': { t: 's', v: 'expertise' },
      'skill.acrobatics': { t: 's', v: 'proficient' },
      'skill.perception': { t: 's', v: 'proficient' },
    };

    const result = kvToCharacterSnapshot(kv);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.snapshot.skillProficiencies?.stealth).toBe('expertise');
      expect(result.snapshot.skillProficiencies?.acrobatics).toBe('proficient');
      expect(result.snapshot.skillProficiencies?.perception).toBe('proficient');
    }
  });

  it('should extract misc bonuses', () => {
    const kv: KVRecord = {
      name: { t: 's', v: 'Buffed' },
      ac_bonus: { t: 'n', v: 2 },
      attack_bonus: { t: 'n', v: 1 },
      'skill_bonus.perception': { t: 'n', v: 5 },
    };

    const result = kvToCharacterSnapshot(kv);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.snapshot.acBonus).toBe(2);
      expect(result.snapshot.attackBonus).toBe(1);
      expect(result.snapshot.skillBonuses?.perception).toBe(5);
    }
  });

  it('should fail for invalid level', () => {
    const kv: KVRecord = {
      name: { t: 's', v: 'Invalid' },
      level: { t: 'n', v: 25 },
    };

    const result = kvToCharacterSnapshot(kv);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('level');
    }
  });

  it('should fail for invalid ability score', () => {
    const kv: KVRecord = {
      name: { t: 's', v: 'Invalid' },
      str: { t: 'n', v: 50 },
    };

    const result = kvToCharacterSnapshot(kv);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('str');
    }
  });

  it('should enforce strict mode', () => {
    const kv: KVRecord = {};

    const result = kvToCharacterSnapshot(kv, { strict: true });

    expect(result.success).toBe(false);
  });
});

describe('kvToAbilityScores', () => {
  it('should extract ability scores', () => {
    const kv: KVRecord = {
      str: { t: 'n', v: 18 },
      dex: { t: 'n', v: 14 },
      con: { t: 'n', v: 16 },
      int: { t: 'n', v: 10 },
      wis: { t: 'n', v: 12 },
      cha: { t: 'n', v: 8 },
    };

    const scores = kvToAbilityScores(kv);

    expect(scores.str).toBe(18);
    expect(scores.dex).toBe(14);
    expect(scores.con).toBe(16);
    expect(scores.int).toBe(10);
    expect(scores.wis).toBe(12);
    expect(scores.cha).toBe(8);
  });

  it('should use default for missing scores', () => {
    const kv: KVRecord = {
      str: { t: 'n', v: 18 },
    };

    const scores = kvToAbilityScores(kv, 10);

    expect(scores.str).toBe(18);
    expect(scores.dex).toBe(10);
    expect(scores.con).toBe(10);
  });
});
