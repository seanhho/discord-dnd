/**
 * Tests for Character Setup Wizard
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMachine,
  createTestHarness,
} from '@discord-bot/state-machine';
import { wizardMachineDefinition } from '../setup/machine.js';
import { wizardCatalog } from '../setup/catalog.js';
import type { WizardState, WizardEvent, WizardContext } from '../setup/types.js';
import { validateDraft, buildPatchObject } from '../setup/service.js';
import { parseAbilitiesInput } from '../setup/views.js';

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

function createContext(instanceId: string): WizardContext {
  return {
    instanceId,
    timestamp: new Date().toISOString(),
  };
}

function startEvent(
  discordUserId = 'user123',
  characterName = 'TestChar'
): WizardEvent {
  return {
    type: 'START',
    discordUserId,
    channelId: 'channel123',
    guildId: 'guild123',
    characterName,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reducer Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Wizard Reducer', () => {
  const { reducer, getInitialState } = wizardMachineDefinition;
  const ctx = createContext('test-instance');

  describe('Idle -> Identity', () => {
    it('should transition to Identity on START', () => {
      const state = getInitialState();
      const result = reducer(state, startEvent(), ctx);

      expect(result.state.type).toBe('Identity');
      if (result.state.type === 'Identity') {
        expect(result.state.discordUserId).toBe('user123');
        expect(result.state.characterName).toBe('TestChar');
        expect(result.state.draft.name).toBe('TestChar');
      }
    });
  });

  describe('Identity step', () => {
    let identityState: WizardState;

    beforeEach(() => {
      const initial = getInitialState();
      const result = reducer(initial, startEvent(), ctx);
      identityState = result.state;
    });

    it('should update draft on SET_IDENTITY', () => {
      const result = reducer(
        identityState,
        {
          type: 'SET_IDENTITY',
          name: 'Gandalf',
          class: 'Wizard',
          level: 20,
          race: 'Maia',
          background: 'Sage',
        },
        ctx
      );

      expect(result.state.type).toBe('Identity');
      if (result.state.type === 'Identity') {
        expect(result.state.draft.name).toBe('Gandalf');
        expect(result.state.draft.class).toBe('Wizard');
        expect(result.state.draft.level).toBe(20);
        expect(result.state.draft.race).toBe('Maia');
        expect(result.state.draft.background).toBe('Sage');
      }
    });

    it('should transition to Abilities on NEXT when valid', () => {
      // First set required fields
      let state = reducer(
        identityState,
        { type: 'SET_IDENTITY', name: 'Test', class: 'Fighter', level: 1 },
        ctx
      ).state;

      // Then next
      const result = reducer(state, { type: 'NEXT' }, ctx);
      expect(result.state.type).toBe('Abilities');
    });

    it('should stay on Identity on NEXT when invalid', () => {
      // Try to advance without required fields
      const result = reducer(identityState, { type: 'NEXT' }, ctx);
      expect(result.state.type).toBe('Identity');
    });

    it('should transition to Cancelled on CANCEL', () => {
      const result = reducer(identityState, { type: 'CANCEL' }, ctx);
      expect(result.state.type).toBe('Cancelled');
    });

    it('should transition to Expired on TIMEOUT', () => {
      const result = reducer(identityState, { type: 'TIMEOUT' }, ctx);
      expect(result.state.type).toBe('Expired');
    });
  });

  describe('Abilities step', () => {
    let abilitiesState: WizardState;

    beforeEach(() => {
      let state = getInitialState();
      state = reducer(state, startEvent(), ctx).state;
      state = reducer(
        state,
        { type: 'SET_IDENTITY', name: 'Test', class: 'Fighter', level: 1 },
        ctx
      ).state;
      state = reducer(state, { type: 'NEXT' }, ctx).state;
      abilitiesState = state;
    });

    it('should be in Abilities state', () => {
      expect(abilitiesState.type).toBe('Abilities');
    });

    it('should update abilities on SET_ABILITIES', () => {
      const result = reducer(
        abilitiesState,
        {
          type: 'SET_ABILITIES',
          abilities: { str: 16, dex: 14, con: 12, int: 10, wis: 13, cha: 8 },
        },
        ctx
      );

      expect(result.state.type).toBe('Abilities');
      if (result.state.type === 'Abilities') {
        expect(result.state.draft.abilities?.str).toBe(16);
        expect(result.state.draft.abilities?.dex).toBe(14);
      }
    });

    it('should transition to Review on NEXT', () => {
      const result = reducer(abilitiesState, { type: 'NEXT' }, ctx);
      expect(result.state.type).toBe('Review');
    });

    it('should transition back to Identity on BACK', () => {
      const result = reducer(abilitiesState, { type: 'BACK' }, ctx);
      expect(result.state.type).toBe('Identity');
    });
  });

  describe('Review step', () => {
    let reviewState: WizardState;

    beforeEach(() => {
      let state = getInitialState();
      state = reducer(state, startEvent(), ctx).state;
      state = reducer(
        state,
        { type: 'SET_IDENTITY', name: 'Test', class: 'Fighter', level: 1 },
        ctx
      ).state;
      state = reducer(state, { type: 'NEXT' }, ctx).state;
      state = reducer(state, { type: 'NEXT' }, ctx).state;
      reviewState = state;
    });

    it('should be in Review state', () => {
      expect(reviewState.type).toBe('Review');
    });

    it('should transition to Committing on CONFIRM', () => {
      const result = reducer(reviewState, { type: 'CONFIRM' }, ctx);
      expect(result.state.type).toBe('Committing');
    });

    it('should transition back to Abilities on BACK', () => {
      const result = reducer(reviewState, { type: 'BACK' }, ctx);
      expect(result.state.type).toBe('Abilities');
    });
  });

  describe('Committing step', () => {
    let committingState: WizardState;

    beforeEach(() => {
      let state = getInitialState();
      state = reducer(state, startEvent(), ctx).state;
      state = reducer(
        state,
        { type: 'SET_IDENTITY', name: 'Test', class: 'Fighter', level: 1 },
        ctx
      ).state;
      state = reducer(state, { type: 'NEXT' }, ctx).state;
      state = reducer(state, { type: 'NEXT' }, ctx).state;
      state = reducer(state, { type: 'CONFIRM' }, ctx).state;
      committingState = state;
    });

    it('should be in Committing state', () => {
      expect(committingState.type).toBe('Committing');
    });

    it('should transition to Done on COMMIT_SUCCESS', () => {
      const result = reducer(
        committingState,
        { type: 'COMMIT_SUCCESS', characterId: 'char-456' },
        ctx
      );

      expect(result.state.type).toBe('Done');
      if (result.state.type === 'Done') {
        expect(result.state.characterId).toBe('char-456');
      }
    });

    it('should transition to Error on COMMIT_ERROR', () => {
      const result = reducer(
        committingState,
        { type: 'COMMIT_ERROR', error: 'Database error' },
        ctx
      );

      expect(result.state.type).toBe('Error');
      if (result.state.type === 'Error') {
        expect(result.state.error).toBe('Database error');
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('validateDraft', () => {
  it('should pass for valid draft', () => {
    const draft = {
      name: 'Gandalf',
      class: 'Wizard',
      level: 20,
    };
    expect(validateDraft(draft)).toBeUndefined();
  });

  it('should fail for missing name', () => {
    const draft = { class: 'Wizard', level: 1 };
    expect(validateDraft(draft)).toContain('name');
  });

  it('should fail for missing class', () => {
    const draft = { name: 'Test', level: 1 };
    expect(validateDraft(draft)).toContain('class');
  });

  it('should fail for missing level', () => {
    const draft = { name: 'Test', class: 'Fighter' };
    expect(validateDraft(draft)).toContain('level');
  });

  it('should fail for level out of range', () => {
    expect(validateDraft({ name: 'Test', class: 'Fighter', level: 0 })).toContain(
      'between 1 and 20'
    );
    expect(validateDraft({ name: 'Test', class: 'Fighter', level: 21 })).toContain(
      'between 1 and 20'
    );
  });

  it('should fail for ability score out of range', () => {
    const draft = {
      name: 'Test',
      class: 'Fighter',
      level: 1,
      abilities: { str: 0 },
    };
    expect(validateDraft(draft)).toContain('between 1 and 30');
  });

  it('should pass with valid abilities', () => {
    const draft = {
      name: 'Test',
      class: 'Fighter',
      level: 1,
      abilities: { str: 16, dex: 14, con: 12, int: 10, wis: 13, cha: 8 },
    };
    expect(validateDraft(draft)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Patch Building Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('buildPatchObject', () => {
  it('should build patch from draft', () => {
    const draft = {
      name: 'Gandalf',
      class: 'Wizard',
      level: 20,
      race: 'Human',
      abilities: { str: 10, int: 20 },
    };

    const patch = buildPatchObject(draft);

    expect(patch['name']).toEqual({ t: 's', v: 'Gandalf' });
    expect(patch['class']).toEqual({ t: 's', v: 'Wizard' });
    expect(patch['level']).toEqual({ t: 'n', v: 20 });
    expect(patch['race']).toEqual({ t: 's', v: 'Human' });
    expect(patch['str']).toEqual({ t: 'n', v: 10 });
    expect(patch['int']).toEqual({ t: 'n', v: 20 });
  });

  it('should skip undefined fields', () => {
    const draft = {
      name: 'Test',
      class: 'Fighter',
      level: 1,
    };

    const patch = buildPatchObject(draft);

    expect(patch['name']).toBeDefined();
    expect(patch['class']).toBeDefined();
    expect(patch['level']).toBeDefined();
    expect(patch['race']).toBeUndefined();
    expect(patch['str']).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Abilities Input Parsing Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('parseAbilitiesInput', () => {
  it('should parse valid input', () => {
    const input = `STR: 16
DEX: 14
CON: 12
INT: 10
WIS: 13
CHA: 8`;

    const result = parseAbilitiesInput(input);

    expect(result.str).toBe(16);
    expect(result.dex).toBe(14);
    expect(result.con).toBe(12);
    expect(result.int).toBe(10);
    expect(result.wis).toBe(13);
    expect(result.cha).toBe(8);
  });

  it('should be case-insensitive', () => {
    const input = `str: 16
Dex: 14`;

    const result = parseAbilitiesInput(input);

    expect(result.str).toBe(16);
    expect(result.dex).toBe(14);
  });

  it('should skip invalid lines', () => {
    const input = `STR: 16
invalid line
DEX: abc
CON: 12`;

    const result = parseAbilitiesInput(input);

    expect(result.str).toBe(16);
    expect(result.con).toBe(12);
    expect(result.dex).toBeUndefined();
  });

  it('should skip out-of-range values', () => {
    const input = `STR: 0
DEX: 31
CON: 15`;

    const result = parseAbilitiesInput(input);

    expect(result.str).toBeUndefined();
    expect(result.dex).toBeUndefined();
    expect(result.con).toBe(15);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Full Flow Test with Harness
// ─────────────────────────────────────────────────────────────────────────────

describe('Wizard Full Flow', () => {
  it('should complete full wizard flow', async () => {
    const machine = createMachine(wizardMachineDefinition, wizardCatalog);
    const harness = createTestHarness(machine);

    // Start wizard
    const r1 = await harness.engine.dispatch('test', startEvent('user1', 'MyChar'));
    expect(r1.success).toBe(true);
    expect(r1.state.type).toBe('Identity');

    // Set identity
    const r2 = await harness.engine.dispatch('test', {
      type: 'SET_IDENTITY',
      name: 'Gandalf',
      class: 'Wizard',
      level: 20,
    });
    expect(r2.success).toBe(true);

    // Next to abilities
    const r3 = await harness.engine.dispatch('test', { type: 'NEXT' });
    expect(r3.success).toBe(true);
    expect(r3.state.type).toBe('Abilities');

    // Set abilities
    const r4 = await harness.engine.dispatch('test', {
      type: 'SET_ABILITIES',
      abilities: { str: 10, dex: 14, con: 14, int: 20, wis: 18, cha: 16 },
    });
    expect(r4.success).toBe(true);

    // Next to review
    const r5 = await harness.engine.dispatch('test', { type: 'NEXT' });
    expect(r5.success).toBe(true);
    expect(r5.state.type).toBe('Review');

    // Confirm
    const r6 = await harness.engine.dispatch('test', { type: 'CONFIRM' });
    expect(r6.success).toBe(true);
    expect(r6.state.type).toBe('Committing');

    // Commit success
    const r7 = await harness.engine.dispatch('test', {
      type: 'COMMIT_SUCCESS',
      characterId: 'char-123',
    });
    expect(r7.success).toBe(true);
    expect(r7.state.type).toBe('Done');
    if (r7.state.type === 'Done') {
      expect(r7.state.characterId).toBe('char-123');
      expect(r7.state.draft.name).toBe('Gandalf');
    }
  });

  it('should handle cancel at any active step', async () => {
    const machine = createMachine(wizardMachineDefinition, wizardCatalog);
    const harness = createTestHarness(machine);

    // Start wizard
    await harness.engine.dispatch('test', startEvent());

    // Cancel
    const result = await harness.engine.dispatch('test', { type: 'CANCEL' });
    expect(result.success).toBe(true);
    expect(result.state.type).toBe('Cancelled');
  });

  it('should handle timeout', async () => {
    const machine = createMachine(wizardMachineDefinition, wizardCatalog);
    const harness = createTestHarness(machine);

    // Start wizard
    await harness.engine.dispatch('test', startEvent());

    // Timeout
    const result = await harness.engine.dispatch('test', { type: 'TIMEOUT' });
    expect(result.success).toBe(true);
    expect(result.state.type).toBe('Expired');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Catalog Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Wizard Catalog', () => {
  it('should have all required states', () => {
    const stateKeys = Object.keys(wizardCatalog.states);
    expect(stateKeys).toContain('Idle');
    expect(stateKeys).toContain('Identity');
    expect(stateKeys).toContain('Abilities');
    expect(stateKeys).toContain('Review');
    expect(stateKeys).toContain('Committing');
    expect(stateKeys).toContain('Done');
    expect(stateKeys).toContain('Cancelled');
    expect(stateKeys).toContain('Expired');
    expect(stateKeys).toContain('Error');
  });

  it('should have terminal states marked', () => {
    expect(wizardCatalog.states['Done']?.terminal).toBe(true);
    expect(wizardCatalog.states['Cancelled']?.terminal).toBe(true);
    expect(wizardCatalog.states['Expired']?.terminal).toBe(true);
    expect(wizardCatalog.states['Error']?.terminal).toBe(true);
  });

  it('should have view configs for active states', () => {
    expect(wizardCatalog.states['Identity']?.view).toBeDefined();
    expect(wizardCatalog.states['Abilities']?.view).toBeDefined();
    expect(wizardCatalog.states['Review']?.view).toBeDefined();
  });
});
