/**
 * State catalog types and utilities.
 *
 * A catalog defines the metadata for each state in a machine, including
 * allowed events, timeouts, and view hints. It serves as both documentation
 * and runtime validation.
 */

import type { BaseEvent } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Catalog Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Timeout configuration for a state.
 */
export interface TimeoutConfig<E extends BaseEvent> {
  /** Timeout duration in seconds */
  seconds: number;
  /** Event to dispatch when timeout expires */
  onTimeoutEvent: E;
}

/**
 * View/prompt metadata for UI rendering.
 */
export interface ViewConfig {
  /** Template identifier for rendering */
  templateId: string;
  /** Optional title for the view */
  title?: string;
  /** Optional description */
  description?: string;
}

/**
 * Descriptor for a single state in the catalog.
 */
export interface StateDescriptor<E extends BaseEvent = BaseEvent> {
  /** Human-readable summary of this state */
  summary: string;
  /** Detailed description (optional) */
  description?: string;
  /** Event types allowed in this state */
  allowedEvents: string[];
  /** Timeout configuration (optional) */
  timeout?: TimeoutConfig<E>;
  /** View/prompt metadata (optional) */
  view?: ViewConfig;
  /** Tags for categorization */
  tags?: string[];
  /** Whether this is a terminal state */
  terminal?: boolean;
}

/**
 * Transition table entry for documentation.
 */
export interface TransitionEntry {
  /** Source state key */
  fromStateKey: string;
  /** Event type that triggers transition */
  eventType: string;
  /** Target state key */
  toStateKey: string;
  /** Optional description of the transition */
  description?: string;
}

/**
 * Complete state catalog for a machine.
 */
export interface StateCatalog<E extends BaseEvent = BaseEvent> {
  /** Machine name */
  machineName: string;
  /** Catalog version (semver recommended) */
  version: string;
  /** Optional description of the machine */
  description?: string;
  /** State descriptors keyed by state key */
  states: Record<string, StateDescriptor<E>>;
  /** Optional transition table for documentation */
  transitionTable?: TransitionEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalog Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validation error for catalog.
 */
export interface CatalogValidationError {
  path: string;
  message: string;
}

/**
 * Result of catalog validation.
 */
export interface CatalogValidationResult {
  valid: boolean;
  errors: CatalogValidationError[];
}

/**
 * Validate a state catalog.
 */
export function validateCatalog<E extends BaseEvent>(
  catalog: StateCatalog<E>
): CatalogValidationResult {
  const errors: CatalogValidationError[] = [];

  // Validate required fields
  if (!catalog.machineName || typeof catalog.machineName !== 'string') {
    errors.push({ path: 'machineName', message: 'machineName is required and must be a string' });
  }

  if (!catalog.version || typeof catalog.version !== 'string') {
    errors.push({ path: 'version', message: 'version is required and must be a string' });
  }

  if (!catalog.states || typeof catalog.states !== 'object') {
    errors.push({ path: 'states', message: 'states is required and must be an object' });
    return { valid: false, errors };
  }

  // Validate each state descriptor
  for (const [stateKey, descriptor] of Object.entries(catalog.states)) {
    const path = `states.${stateKey}`;

    if (!descriptor.summary || typeof descriptor.summary !== 'string') {
      errors.push({ path: `${path}.summary`, message: 'summary is required and must be a string' });
    }

    if (!Array.isArray(descriptor.allowedEvents)) {
      errors.push({ path: `${path}.allowedEvents`, message: 'allowedEvents must be an array' });
    } else {
      for (let i = 0; i < descriptor.allowedEvents.length; i++) {
        if (typeof descriptor.allowedEvents[i] !== 'string') {
          errors.push({
            path: `${path}.allowedEvents[${i}]`,
            message: 'allowedEvents entries must be strings',
          });
        }
      }
    }

    // Validate timeout if present
    if (descriptor.timeout) {
      if (typeof descriptor.timeout.seconds !== 'number' || descriptor.timeout.seconds <= 0) {
        errors.push({
          path: `${path}.timeout.seconds`,
          message: 'timeout.seconds must be a positive number',
        });
      }
      if (!descriptor.timeout.onTimeoutEvent || typeof descriptor.timeout.onTimeoutEvent !== 'object') {
        errors.push({
          path: `${path}.timeout.onTimeoutEvent`,
          message: 'timeout.onTimeoutEvent is required when timeout is specified',
        });
      }
    }

    // Validate view if present
    if (descriptor.view) {
      if (!descriptor.view.templateId || typeof descriptor.view.templateId !== 'string') {
        errors.push({
          path: `${path}.view.templateId`,
          message: 'view.templateId is required when view is specified',
        });
      }
    }
  }

  // Validate transition table if present
  if (catalog.transitionTable) {
    const stateKeys = new Set(Object.keys(catalog.states));

    for (const [i, entry] of catalog.transitionTable.entries()) {
      const path = `transitionTable[${i}]`;

      if (!stateKeys.has(entry.fromStateKey)) {
        errors.push({
          path: `${path}.fromStateKey`,
          message: `Unknown state key: ${entry.fromStateKey}`,
        });
      }

      if (!stateKeys.has(entry.toStateKey)) {
        errors.push({
          path: `${path}.toStateKey`,
          message: `Unknown state key: ${entry.toStateKey}`,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalog Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if an event is allowed in a given state according to the catalog.
 */
export function isEventAllowed<E extends BaseEvent>(
  catalog: StateCatalog<E>,
  stateKey: string,
  eventType: string
): boolean {
  const descriptor = catalog.states[stateKey];
  if (!descriptor) {
    return false;
  }
  return descriptor.allowedEvents.includes(eventType);
}

/**
 * Get the state descriptor for a state key.
 */
export function getStateDescriptor<E extends BaseEvent>(
  catalog: StateCatalog<E>,
  stateKey: string
): StateDescriptor<E> | undefined {
  return catalog.states[stateKey];
}

/**
 * Get all state keys in the catalog.
 */
export function getStateKeys<E extends BaseEvent>(catalog: StateCatalog<E>): string[] {
  return Object.keys(catalog.states);
}

/**
 * Get all event types mentioned in the catalog.
 */
export function getAllEventTypes<E extends BaseEvent>(catalog: StateCatalog<E>): string[] {
  const eventTypes = new Set<string>();
  for (const descriptor of Object.values(catalog.states)) {
    for (const eventType of descriptor.allowedEvents) {
      eventTypes.add(eventType);
    }
  }
  return Array.from(eventTypes).sort();
}

/**
 * Get terminal states from the catalog.
 */
export function getTerminalStates<E extends BaseEvent>(catalog: StateCatalog<E>): string[] {
  return Object.entries(catalog.states)
    .filter(([, descriptor]) => descriptor.terminal === true)
    .map(([key]) => key);
}
