/**
 * Testing utilities for state machines.
 */

import type {
  BaseState,
  BaseEvent,
  BaseContext,
  Effect,
} from './types.js';
import type { EffectRunner } from './effects.js';

// ─────────────────────────────────────────────────────────────────────────────
// Test Effect Runner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recorded effect with metadata.
 */
export interface RecordedEffect<E extends BaseEvent, Custom extends { readonly type: string } = never> {
  instanceId: string;
  effect: Effect<E, Custom>;
  timestamp: string;
}

/**
 * Test effect runner that records all effects instead of executing them.
 */
export class TestEffectRunner<
  E extends BaseEvent = BaseEvent,
  C extends BaseContext = BaseContext,
  Custom extends { readonly type: string } = never
> implements EffectRunner<E, C, Custom> {
  private recorded: RecordedEffect<E, Custom>[] = [];

  async run(
    instanceId: string,
    effects: Effect<E, Custom>[],
    ctx: C
  ): Promise<void> {
    for (const effect of effects) {
      this.recorded.push({
        instanceId,
        effect,
        timestamp: ctx.timestamp,
      });
    }
  }

  /**
   * Get all recorded effects.
   */
  getRecorded(): RecordedEffect<E, Custom>[] {
    return [...this.recorded];
  }

  /**
   * Get recorded effects for a specific instance.
   */
  getRecordedForInstance(instanceId: string): RecordedEffect<E, Custom>[] {
    return this.recorded.filter((r) => r.instanceId === instanceId);
  }

  /**
   * Get recorded effects of a specific type.
   */
  getRecordedByType<T extends Effect<E, Custom>['type']>(
    type: T
  ): RecordedEffect<E, Custom>[] {
    return this.recorded.filter((r) => r.effect.type === type);
  }

  /**
   * Clear all recorded effects.
   */
  clear(): void {
    this.recorded = [];
  }

  /**
   * Get the number of recorded effects.
   */
  get count(): number {
    return this.recorded.length;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Context Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a test context factory with a fixed timestamp.
 */
export function createTestContextFactory<C extends BaseContext>(
  baseContext: Omit<C, 'instanceId' | 'timestamp'> = {} as Omit<C, 'instanceId' | 'timestamp'>,
  fixedTimestamp?: string
): (instanceId: string) => C {
  const timestamp = fixedTimestamp ?? new Date().toISOString();
  return (instanceId: string) => ({
    ...baseContext,
    instanceId,
    timestamp,
  } as C);
}

// ─────────────────────────────────────────────────────────────────────────────
// Assertion Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assert that a state has the expected type.
 */
export function assertStateType<S extends BaseState>(
  state: S,
  expectedType: S['type']
): void {
  if (state.type !== expectedType) {
    throw new Error(
      `Expected state type "${expectedType}" but got "${state.type}"`
    );
  }
}

/**
 * Assert that effects contain a specific effect type.
 */
export function assertHasEffect<E extends BaseEvent, Custom extends { readonly type: string } = never>(
  effects: Effect<E, Custom>[],
  type: string
): void {
  const found = effects.some((e) => e.type === type);
  if (!found) {
    const types = effects.map((e) => e.type).join(', ');
    throw new Error(
      `Expected effect of type "${type}" but found: [${types}]`
    );
  }
}

/**
 * Assert that effects do not contain a specific effect type.
 */
export function assertNoEffect<E extends BaseEvent, Custom extends { readonly type: string } = never>(
  effects: Effect<E, Custom>[],
  type: string
): void {
  const found = effects.some((e) => e.type === type);
  if (found) {
    throw new Error(
      `Expected no effect of type "${type}" but found one`
    );
  }
}

/**
 * Assert that a dispatch result was successful.
 */
export function assertDispatchSuccess(
  result: { success: boolean; errors?: string[] }
): void {
  if (!result.success) {
    const errorList = result.errors?.join(', ') ?? 'unknown error';
    throw new Error(`Dispatch failed: ${errorList}`);
  }
}

/**
 * Assert that a dispatch result failed.
 */
export function assertDispatchFailure(
  result: { success: boolean },
  expectedErrorSubstring?: string
): void {
  if (result.success) {
    throw new Error('Expected dispatch to fail but it succeeded');
  }
  if (expectedErrorSubstring) {
    const errors = (result as { errors?: string[] }).errors ?? [];
    const found = errors.some((e) => e.includes(expectedErrorSubstring));
    if (!found) {
      throw new Error(
        `Expected error containing "${expectedErrorSubstring}" but got: ${errors.join(', ')}`
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Harness
// ─────────────────────────────────────────────────────────────────────────────

import type { Machine } from './machine.js';
import { Engine, type EngineConfig } from './engine.js';
import { InMemoryStorage } from './storage.js';

/**
 * Options for creating a test harness.
 */
export interface TestHarnessOptions<C extends BaseContext> {
  /** Base context to use (without instanceId and timestamp) */
  baseContext?: Omit<C, 'instanceId' | 'timestamp'>;
  /** Fixed timestamp for deterministic tests */
  fixedTimestamp?: string;
}

/**
 * Test harness for a state machine.
 * Provides a fully configured engine with test doubles.
 */
export class TestHarness<
  S extends BaseState,
  E extends BaseEvent,
  C extends BaseContext = BaseContext,
  Custom extends { readonly type: string } = never
> {
  readonly engine: Engine<S, E, C, Custom>;
  readonly storage: InMemoryStorage<S>;
  readonly effectRunner: TestEffectRunner<E, C, Custom>;
  readonly transitions: { instanceId: string; prevStateKey: string; nextStateKey: string; eventType: string }[] = [];
  readonly errors: { instanceId: string; error: Error }[] = [];

  constructor(
    machine: Machine<S, E, C, Custom>,
    options: TestHarnessOptions<C> = {}
  ) {
    this.storage = new InMemoryStorage<S>();
    this.effectRunner = new TestEffectRunner<E, C, Custom>();

    const createContext = createTestContextFactory<C>(
      options.baseContext,
      options.fixedTimestamp
    );

    const config: EngineConfig<S, E, C, Custom> = {
      storage: this.storage,
      effectRunner: this.effectRunner,
      createContext,
      hooks: {
        onTransition: (info) => {
          this.transitions.push({
            instanceId: info.instanceId,
            prevStateKey: info.prevStateKey,
            nextStateKey: info.nextStateKey,
            eventType: info.eventType,
          });
        },
        onError: (info) => {
          this.errors.push({
            instanceId: info.instanceId,
            error: info.error,
          });
        },
      },
    };

    this.engine = new Engine(machine, config);
  }

  /**
   * Reset the harness state (clear storage, effects, transitions, errors).
   */
  reset(): void {
    this.storage.clear();
    this.effectRunner.clear();
    this.transitions.length = 0;
    this.errors.length = 0;
  }
}

/**
 * Create a test harness for a machine.
 */
export function createTestHarness<
  S extends BaseState,
  E extends BaseEvent,
  C extends BaseContext = BaseContext,
  Custom extends { readonly type: string } = never
>(
  machine: Machine<S, E, C, Custom>,
  options: TestHarnessOptions<C> = {}
): TestHarness<S, E, C, Custom> {
  return new TestHarness(machine, options);
}
