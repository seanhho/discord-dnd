/**
 * Wizard example - Usage demonstration
 *
 * This file shows how to use the wizard machine with the engine.
 */

import {
  createMachine,
  createEngine,
  InMemoryStorage,
  generateMarkdown,
} from '../../src/index.js';
import type { EffectRunner, Effect } from '../../src/index.js';
import { wizardCatalog } from './catalog.js';
import { wizardDefinition } from './machine.js';
import type { WizardState, WizardEvent, WizardContext, WizardEffect } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Effect Runner Implementation
// ─────────────────────────────────────────────────────────────────────────────

class WizardEffectRunner implements EffectRunner<WizardEvent, WizardContext, WizardEffect> {
  async run(
    instanceId: string,
    effects: Effect<WizardEvent, WizardEffect>[],
    ctx: WizardContext
  ): Promise<void> {
    for (const effect of effects) {
      switch (effect.type) {
        case 'Log':
          console.log(`[${effect.level}] ${effect.message}`, effect.data ?? '');
          break;

        case 'ScheduleTimeout':
          console.log(
            `[TIMEOUT] Scheduling "${effect.timeoutId}" for ${effect.seconds}s -> ${effect.event.type}`
          );
          // In a real app, you'd use a timer/scheduler service
          break;

        case 'CancelTimeout':
          console.log(`[TIMEOUT] Cancelling "${effect.timeoutId}"`);
          break;

        case 'SendPrompt':
          console.log(`[PROMPT] Sending "${effect.promptId}" to user ${ctx.userId}`, effect.data);
          break;

        case 'NotifyComplete':
          console.log(`[NOTIFY] Character "${effect.characterName}" created!`);
          break;

        case 'PersistNow':
          console.log('[PERSIST] Explicit persist requested');
          break;
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Example
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Wizard State Machine Example ===\n');

  // Create the machine
  const machine = createMachine(wizardDefinition, wizardCatalog);

  // Create storage and effect runner
  const storage = new InMemoryStorage<WizardState>();
  const effectRunner = new WizardEffectRunner();

  // Create context factory
  const createContext = (instanceId: string): WizardContext => ({
    instanceId,
    timestamp: new Date().toISOString(),
    userId: 'user-123',
  });

  // Create the engine
  const engine = createEngine(machine, {
    storage,
    effectRunner,
    createContext,
    hooks: {
      onTransition: (info) => {
        console.log(`\n[TRANSITION] ${info.prevStateKey} -> ${info.nextStateKey} (${info.eventType})`);
      },
      onError: (info) => {
        console.error(`\n[ERROR] ${info.error.message}`);
      },
    },
  });

  const instanceId = 'wizard-instance-1';

  // Initialize
  console.log('--- Initializing wizard ---');
  await engine.initialize(instanceId);

  // Start the wizard
  console.log('\n--- Starting wizard ---');
  let result = await engine.dispatch(instanceId, { type: 'START' });
  console.log('State:', result.state.type);

  // Set name
  console.log('\n--- Setting name ---');
  result = await engine.dispatch(instanceId, { type: 'SET_NAME', name: 'Gandalf' });
  console.log('State:', result.state);

  // Proceed to step 2
  console.log('\n--- Next (to step 2) ---');
  result = await engine.dispatch(instanceId, { type: 'NEXT' });
  console.log('State:', result.state.type);

  // Set class
  console.log('\n--- Setting class ---');
  result = await engine.dispatch(instanceId, { type: 'SET_CLASS', class: 'Wizard' });
  console.log('State:', result.state);

  // Proceed to review
  console.log('\n--- Next (to review) ---');
  result = await engine.dispatch(instanceId, { type: 'NEXT' });
  console.log('State:', result.state);

  // Submit
  console.log('\n--- Submit ---');
  result = await engine.dispatch(instanceId, { type: 'SUBMIT' });
  console.log('Final state:', result.state);
  console.log('Success:', result.success);

  // Try invalid event on terminal state
  console.log('\n--- Try invalid event on Done state ---');
  result = await engine.dispatch(instanceId, { type: 'START' });
  console.log('Success:', result.success);
  console.log('Errors:', result.errors);

  // Generate documentation
  console.log('\n\n=== Generated Documentation ===\n');
  console.log(generateMarkdown(wizardCatalog));
}

// Run if executed directly
main().catch(console.error);
