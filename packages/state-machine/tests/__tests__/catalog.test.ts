/**
 * Catalog tests
 */

import { describe, it, expect } from 'vitest';
import {
  validateCatalog,
  isEventAllowed,
  getStateDescriptor,
  getStateKeys,
  getAllEventTypes,
  getTerminalStates,
  type StateCatalog,
  type BaseEvent,
} from '../../src/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Test Types
// ─────────────────────────────────────────────────────────────────────────────

type TestEvent =
  | { type: 'START' }
  | { type: 'STOP' }
  | { type: 'TIMEOUT' };

// ─────────────────────────────────────────────────────────────────────────────
// Test Catalogs
// ─────────────────────────────────────────────────────────────────────────────

const validCatalog: StateCatalog<TestEvent> = {
  machineName: 'TestMachine',
  version: '1.0.0',
  description: 'A test machine',
  states: {
    Idle: {
      summary: 'Waiting to start',
      allowedEvents: ['START'],
      tags: ['initial'],
    },
    Running: {
      summary: 'Running',
      allowedEvents: ['STOP', 'TIMEOUT'],
      timeout: {
        seconds: 60,
        onTimeoutEvent: { type: 'TIMEOUT' },
      },
      view: {
        templateId: 'running-view',
        title: 'In Progress',
      },
    },
    Done: {
      summary: 'Completed',
      allowedEvents: [],
      terminal: true,
    },
  },
  transitionTable: [
    { fromStateKey: 'Idle', eventType: 'START', toStateKey: 'Running' },
    { fromStateKey: 'Running', eventType: 'STOP', toStateKey: 'Done' },
    { fromStateKey: 'Running', eventType: 'TIMEOUT', toStateKey: 'Done' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('validateCatalog', () => {
  it('should validate a correct catalog', () => {
    const result = validateCatalog(validCatalog);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject missing machineName', () => {
    const catalog = { ...validCatalog, machineName: '' };
    const result = validateCatalog(catalog);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'machineName')).toBe(true);
  });

  it('should reject missing version', () => {
    const catalog = { ...validCatalog, version: '' };
    const result = validateCatalog(catalog);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'version')).toBe(true);
  });

  it('should reject missing states', () => {
    const catalog = { ...validCatalog, states: null as unknown as typeof validCatalog.states };
    const result = validateCatalog(catalog);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'states')).toBe(true);
  });

  it('should reject state without summary', () => {
    const catalog: StateCatalog<TestEvent> = {
      ...validCatalog,
      states: {
        ...validCatalog.states,
        Bad: {
          summary: '',
          allowedEvents: [],
        },
      },
    };
    const result = validateCatalog(catalog);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'states.Bad.summary')).toBe(true);
  });

  it('should reject state without allowedEvents array', () => {
    const catalog = {
      ...validCatalog,
      states: {
        ...validCatalog.states,
        Bad: {
          summary: 'Bad state',
          allowedEvents: 'not an array' as unknown as string[],
        },
      },
    };
    const result = validateCatalog(catalog);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'states.Bad.allowedEvents')).toBe(true);
  });

  it('should reject timeout without seconds', () => {
    const catalog: StateCatalog<TestEvent> = {
      ...validCatalog,
      states: {
        ...validCatalog.states,
        Bad: {
          summary: 'Bad state',
          allowedEvents: [],
          timeout: {
            seconds: 0,
            onTimeoutEvent: { type: 'TIMEOUT' },
          },
        },
      },
    };
    const result = validateCatalog(catalog);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'states.Bad.timeout.seconds')).toBe(true);
  });

  it('should reject view without templateId', () => {
    const catalog: StateCatalog<TestEvent> = {
      ...validCatalog,
      states: {
        ...validCatalog.states,
        Bad: {
          summary: 'Bad state',
          allowedEvents: [],
          view: {
            templateId: '',
          },
        },
      },
    };
    const result = validateCatalog(catalog);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'states.Bad.view.templateId')).toBe(true);
  });

  it('should reject unknown state in transitionTable', () => {
    const catalog: StateCatalog<TestEvent> = {
      ...validCatalog,
      transitionTable: [
        { fromStateKey: 'Unknown', eventType: 'START', toStateKey: 'Running' },
      ],
    };
    const result = validateCatalog(catalog);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Unknown state key: Unknown'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Utility Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('isEventAllowed', () => {
  it('should return true for allowed events', () => {
    expect(isEventAllowed(validCatalog, 'Idle', 'START')).toBe(true);
    expect(isEventAllowed(validCatalog, 'Running', 'STOP')).toBe(true);
    expect(isEventAllowed(validCatalog, 'Running', 'TIMEOUT')).toBe(true);
  });

  it('should return false for disallowed events', () => {
    expect(isEventAllowed(validCatalog, 'Idle', 'STOP')).toBe(false);
    expect(isEventAllowed(validCatalog, 'Done', 'START')).toBe(false);
  });

  it('should return false for unknown state', () => {
    expect(isEventAllowed(validCatalog, 'Unknown', 'START')).toBe(false);
  });
});

describe('getStateDescriptor', () => {
  it('should return descriptor for existing state', () => {
    const descriptor = getStateDescriptor(validCatalog, 'Running');

    expect(descriptor).toBeDefined();
    expect(descriptor!.summary).toBe('Running');
    expect(descriptor!.timeout?.seconds).toBe(60);
  });

  it('should return undefined for unknown state', () => {
    const descriptor = getStateDescriptor(validCatalog, 'Unknown');

    expect(descriptor).toBeUndefined();
  });
});

describe('getStateKeys', () => {
  it('should return all state keys', () => {
    const keys = getStateKeys(validCatalog);

    expect(keys).toContain('Idle');
    expect(keys).toContain('Running');
    expect(keys).toContain('Done');
    expect(keys).toHaveLength(3);
  });
});

describe('getAllEventTypes', () => {
  it('should return all unique event types sorted', () => {
    const events = getAllEventTypes(validCatalog);

    expect(events).toEqual(['START', 'STOP', 'TIMEOUT']);
  });
});

describe('getTerminalStates', () => {
  it('should return only terminal states', () => {
    const terminals = getTerminalStates(validCatalog);

    expect(terminals).toEqual(['Done']);
  });
});
