import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyPatch,
  unsetKeys,
  getAttributeValues,
  formatDiffEntry,
} from '../service.js';
import type { Monster, MonsterFeatureDeps, AttributeValue } from '../types.js';
import { AttrValue } from '../types.js';

describe('applyPatch', () => {
  let mockMonsterRepo: MonsterFeatureDeps['monsterRepo'];
  let monster: Monster;

  beforeEach(() => {
    monster = {
      id: 'monster-1',
      guildId: 'guild-1',
      name: 'Goblin',
      attributes: {},
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    mockMonsterRepo = {
      createMonster: vi.fn(),
      getMonsterByName: vi.fn(),
      listMonsters: vi.fn(),
      updateMonsterAttributes: vi.fn().mockImplementation(async ({ patch }) => ({
        ...monster,
        attributes: { ...monster.attributes, ...patch },
        updatedAt: new Date().toISOString(),
      })),
      unsetMonsterAttributes: vi.fn(),
      setActiveMonster: vi.fn(),
      getActiveMonster: vi.fn(),
    };
  });

  it('should apply a valid patch', async () => {
    const result = await applyPatch(monster, '{ac:15, hp.max:22}', mockMonsterRepo);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.diff).toHaveLength(2);
      expect(result.diff).toContainEqual({
        key: 'ac',
        oldValue: undefined,
        newValue: 15,
      });
      expect(result.diff).toContainEqual({
        key: 'hp.max',
        oldValue: undefined,
        newValue: 22,
      });
    }
  });

  it('should track changes in diff', async () => {
    monster.attributes = {
      ac: AttrValue.num(13),
    };

    const result = await applyPatch(monster, '{ac:15}', mockMonsterRepo);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.diff).toContainEqual({
        key: 'ac',
        oldValue: 13,
        newValue: 15,
      });
    }
  });

  it('should fail for invalid patch syntax', async () => {
    const result = await applyPatch(monster, 'invalid', mockMonsterRepo);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('start with "{"');
    }
  });

  it('should fail for empty patch', async () => {
    const result = await applyPatch(monster, '{}', mockMonsterRepo);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('No attributes to update');
    }
  });

  it('should accept arbitrary keys (no allowlist)', async () => {
    const result = await applyPatch(
      monster,
      '{customKey:42, attack.bite.name:"Bite"}',
      mockMonsterRepo
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.diff).toHaveLength(2);
      expect(result.diff).toContainEqual({
        key: 'customKey',
        oldValue: undefined,
        newValue: 42,
      });
    }
  });

  it('should coerce values correctly', async () => {
    const result = await applyPatch(
      monster,
      '{ac:15, legendary:false, name:"Goblin Boss"}',
      mockMonsterRepo
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(mockMonsterRepo.updateMonsterAttributes).toHaveBeenCalledWith({
        monsterId: monster.id,
        patch: {
          ac: { t: 'n', v: 15 },
          legendary: { t: 'b', v: false },
          name: { t: 's', v: 'Goblin Boss' },
        },
      });
    }
  });
});

describe('unsetKeys', () => {
  let mockMonsterRepo: MonsterFeatureDeps['monsterRepo'];
  let monster: Monster;

  beforeEach(() => {
    monster = {
      id: 'monster-1',
      guildId: 'guild-1',
      name: 'Goblin',
      attributes: {
        ac: AttrValue.num(15),
        'hp.max': AttrValue.num(22),
        speed: AttrValue.num(30),
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    mockMonsterRepo = {
      createMonster: vi.fn(),
      getMonsterByName: vi.fn(),
      listMonsters: vi.fn(),
      updateMonsterAttributes: vi.fn(),
      unsetMonsterAttributes: vi.fn().mockImplementation(async ({ keys }) => {
        const newAttrs = { ...monster.attributes };
        for (const key of keys) {
          delete newAttrs[key];
        }
        return { ...monster, attributes: newAttrs };
      }),
      setActiveMonster: vi.fn(),
      getActiveMonster: vi.fn(),
    };
  });

  it('should unset existing keys', async () => {
    const result = await unsetKeys(monster, 'ac hp.max', mockMonsterRepo);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.removed).toEqual(['ac', 'hp.max']);
      expect(result.notFound).toEqual([]);
    }
  });

  it('should report non-existent keys', async () => {
    const result = await unsetKeys(monster, 'ac nonexistent', mockMonsterRepo);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.removed).toEqual(['ac']);
      expect(result.notFound).toEqual(['nonexistent']);
    }
  });

  it('should fail for empty keys string', async () => {
    const result = await unsetKeys(monster, '   ', mockMonsterRepo);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('No keys provided');
    }
  });

  it('should handle all keys not found', async () => {
    const result = await unsetKeys(monster, 'foo bar baz', mockMonsterRepo);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.removed).toEqual([]);
      expect(result.notFound).toEqual(['foo', 'bar', 'baz']);
      // Should not call updateMonsterAttributes if nothing to remove
      expect(mockMonsterRepo.unsetMonsterAttributes).not.toHaveBeenCalled();
    }
  });
});

describe('getAttributeValues', () => {
  const attributes: Record<string, AttributeValue> = {
    ac: AttrValue.num(15),
    'hp.max': AttrValue.num(22),
    'hp.current': AttrValue.num(18),
    name: AttrValue.str('Goblin'),
    legendary: AttrValue.bool(false),
    'attack.bite.name': AttrValue.str('Bite'),
    'attack.bite.bonus': AttrValue.num(4),
  };

  describe('with keys', () => {
    it('should get specific keys', () => {
      const result = getAttributeValues(attributes, { keys: ['ac', 'name'] });

      expect(result.values).toEqual({
        ac: { value: '15' },
        name: { value: '"Goblin"' },
      });
    });

    it('should report unset keys', () => {
      const result = getAttributeValues(attributes, { keys: ['ac', 'nonexistent'] });

      expect(result.values).toEqual({
        ac: { value: '15' },
        nonexistent: { value: '(unset)' },
      });
    });

    it('should format boolean values', () => {
      const result = getAttributeValues(attributes, { keys: ['legendary'] });

      expect(result.values).toEqual({
        legendary: { value: 'false' },
      });
    });
  });

  describe('with prefix', () => {
    it('should get all keys with prefix', () => {
      const result = getAttributeValues(attributes, { prefix: 'hp.' });

      expect(result.values).toEqual({
        'hp.max': { value: '22' },
        'hp.current': { value: '18' },
      });
    });

    it('should get nested attack attributes', () => {
      const result = getAttributeValues(attributes, { prefix: 'attack.bite' });

      expect(result.values).toEqual({
        'attack.bite.name': { value: '"Bite"' },
        'attack.bite.bonus': { value: '4' },
      });
    });

    it('should return empty for non-matching prefix', () => {
      const result = getAttributeValues(attributes, { prefix: 'nonexistent.' });

      expect(result.values).toEqual({});
    });
  });

  describe('with both keys and prefix', () => {
    it('should combine results', () => {
      const result = getAttributeValues(attributes, {
        keys: ['ac'],
        prefix: 'hp.',
      });

      expect(result.values).toEqual({
        ac: { value: '15' },
        'hp.max': { value: '22' },
        'hp.current': { value: '18' },
      });
    });
  });
});

describe('formatDiffEntry', () => {
  it('should format new value', () => {
    const result = formatDiffEntry({
      key: 'ac',
      oldValue: undefined,
      newValue: 15,
    });

    expect(result).toBe('  ac: 15 (new)');
  });

  it('should format changed value', () => {
    const result = formatDiffEntry({
      key: 'ac',
      oldValue: 13,
      newValue: 15,
    });

    expect(result).toBe('  ac: 13 -> 15');
  });

  it('should format unchanged value', () => {
    const result = formatDiffEntry({
      key: 'ac',
      oldValue: 15,
      newValue: 15,
    });

    expect(result).toBe('  ac: 15 (unchanged)');
  });

  it('should quote string values', () => {
    const result = formatDiffEntry({
      key: 'name',
      oldValue: 'Goblin',
      newValue: 'Goblin Boss',
    });

    expect(result).toBe('  name: "Goblin" -> "Goblin Boss"');
  });

  it('should format boolean values', () => {
    const result = formatDiffEntry({
      key: 'legendary',
      oldValue: false,
      newValue: true,
    });

    expect(result).toBe('  legendary: false -> true');
  });
});
