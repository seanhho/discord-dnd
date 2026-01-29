/**
 * State machine engine - the runtime that executes machines.
 */

import type {
  BaseState,
  BaseEvent,
  BaseContext,
  Effect,
  DispatchResult,
  TransitionInfo,
  ErrorInfo,
  StateMeta,
} from './types.js';
import type { Machine } from './machine.js';
import type { StorageAdapter } from './storage.js';
import type { EffectRunner } from './effects.js';
import { isEventAllowed, getStateDescriptor } from './catalog.js';

// ─────────────────────────────────────────────────────────────────────────────
// Engine Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Observability hooks for the engine.
 */
export interface EngineHooks {
  /**
   * Called after each state transition.
   */
  onTransition?(info: TransitionInfo): void;

  /**
   * Called when an error occurs.
   */
  onError?(info: ErrorInfo): void;
}

/**
 * Engine configuration.
 */
export interface EngineConfig<
  S extends BaseState,
  E extends BaseEvent,
  C extends BaseContext,
  Custom extends { readonly type: string } = never
> {
  /** Storage adapter for persistence */
  storage: StorageAdapter<S>;
  /** Effect runner for executing effects */
  effectRunner: EffectRunner<E, C, Custom>;
  /** Observability hooks */
  hooks?: EngineHooks;
  /** Context factory - creates context for each dispatch */
  createContext: (instanceId: string) => C;
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * State machine engine.
 *
 * Handles:
 * - Loading/saving state
 * - Event validation against catalog
 * - Reducer execution
 * - Effect collection and execution
 * - Emitted event processing
 * - Loop protection
 * - Concurrency guards
 */
export class Engine<
  S extends BaseState,
  E extends BaseEvent,
  C extends BaseContext = BaseContext,
  Custom extends { readonly type: string } = never
> {
  private readonly machine: Machine<S, E, C, Custom>;
  private readonly storage: StorageAdapter<S>;
  private readonly effectRunner: EffectRunner<E, C, Custom>;
  private readonly hooks: EngineHooks;
  private readonly createContext: (instanceId: string) => C;

  /** In-memory locks to prevent concurrent dispatch on same instance */
  private readonly locks = new Set<string>();

  constructor(
    machine: Machine<S, E, C, Custom>,
    config: EngineConfig<S, E, C, Custom>
  ) {
    this.machine = machine;
    this.storage = config.storage;
    this.effectRunner = config.effectRunner;
    this.hooks = config.hooks ?? {};
    this.createContext = config.createContext;
  }

  /**
   * Dispatch an event to a machine instance.
   */
  async dispatch(instanceId: string, event: E): Promise<DispatchResult<S, E, Custom>> {
    const ctx = this.createContext(instanceId);
    const effects: Effect<E, Custom>[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    let transitionCount = 0;

    // Concurrency guard
    if (this.locks.has(instanceId)) {
      return {
        state: this.machine.definition.getInitialState(),
        effects: [],
        errors: ['Concurrent dispatch blocked - instance is already processing'],
        success: false,
        transitionCount: 0,
      };
    }

    this.locks.add(instanceId);

    try {
      // Load current state
      const stored = await this.storage.load(instanceId);
      let state: S = stored?.state ?? this.machine.definition.getInitialState();

      // Event queue for processing emitted events
      const eventQueue: E[] = [event];

      while (eventQueue.length > 0) {
        // Check loop limit
        if (transitionCount >= this.machine.config.maxTransitions) {
          const error = new Error(
            `Loop limit exceeded: ${transitionCount} transitions (max: ${this.machine.config.maxTransitions})`
          );
          this.hooks.onError?.({
            instanceId,
            error,
            eventType: event.type,
            stateKey: this.machine.definition.getStateKey(state),
            timestamp: ctx.timestamp,
          });
          errors.push(error.message);
          break;
        }

        // Warning threshold
        const warningThreshold = Math.floor(
          this.machine.config.maxTransitions * this.machine.config.loopWarningThreshold
        );
        if (transitionCount === warningThreshold) {
          warnings.push(
            `Approaching loop limit: ${transitionCount}/${this.machine.config.maxTransitions} transitions`
          );
        }

        const currentEvent = eventQueue.shift()!;
        const prevState = state;
        const prevStateKey = this.machine.definition.getStateKey(prevState);

        // Validate event against catalog
        if (this.machine.config.validateEvents) {
          if (!isEventAllowed(this.machine.catalog, prevStateKey, currentEvent.type)) {
            const descriptor = getStateDescriptor(this.machine.catalog, prevStateKey);
            const allowedList = descriptor?.allowedEvents.join(', ') ?? 'none';
            errors.push(
              `Event "${currentEvent.type}" not allowed in state "${prevStateKey}". Allowed: [${allowedList}]`
            );
            continue;
          }
        }

        // Run guard if present
        if (this.machine.definition.guard) {
          const guardResult = this.machine.definition.guard(currentEvent, state, ctx);
          if (!guardResult.ok) {
            errors.push(`Guard rejected event "${currentEvent.type}": ${guardResult.reason}`);
            continue;
          }
        }

        // Call onExit if state changes
        // (We'll know after reducer, but collect effects preemptively)

        // Run reducer
        const result = this.machine.definition.reducer(state, currentEvent, ctx);
        state = result.state;
        const nextStateKey = this.machine.definition.getStateKey(state);

        // Did state change?
        const stateChanged = prevStateKey !== nextStateKey;

        // Collect onExit effects
        if (stateChanged && this.machine.definition.onExit) {
          effects.push(...this.machine.definition.onExit(prevState, ctx));
        }

        // Collect transition effects
        effects.push(
          ...this.machine.definition.effects(prevState, state, currentEvent, ctx)
        );

        // Collect onEnter effects
        if (stateChanged && this.machine.definition.onEnter) {
          effects.push(...this.machine.definition.onEnter(state, ctx));
        }

        // Queue emitted events
        if (result.emitted && result.emitted.length > 0) {
          eventQueue.push(...result.emitted);
        }

        // Extract EmitEvent effects and queue them
        for (const effect of effects) {
          if (effect.type === 'EmitEvent' && 'event' in effect) {
            eventQueue.push(effect.event as E);
          }
        }

        transitionCount++;

        // Notify transition hook
        this.hooks.onTransition?.({
          instanceId,
          prevStateKey,
          nextStateKey,
          eventType: currentEvent.type,
          effectsCount: effects.length,
          timestamp: ctx.timestamp,
        });
      }

      // Persist state
      if (this.machine.config.autoPersist || effects.some((e) => e.type === 'PersistNow')) {
        const meta: StateMeta = {
          catalogVersion: this.machine.catalog.version,
          updatedAt: ctx.timestamp,
          stateKey: this.machine.definition.getStateKey(state),
        };
        await this.storage.save(instanceId, state, meta);
      }

      // Run effects (excluding EmitEvent which were processed inline)
      const effectsToRun = effects.filter((e) => e.type !== 'EmitEvent');
      if (effectsToRun.length > 0) {
        await this.effectRunner.run(instanceId, effectsToRun, ctx);
      }

      return {
        state,
        effects,
        warnings: warnings.length > 0 ? warnings : undefined,
        errors: errors.length > 0 ? errors : undefined,
        success: errors.length === 0,
        transitionCount,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.hooks.onError?.({
        instanceId,
        error: err,
        eventType: event.type,
        timestamp: ctx.timestamp,
      });
      return {
        state: this.machine.definition.getInitialState(),
        effects: [],
        errors: [err.message],
        success: false,
        transitionCount,
      };
    } finally {
      this.locks.delete(instanceId);
    }
  }

  /**
   * Get the current state of an instance without dispatching.
   */
  async getState(instanceId: string): Promise<S | null> {
    const stored = await this.storage.load(instanceId);
    return stored?.state ?? null;
  }

  /**
   * Initialize a new instance with the initial state.
   */
  async initialize(instanceId: string): Promise<S> {
    const ctx = this.createContext(instanceId);
    const state = this.machine.definition.getInitialState();
    const meta: StateMeta = {
      catalogVersion: this.machine.catalog.version,
      updatedAt: ctx.timestamp,
      stateKey: this.machine.definition.getStateKey(state),
    };
    await this.storage.save(instanceId, state, meta);

    // Run onEnter for initial state
    if (this.machine.definition.onEnter) {
      const effects = this.machine.definition.onEnter(state, ctx);
      if (effects.length > 0) {
        await this.effectRunner.run(instanceId, effects, ctx);
      }
    }

    return state;
  }

  /**
   * Delete an instance's state.
   */
  async delete(instanceId: string): Promise<void> {
    if (this.storage.delete) {
      await this.storage.delete(instanceId);
    }
  }

  /**
   * Get the machine's catalog.
   */
  getCatalog() {
    return this.machine.catalog;
  }

  /**
   * Get the machine's configuration.
   */
  getConfig() {
    return this.machine.config;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create an engine for a machine.
 */
export function createEngine<
  S extends BaseState,
  E extends BaseEvent,
  C extends BaseContext = BaseContext,
  Custom extends { readonly type: string } = never
>(
  machine: Machine<S, E, C, Custom>,
  config: EngineConfig<S, E, C, Custom>
): Engine<S, E, C, Custom> {
  return new Engine(machine, config);
}
