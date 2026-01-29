/**
 * @discord-bot/state-machine
 *
 * A reusable state machine library with catalog-driven validation and effects.
 *
 * Features:
 * - Type-safe state and event definitions
 * - Human-readable state catalogs for validation and documentation
 * - Pure reducer + effects pattern
 * - Pluggable storage and effect execution
 * - Built-in testing utilities
 *
 * @example
 * ```typescript
 * import {
 *   createMachine,
 *   createEngine,
 *   type StateCatalog,
 *   type MachineDefinition,
 * } from '@discord-bot/state-machine';
 *
 * // Define your state and event types
 * type State = { type: 'Idle' } | { type: 'Running'; count: number };
 * type Event = { type: 'START' } | { type: 'INCREMENT' };
 *
 * // Create a catalog
 * const catalog: StateCatalog<Event> = {
 *   machineName: 'Counter',
 *   version: '1.0.0',
 *   states: {
 *     Idle: { summary: 'Waiting to start', allowedEvents: ['START'] },
 *     Running: { summary: 'Counter is running', allowedEvents: ['INCREMENT'] },
 *   },
 * };
 *
 * // Define the machine
 * const definition: MachineDefinition<State, Event> = {
 *   getStateKey: (state) => state.type,
 *   getInitialState: () => ({ type: 'Idle' }),
 *   reducer: (state, event) => {
 *     if (state.type === 'Idle' && event.type === 'START') {
 *       return { state: { type: 'Running', count: 0 } };
 *     }
 *     if (state.type === 'Running' && event.type === 'INCREMENT') {
 *       return { state: { type: 'Running', count: state.count + 1 } };
 *     }
 *     return { state };
 *   },
 *   effects: () => [],
 * };
 *
 * // Create machine and engine
 * const machine = createMachine(definition, catalog);
 * const engine = createEngine(machine, { storage, effectRunner, createContext });
 *
 * // Dispatch events
 * const result = await engine.dispatch('instance-1', { type: 'START' });
 * ```
 */

// Core types
export type {
  BaseState,
  BaseEvent,
  BaseContext,
  ReducerResult,
  GuardResult,
  Effect,
  CoreEffect,
  DispatchResult,
  StateMeta,
  StoredState,
  TransitionInfo,
  ErrorInfo,
} from './types.js';

// Catalog
export type {
  StateCatalog,
  StateDescriptor,
  TimeoutConfig,
  ViewConfig,
  TransitionEntry,
  CatalogValidationError,
  CatalogValidationResult,
} from './catalog.js';
export {
  validateCatalog,
  isEventAllowed,
  getStateDescriptor,
  getStateKeys,
  getAllEventTypes,
  getTerminalStates,
} from './catalog.js';

// Machine
export type {
  MachineDefinition,
  MachineConfig,
  Machine,
} from './machine.js';
export { createMachine, DEFAULT_MACHINE_CONFIG } from './machine.js';

// Storage
export type { StorageAdapter } from './storage.js';
export { InMemoryStorage } from './storage.js';

// Effects
export type { EffectRunner } from './effects.js';
export {
  log,
  persistNow,
  emitEvent,
  scheduleTimeout,
  cancelTimeout,
  isCoreEffect,
  filterEffects,
  getEmittedEvents,
  hasPersistNow,
} from './effects.js';

// Engine
export type { EngineHooks, EngineConfig } from './engine.js';
export { Engine, createEngine } from './engine.js';

// Documentation
export type {
  MarkdownOptions,
  MermaidOptions,
  StateSummary,
} from './docs.js';
export {
  generateMarkdown,
  generateMermaid,
  getStateSummaries,
} from './docs.js';

// Testing utilities
export type {
  RecordedEffect,
  TestHarnessOptions,
} from './testing.js';
export {
  TestEffectRunner,
  TestHarness,
  createTestHarness,
  createTestContextFactory,
  assertStateType,
  assertHasEffect,
  assertNoEffect,
  assertDispatchSuccess,
  assertDispatchFailure,
} from './testing.js';
