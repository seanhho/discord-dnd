/**
 * Effect system types and utilities.
 */

import type { BaseEvent, Effect, CoreEffect, BaseContext } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Effect Runner Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Interface for running effects.
 * Implement this to handle effects in your application.
 */
export interface EffectRunner<
  E extends BaseEvent = BaseEvent,
  C extends BaseContext = BaseContext,
  Custom extends { readonly type: string } = never
> {
  /**
   * Run a batch of effects.
   * @param instanceId - Machine instance ID
   * @param effects - Effects to run
   * @param ctx - Current context
   */
  run(instanceId: string, effects: Effect<E, Custom>[], ctx: C): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Effect Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a Log effect.
 */
export function log(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  data?: unknown
): CoreEffect {
  return { type: 'Log', level, message, data };
}

/**
 * Create a PersistNow effect.
 */
export function persistNow(): CoreEffect {
  return { type: 'PersistNow' };
}

/**
 * Create an EmitEvent effect.
 */
export function emitEvent<E extends BaseEvent>(event: E): CoreEffect<E> {
  return { type: 'EmitEvent', event };
}

/**
 * Create a ScheduleTimeout effect.
 */
export function scheduleTimeout<E extends BaseEvent>(
  timeoutId: string,
  seconds: number,
  event: E
): CoreEffect<E> {
  return { type: 'ScheduleTimeout', timeoutId, seconds, event };
}

/**
 * Create a CancelTimeout effect.
 */
export function cancelTimeout(timeoutId: string): CoreEffect {
  return { type: 'CancelTimeout', timeoutId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Effect Filtering
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if an effect is a core effect.
 */
export function isCoreEffect<E extends BaseEvent, Custom extends { readonly type: string } = never>(
  effect: Effect<E, Custom>
): effect is CoreEffect<E> {
  const coreTypes = ['Log', 'PersistNow', 'EmitEvent', 'ScheduleTimeout', 'CancelTimeout'];
  return coreTypes.includes(effect.type);
}

/**
 * Filter effects by type.
 */
export function filterEffects<
  E extends BaseEvent,
  Custom extends { readonly type: string } = never,
  T extends Effect<E, Custom>['type'] = Effect<E, Custom>['type']
>(
  effects: Effect<E, Custom>[],
  type: T
): Extract<Effect<E, Custom>, { type: T }>[] {
  return effects.filter((e) => e.type === type) as Extract<Effect<E, Custom>, { type: T }>[];
}

/**
 * Get all EmitEvent effects from a list.
 */
export function getEmittedEvents<E extends BaseEvent, Custom extends { readonly type: string } = never>(
  effects: Effect<E, Custom>[]
): E[] {
  return effects
    .filter((e): e is CoreEffect<E> & { type: 'EmitEvent' } => e.type === 'EmitEvent')
    .map((e) => e.event);
}

/**
 * Check if effects contain a PersistNow.
 */
export function hasPersistNow<E extends BaseEvent, Custom extends { readonly type: string } = never>(
  effects: Effect<E, Custom>[]
): boolean {
  return effects.some((e) => e.type === 'PersistNow');
}
