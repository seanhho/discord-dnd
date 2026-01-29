/**
 * Combat example - Usage demonstration
 */

import {
  createMachine,
  createEngine,
  InMemoryStorage,
  generateMarkdown,
  generateMermaid,
} from '../../src/index.js';
import type { EffectRunner, Effect } from '../../src/index.js';
import { combatCatalog } from './catalog.js';
import { combatDefinition } from './machine.js';
import type { CombatState, CombatEvent, CombatContext, CombatEffect, Combatant } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Effect Runner Implementation
// ─────────────────────────────────────────────────────────────────────────────

class CombatEffectRunner implements EffectRunner<CombatEvent, CombatContext, CombatEffect> {
  async run(
    instanceId: string,
    effects: Effect<CombatEvent, CombatEffect>[],
    ctx: CombatContext
  ): Promise<void> {
    for (const effect of effects) {
      switch (effect.type) {
        case 'Log':
          if (effect.level !== 'debug') {
            console.log(`[${effect.level.toUpperCase()}] ${effect.message}`);
          }
          break;

        case 'ScheduleTimeout':
          console.log(`  [TIMER] Set ${effect.timeoutId} for ${effect.seconds}s`);
          break;

        case 'CancelTimeout':
          console.log(`  [TIMER] Cancel ${effect.timeoutId}`);
          break;

        case 'SendCombatMessage':
          console.log(`  [MSG] ${effect.message}`);
          break;

        case 'UpdateInitiativeDisplay':
          console.log('  [INIT] Initiative order:');
          for (const c of effect.combatants) {
            console.log(`    - ${c.name}: ${c.initiative ?? '??'}`);
          }
          break;

        case 'PromptForIntent':
          console.log(`  [PROMPT] ${effect.combatantName}, what do you do?`);
          break;

        case 'AnnounceTurnStart':
          console.log(`  [TURN] Round ${effect.round}: ${effect.combatantName}'s turn!`);
          break;

        case 'AnnounceVictory':
          console.log(`  [VICTORY] ${effect.victor} wins!`);
          break;
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Example
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Combat Encounter State Machine Example ===\n');

  // Create the machine
  const machine = createMachine(combatDefinition, combatCatalog);

  // Create storage and effect runner
  const storage = new InMemoryStorage<CombatState>();
  const effectRunner = new CombatEffectRunner();

  // Create context factory
  const createContext = (instanceId: string): CombatContext => ({
    instanceId,
    timestamp: new Date().toISOString(),
    guildId: 'guild-123',
    channelId: 'channel-456',
    dmUserId: 'dm-user-789',
  });

  // Create the engine
  const engine = createEngine(machine, {
    storage,
    effectRunner,
    createContext,
    hooks: {
      onTransition: (info) => {
        console.log(`[${info.prevStateKey}] --${info.eventType}--> [${info.nextStateKey}]`);
      },
    },
  });

  const instanceId = 'combat-instance-1';

  // Initialize
  console.log('--- Setup Phase ---');
  await engine.initialize(instanceId);

  // Add combatants
  const player1: Combatant = { id: 'p1', name: 'Aragorn', hp: 50, maxHp: 50, isPlayer: true };
  const player2: Combatant = { id: 'p2', name: 'Legolas', hp: 40, maxHp: 40, isPlayer: true };
  const enemy1: Combatant = { id: 'e1', name: 'Orc Warlord', hp: 60, maxHp: 60, isPlayer: false };

  await engine.dispatch(instanceId, { type: 'ADD_COMBATANT', combatant: player1 });
  await engine.dispatch(instanceId, { type: 'ADD_COMBATANT', combatant: player2 });
  await engine.dispatch(instanceId, { type: 'ADD_COMBATANT', combatant: enemy1 });

  // Start encounter
  console.log('\n--- Initiative Phase ---');
  let result = await engine.dispatch(instanceId, { type: 'START_ENCOUNTER' });
  console.log('State:', combatDefinition.getStateKey(result.state));

  // Roll initiative
  await engine.dispatch(instanceId, { type: 'ROLL_INIT', combatantId: 'p1', roll: 18 });
  await engine.dispatch(instanceId, { type: 'ROLL_INIT', combatantId: 'p2', roll: 22 });
  await engine.dispatch(instanceId, { type: 'ROLL_INIT', combatantId: 'e1', roll: 15 });

  // Finalize initiative
  result = await engine.dispatch(instanceId, { type: 'FINALIZE_INIT' });
  console.log('State:', combatDefinition.getStateKey(result.state));

  // Combat round (note: NEXT_TURN emits DECLARE_INTENT which auto-advances)
  console.log('\n--- Combat Phase ---');

  // Legolas goes first (highest init)
  console.log('\nLegolas declares attack...');
  result = await engine.dispatch(instanceId, {
    type: 'DECLARE_INTENT',
    combatantId: 'p2',
    action: 'attack',
    targetId: 'e1',
  });

  // Apply damage
  result = await engine.dispatch(instanceId, { type: 'APPLY_DAMAGE', targetId: 'e1', damage: 15 });

  // Complete turn
  result = await engine.dispatch(instanceId, { type: 'TURN_COMPLETE' });

  // Next turn (Aragorn)
  console.log('\nNext turn...');
  result = await engine.dispatch(instanceId, { type: 'NEXT_TURN' });
  console.log('State:', combatDefinition.getStateKey(result.state));
  console.log('Transitions:', result.transitionCount);

  // Pause combat
  console.log('\n--- Pause ---');
  result = await engine.dispatch(instanceId, { type: 'PAUSE' });
  console.log('State:', combatDefinition.getStateKey(result.state));

  // Try invalid event while paused
  console.log('\nTry DECLARE_INTENT while paused:');
  result = await engine.dispatch(instanceId, {
    type: 'DECLARE_INTENT',
    combatantId: 'p1',
    action: 'attack',
  });
  console.log('Success:', result.success);
  console.log('Errors:', result.errors);

  // Resume
  console.log('\n--- Resume ---');
  result = await engine.dispatch(instanceId, { type: 'RESUME' });
  console.log('State:', combatDefinition.getStateKey(result.state));

  // End encounter
  console.log('\n--- End Encounter ---');
  result = await engine.dispatch(instanceId, { type: 'END_ENCOUNTER', reason: 'Demo complete' });
  console.log('Final state:', combatDefinition.getStateKey(result.state));

  // Generate documentation
  console.log('\n\n=== Generated Documentation ===\n');
  console.log(generateMarkdown(combatCatalog));

  console.log('\n=== Mermaid Diagram ===\n');
  console.log(generateMermaid(combatCatalog));
}

// Run if executed directly
main().catch(console.error);
