/**
 * Machine definition types.
 *
 * A machine definition specifies how states transition and what effects
 * are produced. It is pure and deterministic.
 */

import type {
  BaseState,
  BaseEvent,
  BaseContext,
  ReducerResult,
  GuardResult,
  Effect,
} from './types.js';
import type { StateCatalog } from './catalog.js';

// ─────────────────────────────────────────────────────────────────────────────
// Machine Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Complete machine definition.
 *
 * @typeParam S - State union type
 * @typeParam E - Event union type
 * @typeParam C - Context type (extends BaseContext)
 * @typeParam CustomEffect - App-specific effect type (optional)
 */
export interface MachineDefinition<
  S extends BaseState,
  E extends BaseEvent,
  C extends BaseContext = BaseContext,
  CustomEffect extends { readonly type: string } = never
> {
  /**
   * Map a runtime state to its catalog key.
   * This allows the catalog to use stable string keys while the runtime
   * uses typed state objects.
   */
  getStateKey(state: S): string;

  /**
   * Create the initial state for a new machine instance.
   */
  getInitialState(): S;

  /**
   * Pure reducer function.
   * Returns the new state and optionally emits events.
   */
  reducer(state: S, event: E, ctx: C): ReducerResult<S, E>;

  /**
   * Compute effects based on state transition.
   * This is pure - it returns declarative effects, not side effects.
   */
  effects(
    prevState: S,
    nextState: S,
    event: E,
    ctx: C
  ): Effect<E, CustomEffect>[];

  /**
   * Optional guard to validate if an event can be processed.
   * Called before the reducer. Return { ok: false, reason } to block.
   */
  guard?(event: E, state: S, ctx: C): GuardResult;

  /**
   * Optional hook called when entering a state.
   * Returns effects to run on entry.
   */
  onEnter?(state: S, ctx: C): Effect<E, CustomEffect>[];

  /**
   * Optional hook called when exiting a state.
   * Returns effects to run on exit.
   */
  onExit?(state: S, ctx: C): Effect<E, CustomEffect>[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Machine Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for machine execution.
 */
export interface MachineConfig {
  /**
   * Maximum number of transitions per dispatch (including emitted events).
   * Prevents infinite loops.
   * @default 100
   */
  maxTransitions?: number;

  /**
   * Whether to validate events against the catalog.
   * @default true
   */
  validateEvents?: boolean;

  /**
   * Whether to automatically persist state after each dispatch.
   * @default true
   */
  autoPersist?: boolean;

  /**
   * Warning threshold for transition count (percentage of max).
   * Issues a warning when reached.
   * @default 0.8
   */
  loopWarningThreshold?: number;
}

/**
 * Default machine configuration.
 */
export const DEFAULT_MACHINE_CONFIG: Required<MachineConfig> = {
  maxTransitions: 100,
  validateEvents: true,
  autoPersist: true,
  loopWarningThreshold: 0.8,
};

// ─────────────────────────────────────────────────────────────────────────────
// Machine Instance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A configured machine ready for execution.
 */
export interface Machine<
  S extends BaseState,
  E extends BaseEvent,
  C extends BaseContext = BaseContext,
  CustomEffect extends { readonly type: string } = never
> {
  /** Machine definition */
  definition: MachineDefinition<S, E, C, CustomEffect>;
  /** State catalog */
  catalog: StateCatalog<E>;
  /** Configuration */
  config: Required<MachineConfig>;
}

/**
 * Create a machine from definition and catalog.
 */
export function createMachine<
  S extends BaseState,
  E extends BaseEvent,
  C extends BaseContext = BaseContext,
  CustomEffect extends { readonly type: string } = never
>(
  definition: MachineDefinition<S, E, C, CustomEffect>,
  catalog: StateCatalog<E>,
  config: MachineConfig = {}
): Machine<S, E, C, CustomEffect> {
  return {
    definition,
    catalog,
    config: { ...DEFAULT_MACHINE_CONFIG, ...config },
  };
}
