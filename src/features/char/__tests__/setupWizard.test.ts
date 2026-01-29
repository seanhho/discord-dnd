import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEngine, createTestHarness } from '@discord-bot/state-machine';
import {
  SqliteClient,
  SqliteUserRepo,
  SqliteCharacterRepo,
  SqliteWizardStateRepo,
} from '@discord-bot/persistence';
import { wizardMachine } from '../setup/machine.js';
import { WizardStateStorage } from '../setup/storage.js';
import { applyWizardPatch } from '../setup/apply.js';

describe('Character setup wizard', () => {
  it('transitions from start to commit and done', async () => {
    const harness = createTestHarness(wizardMachine);
    const instanceId = 'char-setup:user-123';

    await harness.engine.dispatch(instanceId, {
      type: 'START',
      source: 'command',
      discordUserId: 'user-123',
      channelId: 'channel-1',
      guildId: 'guild-1',
    });

    await harness.engine.dispatch(instanceId, {
      type: 'SET_IDENTITY',
      source: 'modal',
      name: 'Lyra',
      class: 'Wizard',
      level: 3,
      messageId: 'msg-1',
    });
    await harness.engine.dispatch(instanceId, { type: 'NEXT', source: 'button' });

    await harness.engine.dispatch(instanceId, {
      type: 'SET_ABILITIES',
      source: 'modal',
      abilitySet: 'primary',
      scores: { str: 10, dex: 14, con: 12 },
      messageId: 'msg-1',
    });
    await harness.engine.dispatch(instanceId, { type: 'NEXT', source: 'button' });

    await harness.engine.dispatch(instanceId, {
      type: 'SET_ABILITIES',
      source: 'modal',
      abilitySet: 'secondary',
      scores: { int: 16, wis: 11, cha: 8 },
      messageId: 'msg-1',
    });
    await harness.engine.dispatch(instanceId, { type: 'NEXT', source: 'button' });
    await harness.engine.dispatch(instanceId, { type: 'NEXT', source: 'button' });

    const submitResult = await harness.engine.dispatch(instanceId, {
      type: 'SUBMIT',
      source: 'button',
    });
    expect(submitResult.state.type).toBe('committing');

    const doneResult = await harness.engine.dispatch(instanceId, {
      type: 'APPLY_SUCCESS',
      source: 'system',
      summary: { characterName: 'Lyra', appliedKeys: ['name'] },
    });
    expect(doneResult.state.type).toBe('done');
  });

  it('rejects invalid level and ability scores', async () => {
    const harness = createTestHarness(wizardMachine);
    const instanceId = 'char-setup:user-456';

    await harness.engine.dispatch(instanceId, {
      type: 'START',
      source: 'command',
      discordUserId: 'user-456',
      channelId: 'channel-2',
      guildId: 'guild-2',
    });

    const invalidLevel = await harness.engine.dispatch(instanceId, {
      type: 'SET_IDENTITY',
      source: 'modal',
      name: 'BadLevel',
      class: 'Rogue',
      level: 0,
      messageId: 'msg-2',
    });

    expect(invalidLevel.state.type).toBe('identity');
    expect(invalidLevel.state.lastError).toBe('Level must be between 1 and 20.');

    await harness.engine.dispatch(instanceId, {
      type: 'SET_IDENTITY',
      source: 'modal',
      name: 'GoodLevel',
      class: 'Rogue',
      level: 2,
      messageId: 'msg-2',
    });
    await harness.engine.dispatch(instanceId, { type: 'NEXT', source: 'button' });

    const invalidAbility = await harness.engine.dispatch(instanceId, {
      type: 'SET_ABILITIES',
      source: 'modal',
      abilitySet: 'primary',
      scores: { str: 31, dex: 10, con: 10 },
      messageId: 'msg-2',
    });

    expect(invalidAbility.state.type).toBe('abilities_primary');
    expect(invalidAbility.state.lastError).toBe('STR must be between 1 and 30.');
  });

  it('clears state on timeout', async () => {
    const harness = createTestHarness(wizardMachine);
    const instanceId = 'char-setup:user-789';

    await harness.engine.dispatch(instanceId, {
      type: 'START',
      source: 'command',
      discordUserId: 'user-789',
      channelId: 'channel-3',
      guildId: 'guild-3',
    });

    await harness.engine.dispatch(instanceId, { type: 'TIMEOUT', source: 'system' });

    const effects = harness.effectRunner.getRecordedByType('ClearState');
    expect(effects.length).toBeGreaterThan(0);
  });
});

describe('Wizard persistence', () => {
  let client: SqliteClient;

  beforeEach(async () => {
    client = await SqliteClient.create({ dbPath: ':memory:', runMigrations: true });
  });

  afterEach(async () => {
    await client.close();
  });

  it('persists and reloads wizard state', async () => {
    const wizardStateRepo = new SqliteWizardStateRepo(client.kysely);
    const storage = new WizardStateStorage(
      wizardStateRepo,
      wizardMachine.catalog.machineName
    );

    const engine = createEngine(wizardMachine, {
      storage,
      effectRunner: { run: async () => {} },
      createContext: (instanceId) => ({
        instanceId,
        timestamp: new Date().toISOString(),
      }),
    });

    const instanceId = 'char-setup:persist';
    await engine.dispatch(instanceId, {
      type: 'START',
      source: 'command',
      discordUserId: 'persist',
      channelId: 'channel-4',
      guildId: 'guild-4',
    });

    const stored = await wizardStateRepo.loadWizardState(instanceId);
    expect(stored).not.toBeNull();

    const newEngine = createEngine(wizardMachine, {
      storage: new WizardStateStorage(
        wizardStateRepo,
        wizardMachine.catalog.machineName
      ),
      effectRunner: { run: async () => {} },
      createContext: (id) => ({
        instanceId: id,
        timestamp: new Date().toISOString(),
      }),
    });

    const reloaded = await newEngine.getState(instanceId);
    expect(reloaded?.type).toBe('identity');
  });
});

describe('Wizard apply integration', () => {
  let client: SqliteClient;

  beforeEach(async () => {
    client = await SqliteClient.create({ dbPath: ':memory:', runMigrations: true });
  });

  afterEach(async () => {
    await client.close();
  });

  it('applies patch via /char set path and sets active character', async () => {
    const userRepo = new SqliteUserRepo(client.kysely);
    const characterRepo = new SqliteCharacterRepo(client.kysely);

    const result = await applyWizardPatch({
      discordUserId: 'discord-user',
      guildId: 'guild-123',
      userRepo,
      characterRepo,
      draft: {
        name: 'Sable',
        class: 'Cleric',
        level: 5,
        abilities: {
          str: 12,
          dex: 10,
          con: 14,
          int: 8,
          wis: 16,
          cha: 11,
        },
      },
    });

    expect(result.success).toBe(true);

    const user = await userRepo.getOrCreateByDiscordUserId('discord-user');
    const active = await characterRepo.getActiveCharacter({
      userId: user.id,
      guildId: 'guild-123',
    });

    expect(active?.name).toBe('Sable');
    expect(active?.attributes.str?.v).toBe(12);
    expect(active?.attributes.wis?.v).toBe(16);
  });
});
