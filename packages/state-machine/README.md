# @discord-bot/state-machine

A TypeScript state machine library with catalog-driven validation, effects, and comprehensive testing utilities.

## Features

- **Type-safe** - Full TypeScript support with generics for states, events, and effects
- **Catalog-driven** - Human-readable state catalogs for validation and documentation
- **Pure reducer + effects** - Deterministic state transitions with declarative side effects
- **Pluggable storage** - Bring your own persistence layer
- **Testing utilities** - Built-in test harness with effect recording
- **Documentation generation** - Generate Markdown and Mermaid diagrams from catalogs

## Installation

```bash
npm install @discord-bot/state-machine
```

## Quick Start

### 1. Define Your Types

```typescript
import type { BaseState, BaseEvent, BaseContext } from '@discord-bot/state-machine';

// States must have a 'type' discriminant
type MyState =
  | { type: 'Idle' }
  | { type: 'Running'; count: number }
  | { type: 'Done' };

// Events must have a 'type' discriminant
type MyEvent =
  | { type: 'START' }
  | { type: 'INCREMENT' }
  | { type: 'STOP' };

// Context extends BaseContext
interface MyContext extends BaseContext {
  userId: string;
}
```

### 2. Create a Catalog

The catalog defines state metadata and allowed events:

```typescript
import type { StateCatalog } from '@discord-bot/state-machine';

const catalog: StateCatalog<MyEvent> = {
  machineName: 'Counter',
  version: '1.0.0',
  states: {
    Idle: {
      summary: 'Waiting to start',
      allowedEvents: ['START'],
    },
    Running: {
      summary: 'Counter is active',
      allowedEvents: ['INCREMENT', 'STOP'],
      timeout: {
        seconds: 300,
        onTimeoutEvent: { type: 'STOP' },
      },
    },
    Done: {
      summary: 'Counter finished',
      allowedEvents: [],
      terminal: true,
    },
  },
};
```

### 3. Define the Machine

```typescript
import type { MachineDefinition, Effect } from '@discord-bot/state-machine';
import { log } from '@discord-bot/state-machine';

const definition: MachineDefinition<MyState, MyEvent, MyContext> = {
  // Map runtime state to catalog key
  getStateKey: (state) => state.type,

  // Initial state for new instances
  getInitialState: () => ({ type: 'Idle' }),

  // Pure reducer - returns new state and optionally emits events
  reducer: (state, event) => {
    if (state.type === 'Idle' && event.type === 'START') {
      return { state: { type: 'Running', count: 0 } };
    }
    if (state.type === 'Running' && event.type === 'INCREMENT') {
      return { state: { ...state, count: state.count + 1 } };
    }
    if (state.type === 'Running' && event.type === 'STOP') {
      return { state: { type: 'Done' } };
    }
    return { state };
  },

  // Compute effects based on transition (pure - no I/O)
  effects: (prev, next, event, ctx) => {
    const effects: Effect<MyEvent>[] = [];
    if (event.type === 'START') {
      effects.push(log('info', `User ${ctx.userId} started counter`));
    }
    return effects;
  },

  // Optional guard to validate events
  guard: (event, state) => {
    if (event.type === 'INCREMENT' && state.type === 'Running' && state.count >= 100) {
      return { ok: false, reason: 'Counter limit reached' };
    }
    return { ok: true };
  },
};
```

### 4. Create and Use the Engine

```typescript
import {
  createMachine,
  createEngine,
  InMemoryStorage,
} from '@discord-bot/state-machine';

// Create the machine
const machine = createMachine(definition, catalog);

// Set up storage and effect runner
const storage = new InMemoryStorage<MyState>();
const effectRunner = {
  run: async (instanceId, effects, ctx) => {
    for (const effect of effects) {
      console.log(`[${effect.type}]`, effect);
    }
  },
};

// Create the engine
const engine = createEngine(machine, {
  storage,
  effectRunner,
  createContext: (instanceId) => ({
    instanceId,
    timestamp: new Date().toISOString(),
    userId: 'user-123',
  }),
});

// Use it
await engine.initialize('counter-1');
await engine.dispatch('counter-1', { type: 'START' });
await engine.dispatch('counter-1', { type: 'INCREMENT' });
const state = await engine.getState('counter-1');
console.log(state); // { type: 'Running', count: 1 }
```

## Core Concepts

### State Catalog

A catalog is a human-readable definition of your machine's states:

```typescript
interface StateCatalog<E> {
  machineName: string;
  version: string;
  description?: string;
  states: Record<string, StateDescriptor<E>>;
  transitionTable?: TransitionEntry[]; // For documentation
}

interface StateDescriptor<E> {
  summary: string;              // Required - short description
  description?: string;         // Optional - longer description
  allowedEvents: string[];      // Events valid in this state
  timeout?: {
    seconds: number;
    onTimeoutEvent: E;
  };
  view?: {
    templateId: string;
    title?: string;
  };
  tags?: string[];
  terminal?: boolean;
}
```

### Effects

Effects are declarative side effects returned by the machine:

```typescript
// Core effects (built-in)
type CoreEffect<E> =
  | { type: 'Log'; level: 'debug' | 'info' | 'warn' | 'error'; message: string }
  | { type: 'PersistNow' }
  | { type: 'EmitEvent'; event: E }
  | { type: 'ScheduleTimeout'; timeoutId: string; seconds: number; event: E }
  | { type: 'CancelTimeout'; timeoutId: string };

// Add custom effects via generics
type CustomEffect = { type: 'SendEmail'; to: string; subject: string };
type MyEffect = Effect<MyEvent, CustomEffect>;
```

Helper functions for creating effects:

```typescript
import { log, scheduleTimeout, cancelTimeout, emitEvent } from '@discord-bot/state-machine';

effects.push(log('info', 'Something happened'));
effects.push(scheduleTimeout('my-timeout', 60, { type: 'TIMEOUT' }));
effects.push(cancelTimeout('my-timeout'));
```

### Emitted Events

Reducers can emit events for immediate processing:

```typescript
reducer: (state, event) => {
  if (event.type === 'COMPLEX_ACTION') {
    return {
      state: newState,
      emitted: [
        { type: 'SUB_ACTION_1' },
        { type: 'SUB_ACTION_2' },
      ],
    };
  }
}
```

Emitted events are processed in order. The engine has a configurable loop limit to prevent infinite loops.

### Storage Adapter

Implement the `StorageAdapter` interface for your persistence layer:

```typescript
interface StorageAdapter<S> {
  load(instanceId: string): Promise<StoredState<S> | null>;
  save(instanceId: string, state: S, meta: StateMeta): Promise<void>;
  delete?(instanceId: string): Promise<void>;
}
```

### Effect Runner

Implement the `EffectRunner` interface to handle effects:

```typescript
interface EffectRunner<E, C, Custom> {
  run(instanceId: string, effects: Effect<E, Custom>[], ctx: C): Promise<void>;
}
```

## Testing

The library provides comprehensive testing utilities:

```typescript
import { createMachine, createTestHarness } from '@discord-bot/state-machine';

const machine = createMachine(definition, catalog);
const harness = createTestHarness(machine, {
  baseContext: { userId: 'test-user' },
  fixedTimestamp: '2024-01-01T00:00:00.000Z',
});

// Test transitions
await harness.engine.initialize('test-1');
const result = await harness.engine.dispatch('test-1', { type: 'START' });

expect(result.success).toBe(true);
expect(result.state.type).toBe('Running');

// Check recorded effects
const recorded = harness.effectRunner.getRecorded();
expect(recorded).toHaveLength(1);

// Check transitions
expect(harness.transitions).toEqual([
  { instanceId: 'test-1', prevStateKey: 'Idle', nextStateKey: 'Running', eventType: 'START' }
]);
```

## Documentation Generation

Generate documentation from your catalog:

```typescript
import { generateMarkdown, generateMermaid } from '@discord-bot/state-machine';

// Generate Markdown
const markdown = generateMarkdown(catalog, {
  includeTimeouts: true,
  includeTags: true,
  includeTransitionTable: true,
});

// Generate Mermaid state diagram
const mermaid = generateMermaid(catalog, {
  direction: 'TB',
  includeEventLabels: true,
});
```

## Configuration

```typescript
const machine = createMachine(definition, catalog, {
  maxTransitions: 100,        // Loop limit per dispatch
  validateEvents: true,       // Validate against catalog
  autoPersist: true,          // Auto-save after dispatch
  loopWarningThreshold: 0.8,  // Warn at 80% of loop limit
});
```

## Examples

See the `examples/` directory for complete examples:

- **Wizard** - Linear multi-step wizard with back/next navigation
- **Combat** - Turn-based combat encounter with nested states

Run examples:

```bash
npx tsx examples/wizard/example.ts
npx tsx examples/combat/example.ts
```

## API Reference

### Core Exports

| Export | Description |
|--------|-------------|
| `createMachine` | Create a machine from definition + catalog |
| `createEngine` | Create an engine for a machine |
| `validateCatalog` | Validate a state catalog |
| `isEventAllowed` | Check if event is allowed in state |
| `generateMarkdown` | Generate Markdown docs from catalog |
| `generateMermaid` | Generate Mermaid diagram from catalog |

### Testing Exports

```typescript
import { createTestHarness, TestEffectRunner } from '@discord-bot/state-machine/testing';
```

| Export | Description |
|--------|-------------|
| `createTestHarness` | Create a test harness with test doubles |
| `TestEffectRunner` | Effect runner that records effects |
| `InMemoryStorage` | Simple in-memory storage adapter |
| `assertStateType` | Assert state has expected type |
| `assertHasEffect` | Assert effects contain type |
| `assertDispatchSuccess` | Assert dispatch succeeded |

## License

MIT
