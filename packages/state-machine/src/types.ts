/**
 * Core types for the state machine library.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Base Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base interface for all states. States must have a 'type' tag for discrimination.
 */
export interface BaseState {
  readonly type: string;
}

/**
 * Base interface for all events. Events must have a 'type' tag for discrimination.
 */
export interface BaseEvent {
  readonly type: string;
}

/**
 * Context passed to reducers and effect functions.
 * Can be extended by applications for custom context (e.g., userId, guildId).
 */
export interface BaseContext {
  /** Unique identifier for this machine instance */
  readonly instanceId: string;
  /** Current timestamp (ISO 8601) */
  readonly timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reducer Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result of a reducer function.
 */
export interface ReducerResult<S extends BaseState, E extends BaseEvent> {
  /** The new state after applying the event */
  state: S;
  /** Optional events to emit (processed in order after this transition) */
  emitted?: E[];
}

/**
 * Guard result - either success or failure with reason.
 */
export type GuardResult =
  | { ok: true }
  | { ok: false; reason: string };

// ─────────────────────────────────────────────────────────────────────────────
// Effect Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Core effects provided by the library.
 */
export type CoreEffect<E extends BaseEvent = BaseEvent> =
  | { type: 'Log'; level: 'debug' | 'info' | 'warn' | 'error'; message: string; data?: unknown }
  | { type: 'PersistNow' }
  | { type: 'EmitEvent'; event: E }
  | { type: 'ScheduleTimeout'; timeoutId: string; seconds: number; event: E }
  | { type: 'CancelTimeout'; timeoutId: string };

/**
 * Effect type that combines core effects with app-specific effects.
 * Custom effects must have a `type` property for discrimination.
 */
export type Effect<E extends BaseEvent = BaseEvent, Custom extends { readonly type: string } = never> =
  | CoreEffect<E>
  | Custom;

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch Result
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result of dispatching an event to the engine.
 */
export interface DispatchResult<
  S extends BaseState,
  E extends BaseEvent,
  Custom extends { readonly type: string } = never
> {
  /** The final state after all transitions */
  state: S;
  /** All effects collected during the dispatch */
  effects: Effect<E, Custom>[];
  /** Warnings (e.g., loop limit approached) */
  warnings?: string[];
  /** Errors that occurred (if any) */
  errors?: string[];
  /** Whether the dispatch was successful */
  success: boolean;
  /** Number of transitions that occurred (including emitted events) */
  transitionCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Metadata stored alongside state.
 */
export interface StateMeta {
  /** Catalog version when this state was last updated */
  catalogVersion: string;
  /** ISO 8601 timestamp of last update */
  updatedAt: string;
  /** Optional state key for debugging */
  stateKey?: string;
}

/**
 * Stored state with metadata.
 */
export interface StoredState<S extends BaseState> {
  state: S;
  meta: StateMeta;
}

// ─────────────────────────────────────────────────────────────────────────────
// Observability Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Information about a state transition.
 */
export interface TransitionInfo {
  instanceId: string;
  prevStateKey: string;
  nextStateKey: string;
  eventType: string;
  effectsCount: number;
  timestamp: string;
}

/**
 * Information about an error.
 */
export interface ErrorInfo {
  instanceId: string;
  error: Error;
  eventType?: string;
  stateKey?: string;
  timestamp: string;
}
