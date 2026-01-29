import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  crossFieldValidation,
  applyPatch,
  unsetKeys,
  getAttributeValues,
  formatDiffEntry,
} from '../kv/service.js';
import { AttrValue } from '../types.js';
import type { Character, AttributeValue } from '../types.js';
import type { CharacterRepo } from '../repo/ports.js';

// Mock character factory
function createMockCharacter(
  attrs: Record<string, AttributeValue> = {}
): Character {
  return {
    id: 'char-123',
    userId: 'user-456',
    guildId: 'guild-789',
    name: 'TestChar',
    attributes: attrs,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

// Mock repo factory
function createMockRepo(): CharacterRepo {
  return {
    createCharacter: vi.fn(),
    getByName: vi.fn(),
    listByUser: vi.fn(),
    updateAttributes: vi.fn(async ({ characterId, patch }) => {
      return createMockCharacter(patch);
    }),
    unsetAttributes: vi.fn(async ({ characterId, keys }) => {
      return createMockCharacter({});
    }),
    setActiveCharacter: vi.fn(),
    getActiveCharacter: vi.fn(),
  };
}

describe('crossFieldValidation', () => {
  it('should pass when hp.current <= hp.max', () => {
    const attrs: Record<string, AttributeValue> = {
      'hp.current': AttrValue.num(30),
      'hp.max': AttrValue.num(45),
    };

    const error = crossFieldValidation(attrs);
    expect(error).toBeUndefined();
  });

  it('should pass when hp.current equals hp.max', () => {
    const attrs: Record<string, AttributeValue> = {
      'hp.current': AttrValue.num(45),
      'hp.max': AttrValue.num(45),
    };

    const error = crossFieldValidation(attrs);
    expect(error).toBeUndefined();
  });

  it('should fail when hp.current > hp.max', () => {
    const attrs: Record<string, AttributeValue> = {
      'hp.current': AttrValue.num(50),
      'hp.max': AttrValue.num(45),
    };

    const error = crossFieldValidation(attrs);
    expect(error).toBeDefined();
    expect(error).toContain('hp.current');
    expect(error).toContain('hp.max');
    expect(error).toContain('50');
    expect(error).toContain('45');
  });

  it('should pass when only hp.current exists', () => {
    const attrs: Record<string, AttributeValue> = {
      'hp.current': AttrValue.num(30),
    };

    const error = crossFieldValidation(attrs);
    expect(error).toBeUndefined();
  });

  it('should pass when only hp.max exists', () => {
    const attrs: Record<string, AttributeValue> = {
      'hp.max': AttrValue.num(45),
    };

    const error = crossFieldValidation(attrs);
    expect(error).toBeUndefined();
  });

  it('should pass when neither hp field exists', () => {
    const attrs: Record<string, AttributeValue> = {
      str: AttrValue.num(16),
    };

    const error = crossFieldValidation(attrs);
    expect(error).toBeUndefined();
  });

  it('should validate merged existing + patch attributes', () => {
    // Simulate existing attributes + new patch
    const existing: Record<string, AttributeValue> = {
      'hp.max': AttrValue.num(45),
    };
    const patch: Record<string, AttributeValue> = {
      'hp.current': AttrValue.num(50), // This would exceed max
    };
    const effective = { ...existing, ...patch };

    const error = crossFieldValidation(effective);
    expect(error).toBeDefined();
    expect(error).toContain('cannot exceed');
  });
});

describe('applyPatch', () => {
  let mockRepo: CharacterRepo;

  beforeEach(() => {
    mockRepo = createMockRepo();
  });

  it('should apply valid patch and return diff', async () => {
    const character = createMockCharacter({});

    // Mock updateAttributes to return merged result
    vi.mocked(mockRepo.updateAttributes).mockResolvedValueOnce(
      createMockCharacter({
        str: AttrValue.num(16),
        dex: AttrValue.num(14),
      })
    );

    const result = await applyPatch(character, '{str:16, dex:14}', mockRepo);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.diff).toHaveLength(2);
      expect(result.diff.find((d) => d.key === 'str')?.newValue).toBe(16);
      expect(result.warnings).toHaveLength(0);
    }
  });

  it('should return error for invalid patch syntax', async () => {
    const character = createMockCharacter({});

    const result = await applyPatch(character, 'str:16', mockRepo);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('start with');
    }
  });

  it('should return error for validation failures', async () => {
    const character = createMockCharacter({});

    const result = await applyPatch(character, '{level:99}', mockRepo);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Validation failed');
      expect(result.error).toContain('at most 20');
    }
  });

  it('should return error for cross-field validation failure', async () => {
    const character = createMockCharacter({
      'hp.max': AttrValue.num(45),
    });

    const result = await applyPatch(character, '{hp.current:50}', mockRepo);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('hp.current');
      expect(result.error).toContain('cannot exceed');
    }
  });

  it('should reject unknown keys', async () => {
    const character = createMockCharacter({});

    const result = await applyPatch(character, '{str:16, custom:value}', mockRepo);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('custom');
      expect(result.error).toContain('Unknown keys');
    }
  });

  it('should return computed values when affectsComputed keys change', async () => {
    const character = createMockCharacter({});

    vi.mocked(mockRepo.updateAttributes).mockResolvedValueOnce(
      createMockCharacter({
        level: AttrValue.num(5),
        str: AttrValue.num(16),
      })
    );

    const result = await applyPatch(character, '{level:5, str:16}', mockRepo);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.computed.proficiencyBonus).toBe(3);
      expect(result.computed.strMod).toBe(3);
    }
  });

  it('should return error for empty patch', async () => {
    const character = createMockCharacter({});

    const result = await applyPatch(character, '{}', mockRepo);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('empty');
    }
  });

  it('should show old -> new in diff for existing keys', async () => {
    const character = createMockCharacter({
      str: AttrValue.num(14),
    });

    vi.mocked(mockRepo.updateAttributes).mockResolvedValueOnce(
      createMockCharacter({
        str: AttrValue.num(16),
      })
    );

    const result = await applyPatch(character, '{str:16}', mockRepo);

    expect(result.success).toBe(true);
    if (result.success) {
      const strDiff = result.diff.find((d) => d.key === 'str');
      expect(strDiff?.oldValue).toBe(14);
      expect(strDiff?.newValue).toBe(16);
    }
  });
});

describe('unsetKeys', () => {
  let mockRepo: CharacterRepo;

  beforeEach(() => {
    mockRepo = createMockRepo();
  });

  it('should unset existing keys', async () => {
    const character = createMockCharacter({
      str: AttrValue.num(16),
      dex: AttrValue.num(14),
      con: AttrValue.num(12),
    });

    vi.mocked(mockRepo.unsetAttributes).mockResolvedValueOnce(
      createMockCharacter({
        con: AttrValue.num(12),
      })
    );

    const result = await unsetKeys(character, 'str dex', mockRepo);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.removed).toContain('str');
      expect(result.removed).toContain('dex');
      expect(result.notFound).toHaveLength(0);
    }
  });

  it('should report not found keys', async () => {
    const character = createMockCharacter({
      str: AttrValue.num(16),
    });

    vi.mocked(mockRepo.unsetAttributes).mockResolvedValueOnce(
      createMockCharacter({})
    );

    const result = await unsetKeys(character, 'str nonexistent', mockRepo);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.removed).toContain('str');
      expect(result.notFound).toContain('nonexistent');
    }
  });

  it('should return error for empty keys string', async () => {
    const character = createMockCharacter({});

    const result = await unsetKeys(character, '   ', mockRepo);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('No keys');
    }
  });

  it('should handle all keys not found', async () => {
    const character = createMockCharacter({
      str: AttrValue.num(16),
    });

    const result = await unsetKeys(character, 'nonexistent1 nonexistent2', mockRepo);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.removed).toHaveLength(0);
      expect(result.notFound).toHaveLength(2);
      // unsetAttributes should not be called
      expect(mockRepo.unsetAttributes).not.toHaveBeenCalled();
    }
  });
});

describe('getAttributeValues', () => {
  it('should get values by keys', () => {
    const attrs: Record<string, AttributeValue> = {
      str: AttrValue.num(16),
      name: AttrValue.str('Gandalf'),
    };

    const { values } = getAttributeValues(attrs, { keys: ['str', 'name'] });

    expect(values['str']?.value).toBe('16');
    expect(values['name']?.value).toBe('"Gandalf"');
  });

  it('should show (unset) for missing keys', () => {
    const attrs: Record<string, AttributeValue> = {};

    const { values } = getAttributeValues(attrs, { keys: ['str'] });

    expect(values['str']?.value).toBe('(unset)');
  });

  it('should filter by prefix', () => {
    const attrs: Record<string, AttributeValue> = {
      'weapon.primary.name': AttrValue.str('Sword'),
      'weapon.primary.damage': AttrValue.str('1d8'),
      'weapon.secondary.name': AttrValue.str('Dagger'),
      'inv.sword.name': AttrValue.str('Magic Sword'),
    };

    const { values } = getAttributeValues(attrs, { prefix: 'weapon.primary' });

    expect(Object.keys(values)).toHaveLength(2);
    expect(values['weapon.primary.name']).toBeDefined();
    expect(values['weapon.primary.damage']).toBeDefined();
    expect(values['inv.sword.name']).toBeUndefined();
  });

  it('should include computed values when requested', () => {
    const attrs: Record<string, AttributeValue> = {
      level: AttrValue.num(5),
      str: AttrValue.num(16),
    };

    const { values } = getAttributeValues(attrs, {
      keys: ['level', 'computed.proficiency'],
      includeComputed: true,
    });

    expect(values['computed.proficiency']).toBeDefined();
    expect(values['computed.proficiency']?.value).toBe('+3');
    expect(values['computed.proficiency']?.isComputed).toBe(true);
  });

  it('should track hidden key count for unsupported keys', () => {
    const attrs: Record<string, AttributeValue> = {
      str: AttrValue.num(16),
      dex: AttrValue.num(14),
      'legacy_unsupported': AttrValue.str('old data'),
    };

    // Request specific keys including an unsupported one
    const { values, hiddenKeyCount } = getAttributeValues(attrs, {
      keys: ['str', 'dex', 'legacy_unsupported'],
    });

    // str and dex should be visible, legacy_unsupported should be hidden
    expect(values['str']).toBeDefined();
    expect(values['dex']).toBeDefined();
    expect(values['legacy_unsupported']).toBeUndefined();
    expect(hiddenKeyCount).toBe(1);
  });
});

describe('formatDiffEntry', () => {
  it('should format new value', () => {
    const entry = {
      key: 'str',
      newValue: 16,
      affectsComputed: true,
    };

    const formatted = formatDiffEntry(entry);
    expect(formatted).toContain('str');
    expect(formatted).toContain('16');
    expect(formatted).toContain('(new)');
  });

  it('should format old -> new', () => {
    const entry = {
      key: 'str',
      oldValue: 14,
      newValue: 16,
      affectsComputed: true,
    };

    const formatted = formatDiffEntry(entry);
    expect(formatted).toContain('str');
    expect(formatted).toContain('14');
    expect(formatted).toContain('->');
    expect(formatted).toContain('16');
  });

  it('should format unchanged value', () => {
    const entry = {
      key: 'str',
      oldValue: 16,
      newValue: 16,
      affectsComputed: true,
    };

    const formatted = formatDiffEntry(entry);
    expect(formatted).toContain('unchanged');
  });

  it('should quote string values', () => {
    const entry = {
      key: 'name',
      oldValue: 'Gandalf',
      newValue: 'Gandalf the Grey',
      affectsComputed: false,
    };

    const formatted = formatDiffEntry(entry);
    expect(formatted).toContain('"Gandalf"');
    expect(formatted).toContain('"Gandalf the Grey"');
  });
});
