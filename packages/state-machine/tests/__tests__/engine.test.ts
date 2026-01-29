/**
 * Engine tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMachine,
  createTestHarness,
  type StateCatalog,
  type MachineDefinition,
  type BaseState,
  type BaseEvent,
  type BaseContext,
  type Effect,
} from '../../src/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Test Types
// ─────────────────────────────────────────────────────────────────────────────

type TestState =
  | { type: 'Idle' }
  | { type: 'Running'; count: number }
  | { type: 'Done' };

type TestEvent =
  | { type: 'START' }
  | { type: 'INCREMENT' }
  | { type: 'STOP' }
  | { type: 'INVALID' }
  | { type: 'EMIT_LOOP' }
  | { type: 'GUARDED'; value: number };

interface TestContext extends BaseContext {
  testValue: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Catalog and Machine
// ─────────────────────────────────────────────────────────────────────────────

const testCatalog: StateCatalog<TestEvent> = {
  machineName: 'TestMachine',
  version: '1.0.0',
  states: {
    Idle: {
      summary: 'Waiting',
      allowedEvents: ['START'],
    },
    Running: {
      summary: 'Running',
      allowedEvents: ['INCREMENT', 'STOP', 'EMIT_LOOP', 'GUARDED'],
    },
    Done: {
      summary: 'Done',
      allowedEvents: [],
      terminal: true,
    },
  },
};

const testDefinition: MachineDefinition<TestState, TestEvent, TestContext> = {
  getStateKey: (state) => state.type,
  getInitialState: () => ({ type: 'Idle' }),

  reducer: (state, event) => {
    if (state.type === 'Idle' && event.type === 'START') {
      return { state: { type: 'Running', count: 0 } };
    }
    if (state.type === 'Running') {
      if (event.type === 'INCREMENT') {
        return { state: { type: 'Running', count: state.count + 1 } };
      }
      if (event.type === 'STOP') {
        return { state: { type: 'Done' } };
      }
      if (event.type === 'EMIT_LOOP') {
        // Emit another EMIT_LOOP to create a potential infinite loop
        return {
          state: { type: 'Running', count: state.count + 1 },
          emitted: [{ type: 'EMIT_LOOP' }],
        };
      }
      if (event.type === 'GUARDED') {
        return { state: { type: 'Running', count: event.value } };
      }
    }
    return { state };
  },

  effects: (prevState, nextState, event) => {
    const effects: Effect<TestEvent>[] = [];
    if (event.type === 'START') {
      effects.push({ type: 'Log', level: 'info', message: 'Started' });
    }
    if (event.type === 'STOP') {
      effects.push({ type: 'Log', level: 'info', message: 'Stopped' });
    }
    return effects;
  },

  guard: (event) => {
    if (event.type === 'GUARDED' && event.value < 0) {
      return { ok: false, reason: 'Value must be non-negative' };
    }
    return { ok: true };
  },

  onEnter: (state) => {
    if (state.type === 'Running') {
      return [{ type: 'Log', level: 'debug', message: 'Entered Running' }];
    }
    return [];
  },

  onExit: (state) => {
    if (state.type === 'Running') {
      return [{ type: 'Log', level: 'debug', message: 'Exited Running' }];
    }
    return [];
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Engine', () => {
  describe('basic transitions', () => {
    it('should initialize with initial state', async () => {
      const machine = createMachine(testDefinition, testCatalog);
      const harness = createTestHarness<TestState, TestEvent, TestContext>(machine, {
        baseContext: { testValue: 'test' },
      });

      const state = await harness.engine.initialize('test-1');

      expect(state.type).toBe('Idle');
      expect(harness.storage.size).toBe(1);
    });

    it('should dispatch events and transition states', async () => {
      const machine = createMachine(testDefinition, testCatalog);
      const harness = createTestHarness<TestState, TestEvent, TestContext>(machine, {
        baseContext: { testValue: 'test' },
      });

      await harness.engine.initialize('test-1');

      const result = await harness.engine.dispatch('test-1', { type: 'START' });

      expect(result.success).toBe(true);
      expect(result.state.type).toBe('Running');
      expect(result.transitionCount).toBe(1);
    });

    it('should track transition history', async () => {
      const machine = createMachine(testDefinition, testCatalog);
      const harness = createTestHarness<TestState, TestEvent, TestContext>(machine, {
        baseContext: { testValue: 'test' },
      });

      await harness.engine.initialize('test-1');
      await harness.engine.dispatch('test-1', { type: 'START' });

      expect(harness.transitions).toHaveLength(1);
      expect(harness.transitions[0]).toEqual({
        instanceId: 'test-1',
        prevStateKey: 'Idle',
        nextStateKey: 'Running',
        eventType: 'START',
      });
    });
  });

  describe('event validation', () => {
    it('should block invalid events based on catalog', async () => {
      const machine = createMachine(testDefinition, testCatalog);
      const harness = createTestHarness<TestState, TestEvent, TestContext>(machine, {
        baseContext: { testValue: 'test' },
      });

      await harness.engine.initialize('test-1');

      // Try INCREMENT in Idle state (not allowed)
      const result = await harness.engine.dispatch('test-1', { type: 'INCREMENT' });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('INCREMENT');
      expect(result.errors![0]).toContain('not allowed');
    });

    it('should allow valid events based on catalog', async () => {
      const machine = createMachine(testDefinition, testCatalog);
      const harness = createTestHarness<TestState, TestEvent, TestContext>(machine, {
        baseContext: { testValue: 'test' },
      });

      await harness.engine.initialize('test-1');
      await harness.engine.dispatch('test-1', { type: 'START' });

      const result = await harness.engine.dispatch('test-1', { type: 'INCREMENT' });

      expect(result.success).toBe(true);
      expect((result.state as { count: number }).count).toBe(1);
    });

    it('should skip validation when configured', async () => {
      const machine = createMachine(testDefinition, testCatalog, { validateEvents: false });
      const harness = createTestHarness<TestState, TestEvent, TestContext>(machine, {
        baseContext: { testValue: 'test' },
      });

      await harness.engine.initialize('test-1');

      // INCREMENT in Idle - would normally be blocked
      const result = await harness.engine.dispatch('test-1', { type: 'INCREMENT' });

      // No error, but no transition either (reducer doesn't handle it)
      expect(result.success).toBe(true);
      expect(result.state.type).toBe('Idle');
    });
  });

  describe('guards', () => {
    it('should block events that fail guards', async () => {
      const machine = createMachine(testDefinition, testCatalog);
      const harness = createTestHarness<TestState, TestEvent, TestContext>(machine, {
        baseContext: { testValue: 'test' },
      });

      await harness.engine.initialize('test-1');
      await harness.engine.dispatch('test-1', { type: 'START' });

      const result = await harness.engine.dispatch('test-1', {
        type: 'GUARDED',
        value: -5,
      });

      expect(result.success).toBe(false);
      expect(result.errors![0]).toContain('Guard rejected');
      expect(result.errors![0]).toContain('non-negative');
    });

    it('should allow events that pass guards', async () => {
      const machine = createMachine(testDefinition, testCatalog);
      const harness = createTestHarness<TestState, TestEvent, TestContext>(machine, {
        baseContext: { testValue: 'test' },
      });

      await harness.engine.initialize('test-1');
      await harness.engine.dispatch('test-1', { type: 'START' });

      const result = await harness.engine.dispatch('test-1', {
        type: 'GUARDED',
        value: 42,
      });

      expect(result.success).toBe(true);
      expect((result.state as { count: number }).count).toBe(42);
    });
  });

  describe('emitted events', () => {
    it('should process emitted events in order', async () => {
      const machine = createMachine(testDefinition, testCatalog, { maxTransitions: 5 });
      const harness = createTestHarness<TestState, TestEvent, TestContext>(machine, {
        baseContext: { testValue: 'test' },
      });

      await harness.engine.initialize('test-1');
      await harness.engine.dispatch('test-1', { type: 'START' });

      // EMIT_LOOP will emit another EMIT_LOOP
      const result = await harness.engine.dispatch('test-1', { type: 'EMIT_LOOP' });

      // Should hit loop limit
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('Loop limit exceeded');
    });

    it('should stop at loop limit and report error', async () => {
      const machine = createMachine(testDefinition, testCatalog, { maxTransitions: 10 });
      const harness = createTestHarness<TestState, TestEvent, TestContext>(machine, {
        baseContext: { testValue: 'test' },
      });

      await harness.engine.initialize('test-1');
      await harness.engine.dispatch('test-1', { type: 'START' });

      const result = await harness.engine.dispatch('test-1', { type: 'EMIT_LOOP' });

      expect(result.transitionCount).toBe(10);
      expect(result.errors).toContain('Loop limit exceeded: 10 transitions (max: 10)');
    });

    it('should warn when approaching loop limit', async () => {
      const machine = createMachine(testDefinition, testCatalog, {
        maxTransitions: 10,
        loopWarningThreshold: 0.5,
      });
      const harness = createTestHarness<TestState, TestEvent, TestContext>(machine, {
        baseContext: { testValue: 'test' },
      });

      await harness.engine.initialize('test-1');
      await harness.engine.dispatch('test-1', { type: 'START' });

      const result = await harness.engine.dispatch('test-1', { type: 'EMIT_LOOP' });

      expect(result.warnings).toBeDefined();
      expect(result.warnings![0]).toContain('Approaching loop limit');
    });
  });

  describe('effects', () => {
    it('should collect effects from transitions', async () => {
      const machine = createMachine(testDefinition, testCatalog);
      const harness = createTestHarness<TestState, TestEvent, TestContext>(machine, {
        baseContext: { testValue: 'test' },
      });

      await harness.engine.initialize('test-1');

      const result = await harness.engine.dispatch('test-1', { type: 'START' });

      expect(result.effects.length).toBeGreaterThan(0);
      const logEffects = result.effects.filter((e) => e.type === 'Log');
      expect(logEffects.some((e) => (e as { message: string }).message === 'Started')).toBe(true);
    });

    it('should collect onEnter/onExit effects', async () => {
      const machine = createMachine(testDefinition, testCatalog);
      const harness = createTestHarness<TestState, TestEvent, TestContext>(machine, {
        baseContext: { testValue: 'test' },
      });

      await harness.engine.initialize('test-1');
      await harness.engine.dispatch('test-1', { type: 'START' });

      const result = await harness.engine.dispatch('test-1', { type: 'STOP' });

      const logEffects = result.effects.filter((e) => e.type === 'Log') as Array<{
        type: 'Log';
        message: string;
      }>;
      expect(logEffects.some((e) => e.message === 'Exited Running')).toBe(true);
    });

    it('should pass effects to effect runner', async () => {
      const machine = createMachine(testDefinition, testCatalog);
      const harness = createTestHarness<TestState, TestEvent, TestContext>(machine, {
        baseContext: { testValue: 'test' },
      });

      await harness.engine.initialize('test-1');
      await harness.engine.dispatch('test-1', { type: 'START' });

      const recorded = harness.effectRunner.getRecordedForInstance('test-1');
      expect(recorded.length).toBeGreaterThan(0);
    });
  });

  describe('storage', () => {
    it('should persist state after dispatch', async () => {
      const machine = createMachine(testDefinition, testCatalog);
      const harness = createTestHarness<TestState, TestEvent, TestContext>(machine, {
        baseContext: { testValue: 'test' },
      });

      await harness.engine.initialize('test-1');
      await harness.engine.dispatch('test-1', { type: 'START' });

      const stored = await harness.storage.load('test-1');
      expect(stored).not.toBeNull();
      expect(stored!.state.type).toBe('Running');
      expect(stored!.meta.stateKey).toBe('Running');
      expect(stored!.meta.catalogVersion).toBe('1.0.0');
    });

    it('should load existing state on dispatch', async () => {
      const machine = createMachine(testDefinition, testCatalog);
      const harness = createTestHarness<TestState, TestEvent, TestContext>(machine, {
        baseContext: { testValue: 'test' },
      });

      await harness.engine.initialize('test-1');
      await harness.engine.dispatch('test-1', { type: 'START' });
      await harness.engine.dispatch('test-1', { type: 'INCREMENT' });
      await harness.engine.dispatch('test-1', { type: 'INCREMENT' });

      const state = await harness.engine.getState('test-1');
      expect((state as { count: number }).count).toBe(2);
    });

    it('should delete state', async () => {
      const machine = createMachine(testDefinition, testCatalog);
      const harness = createTestHarness<TestState, TestEvent, TestContext>(machine, {
        baseContext: { testValue: 'test' },
      });

      await harness.engine.initialize('test-1');
      await harness.engine.delete('test-1');

      const state = await harness.engine.getState('test-1');
      expect(state).toBeNull();
    });
  });

  describe('concurrency', () => {
    it('should block concurrent dispatch on same instance', async () => {
      const machine = createMachine(testDefinition, testCatalog);
      const harness = createTestHarness<TestState, TestEvent, TestContext>(machine, {
        baseContext: { testValue: 'test' },
      });

      await harness.engine.initialize('test-1');

      // Start two dispatches simultaneously
      const [result1, result2] = await Promise.all([
        harness.engine.dispatch('test-1', { type: 'START' }),
        harness.engine.dispatch('test-1', { type: 'START' }),
      ]);

      // One should succeed, one should fail
      const successes = [result1, result2].filter((r) => r.success);
      const failures = [result1, result2].filter((r) => !r.success);

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      expect(failures[0].errors![0]).toContain('Concurrent dispatch blocked');
    });

    it('should allow dispatch on different instances', async () => {
      const machine = createMachine(testDefinition, testCatalog);
      const harness = createTestHarness<TestState, TestEvent, TestContext>(machine, {
        baseContext: { testValue: 'test' },
      });

      await harness.engine.initialize('test-1');
      await harness.engine.initialize('test-2');

      const [result1, result2] = await Promise.all([
        harness.engine.dispatch('test-1', { type: 'START' }),
        harness.engine.dispatch('test-2', { type: 'START' }),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });
});
