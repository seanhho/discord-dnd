/**
 * Integration tests for Encounter persistence.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteClient } from '../../src/sqlite/db.js';
import { SqliteUserRepo } from '../../src/sqlite/userRepo.js';
import { SqliteCharacterRepo } from '../../src/sqlite/characterRepo.js';
import { SqliteEncounterRepo } from '../../src/sqlite/encounterRepo.js';
import { SqliteEncounterParticipantRepo } from '../../src/sqlite/encounterParticipantRepo.js';
import { SqliteEncounterEventRepo } from '../../src/sqlite/encounterEventRepo.js';

describe('EncounterRepo', () => {
  let client: SqliteClient;
  let userRepo: SqliteUserRepo;
  let characterRepo: SqliteCharacterRepo;
  let encounterRepo: SqliteEncounterRepo;
  let participantRepo: SqliteEncounterParticipantRepo;
  let eventRepo: SqliteEncounterEventRepo;

  beforeEach(async () => {
    client = await SqliteClient.create({ dbPath: ':memory:' });
    userRepo = new SqliteUserRepo(client.kysely);
    characterRepo = new SqliteCharacterRepo(client.kysely);
    encounterRepo = new SqliteEncounterRepo(client.kysely);
    participantRepo = new SqliteEncounterParticipantRepo(client.kysely);
    eventRepo = new SqliteEncounterEventRepo(client.kysely);
  });

  afterEach(async () => {
    await client.close();
  });

  describe('createEncounter', () => {
    it('should create an encounter in a context', async () => {
      const encounter = await encounterRepo.createEncounter({
        name: 'Goblin Ambush',
        guildId: 'guild-1',
        channelId: 'channel-1',
        createdByDiscordUserId: 'user-1',
      });

      expect(encounter.id).toBeDefined();
      expect(encounter.name).toBe('Goblin Ambush');
      expect(encounter.status).toBe('setup');
      expect(encounter.guildId).toBe('guild-1');
      expect(encounter.channelId).toBe('channel-1');
      expect(encounter.threadId).toBeNull();
      expect(encounter.createdByDiscordUserId).toBe('user-1');
      expect(encounter.round).toBe(1);
      expect(encounter.turnIndex).toBe(0);
      expect(encounter.initiativeLocked).toBe(false);
    });

    it('should prevent creating two active encounters in the same context', async () => {
      await encounterRepo.createEncounter({
        name: 'First Encounter',
        guildId: 'guild-1',
        channelId: 'channel-1',
        createdByDiscordUserId: 'user-1',
      });

      await expect(
        encounterRepo.createEncounter({
          name: 'Second Encounter',
          guildId: 'guild-1',
          channelId: 'channel-1',
          createdByDiscordUserId: 'user-2',
        })
      ).rejects.toThrow();
    });

    it('should allow creating encounters in different contexts', async () => {
      const enc1 = await encounterRepo.createEncounter({
        name: 'Encounter 1',
        guildId: 'guild-1',
        channelId: 'channel-1',
        createdByDiscordUserId: 'user-1',
      });

      const enc2 = await encounterRepo.createEncounter({
        name: 'Encounter 2',
        guildId: 'guild-1',
        channelId: 'channel-2',
        createdByDiscordUserId: 'user-1',
      });

      expect(enc1.id).not.toBe(enc2.id);
    });

    it('should allow creating encounter in thread context', async () => {
      const enc1 = await encounterRepo.createEncounter({
        name: 'Channel Encounter',
        guildId: 'guild-1',
        channelId: 'channel-1',
        createdByDiscordUserId: 'user-1',
      });

      const enc2 = await encounterRepo.createEncounter({
        name: 'Thread Encounter',
        guildId: 'guild-1',
        channelId: 'channel-1',
        threadId: 'thread-1',
        createdByDiscordUserId: 'user-1',
      });

      expect(enc1.threadId).toBeNull();
      expect(enc2.threadId).toBe('thread-1');
    });
  });

  describe('getActiveEncounterByContext', () => {
    it('should return the active encounter', async () => {
      const created = await encounterRepo.createEncounter({
        name: 'Test Encounter',
        guildId: 'guild-1',
        channelId: 'channel-1',
        createdByDiscordUserId: 'user-1',
      });

      const found = await encounterRepo.getActiveEncounterByContext({
        guildId: 'guild-1',
        channelId: 'channel-1',
      });

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null if no active encounter', async () => {
      const found = await encounterRepo.getActiveEncounterByContext({
        guildId: 'guild-1',
        channelId: 'channel-1',
      });

      expect(found).toBeNull();
    });

    it('should not return ended encounters', async () => {
      const enc = await encounterRepo.createEncounter({
        name: 'Test Encounter',
        guildId: 'guild-1',
        channelId: 'channel-1',
        createdByDiscordUserId: 'user-1',
      });

      await encounterRepo.endEncounter(enc.id);

      const found = await encounterRepo.getActiveEncounterByContext({
        guildId: 'guild-1',
        channelId: 'channel-1',
      });

      expect(found).toBeNull();
    });
  });

  describe('updateEncounter', () => {
    it('should update encounter status', async () => {
      const enc = await encounterRepo.createEncounter({
        name: 'Test Encounter',
        guildId: 'guild-1',
        channelId: 'channel-1',
        createdByDiscordUserId: 'user-1',
      });

      const updated = await encounterRepo.updateEncounter(enc.id, {
        status: 'running',
      });

      expect(updated.status).toBe('running');
    });

    it('should update turn loop values', async () => {
      const enc = await encounterRepo.createEncounter({
        name: 'Test Encounter',
        guildId: 'guild-1',
        channelId: 'channel-1',
        createdByDiscordUserId: 'user-1',
      });

      const updated = await encounterRepo.updateEncounter(enc.id, {
        round: 3,
        turnIndex: 2,
        initiativeLocked: true,
      });

      expect(updated.round).toBe(3);
      expect(updated.turnIndex).toBe(2);
      expect(updated.initiativeLocked).toBe(true);
    });

    it('should throw if encounter not found', async () => {
      await expect(
        encounterRepo.updateEncounter('nonexistent', { status: 'running' })
      ).rejects.toThrow('Encounter not found');
    });
  });

  describe('endEncounter', () => {
    it('should set status to ended', async () => {
      const enc = await encounterRepo.createEncounter({
        name: 'Test Encounter',
        guildId: 'guild-1',
        channelId: 'channel-1',
        createdByDiscordUserId: 'user-1',
      });

      await encounterRepo.endEncounter(enc.id);

      const found = await encounterRepo.getEncounter(enc.id);
      expect(found!.status).toBe('ended');
    });

    it('should allow creating new encounter after ending previous', async () => {
      const enc1 = await encounterRepo.createEncounter({
        name: 'First Encounter',
        guildId: 'guild-1',
        channelId: 'channel-1',
        createdByDiscordUserId: 'user-1',
      });

      await encounterRepo.endEncounter(enc1.id);

      const enc2 = await encounterRepo.createEncounter({
        name: 'Second Encounter',
        guildId: 'guild-1',
        channelId: 'channel-1',
        createdByDiscordUserId: 'user-1',
      });

      expect(enc2.status).toBe('setup');
    });
  });
});

describe('EncounterParticipantRepo', () => {
  let client: SqliteClient;
  let userRepo: SqliteUserRepo;
  let characterRepo: SqliteCharacterRepo;
  let encounterRepo: SqliteEncounterRepo;
  let participantRepo: SqliteEncounterParticipantRepo;

  let testUserId: string;
  let testCharacterId: string;
  let testEncounterId: string;

  beforeEach(async () => {
    client = await SqliteClient.create({ dbPath: ':memory:' });
    userRepo = new SqliteUserRepo(client.kysely);
    characterRepo = new SqliteCharacterRepo(client.kysely);
    encounterRepo = new SqliteEncounterRepo(client.kysely);
    participantRepo = new SqliteEncounterParticipantRepo(client.kysely);

    // Create test user and character
    const user = await userRepo.getOrCreateByDiscordUserId('discord-user-1');
    testUserId = user.id;

    const character = await characterRepo.createCharacter({
      userId: testUserId,
      guildId: 'guild-1',
      name: 'Gandalf',
    });
    testCharacterId = character.id;

    // Create test encounter
    const encounter = await encounterRepo.createEncounter({
      name: 'Test Encounter',
      guildId: 'guild-1',
      channelId: 'channel-1',
      createdByDiscordUserId: 'discord-user-1',
    });
    testEncounterId = encounter.id;
  });

  afterEach(async () => {
    await client.close();
  });

  describe('addPcParticipant', () => {
    it('should add a PC participant', async () => {
      const participant = await participantRepo.addPcParticipant({
        encounterId: testEncounterId,
        characterId: testCharacterId,
        discordUserId: 'discord-user-1',
      });

      expect(participant.id).toBeDefined();
      expect(participant.kind).toBe('pc');
      expect(participant.displayName).toBe('Gandalf');
      expect(participant.characterId).toBe(testCharacterId);
      expect(participant.initiative).toBeNull();
    });

    it('should use custom display name if provided', async () => {
      const participant = await participantRepo.addPcParticipant({
        encounterId: testEncounterId,
        characterId: testCharacterId,
        displayName: 'Gandalf the Grey',
      });

      expect(participant.displayName).toBe('Gandalf the Grey');
    });

    it('should prevent adding same character twice', async () => {
      await participantRepo.addPcParticipant({
        encounterId: testEncounterId,
        characterId: testCharacterId,
      });

      await expect(
        participantRepo.addPcParticipant({
          encounterId: testEncounterId,
          characterId: testCharacterId,
        })
      ).rejects.toThrow();
    });
  });

  describe('addNpcParticipant', () => {
    it('should add an NPC participant', async () => {
      const participant = await participantRepo.addNpcParticipant({
        encounterId: testEncounterId,
        displayName: 'Goblin Chief',
        notes: 'Leader of the goblin ambush',
      });

      expect(participant.id).toBeDefined();
      expect(participant.kind).toBe('npc');
      expect(participant.displayName).toBe('Goblin Chief');
      expect(participant.characterId).toBeNull();
      expect(participant.notes).toBe('Leader of the goblin ambush');
    });

    it('should allow multiple NPCs with same name', async () => {
      const npc1 = await participantRepo.addNpcParticipant({
        encounterId: testEncounterId,
        displayName: 'Goblin',
      });

      const npc2 = await participantRepo.addNpcParticipant({
        encounterId: testEncounterId,
        displayName: 'Goblin',
      });

      expect(npc1.id).not.toBe(npc2.id);
    });
  });

  describe('setInitiative', () => {
    it('should set initiative for a participant', async () => {
      const participant = await participantRepo.addPcParticipant({
        encounterId: testEncounterId,
        characterId: testCharacterId,
      });

      await participantRepo.setInitiative(testEncounterId, participant.id, 15);

      const updated = await participantRepo.getParticipant(testEncounterId, participant.id);
      expect(updated!.initiative).toBe(15);
    });
  });

  describe('bulkSetInitiative', () => {
    it('should set initiative for multiple participants atomically', async () => {
      const pc = await participantRepo.addPcParticipant({
        encounterId: testEncounterId,
        characterId: testCharacterId,
      });

      const npc = await participantRepo.addNpcParticipant({
        encounterId: testEncounterId,
        displayName: 'Goblin',
      });

      await participantRepo.bulkSetInitiative(testEncounterId, [
        { participantId: pc.id, initiative: 18 },
        { participantId: npc.id, initiative: 12 },
      ]);

      const participants = await participantRepo.listParticipants(testEncounterId);
      expect(participants[0].initiative).toBe(18); // Higher initiative first
      expect(participants[1].initiative).toBe(12);
    });
  });

  describe('listParticipants', () => {
    it('should return participants sorted by initiative descending', async () => {
      const pc = await participantRepo.addPcParticipant({
        encounterId: testEncounterId,
        characterId: testCharacterId,
      });

      const npc1 = await participantRepo.addNpcParticipant({
        encounterId: testEncounterId,
        displayName: 'Fast Goblin',
      });

      const npc2 = await participantRepo.addNpcParticipant({
        encounterId: testEncounterId,
        displayName: 'Slow Goblin',
      });

      await participantRepo.bulkSetInitiative(testEncounterId, [
        { participantId: pc.id, initiative: 10 },
        { participantId: npc1.id, initiative: 20 },
        { participantId: npc2.id, initiative: 5 },
      ]);

      const participants = await participantRepo.listParticipants(testEncounterId);

      expect(participants).toHaveLength(3);
      expect(participants[0].displayName).toBe('Fast Goblin');
      expect(participants[1].displayName).toBe('Gandalf');
      expect(participants[2].displayName).toBe('Slow Goblin');
    });
  });

  describe('removeParticipant', () => {
    it('should remove a participant', async () => {
      const participant = await participantRepo.addNpcParticipant({
        encounterId: testEncounterId,
        displayName: 'Goblin',
      });

      await participantRepo.removeParticipant(testEncounterId, participant.id);

      const found = await participantRepo.getParticipant(testEncounterId, participant.id);
      expect(found).toBeNull();
    });

    it('should throw if participant not found', async () => {
      await expect(
        participantRepo.removeParticipant(testEncounterId, 'nonexistent')
      ).rejects.toThrow('Participant not found');
    });
  });

  describe('reorderParticipants', () => {
    it('should reorder participants by sort_order', async () => {
      const p1 = await participantRepo.addNpcParticipant({
        encounterId: testEncounterId,
        displayName: 'First',
      });

      const p2 = await participantRepo.addNpcParticipant({
        encounterId: testEncounterId,
        displayName: 'Second',
      });

      const p3 = await participantRepo.addNpcParticipant({
        encounterId: testEncounterId,
        displayName: 'Third',
      });

      // Reverse the order
      await participantRepo.reorderParticipants(testEncounterId, [p3.id, p2.id, p1.id]);

      // Without initiative, participants are sorted by sort_order
      const participants = await participantRepo.listParticipants(testEncounterId);
      expect(participants[0].displayName).toBe('Third');
      expect(participants[1].displayName).toBe('Second');
      expect(participants[2].displayName).toBe('First');
    });
  });
});

describe('EncounterEventRepo', () => {
  let client: SqliteClient;
  let encounterRepo: SqliteEncounterRepo;
  let eventRepo: SqliteEncounterEventRepo;
  let testEncounterId: string;

  beforeEach(async () => {
    client = await SqliteClient.create({ dbPath: ':memory:' });
    encounterRepo = new SqliteEncounterRepo(client.kysely);
    eventRepo = new SqliteEncounterEventRepo(client.kysely);

    const encounter = await encounterRepo.createEncounter({
      name: 'Test Encounter',
      guildId: 'guild-1',
      channelId: 'channel-1',
      createdByDiscordUserId: 'discord-user-1',
    });
    testEncounterId = encounter.id;
  });

  afterEach(async () => {
    await client.close();
  });

  describe('appendEvent', () => {
    it('should append an event', async () => {
      await eventRepo.appendEvent({
        encounterId: testEncounterId,
        actorDiscordUserId: 'user-1',
        eventType: 'ROUND_START',
        payload: { round: 1 },
      });

      const events = await eventRepo.listEvents(testEncounterId);
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('ROUND_START');
      expect(events[0].payload).toEqual({ round: 1 });
    });
  });

  describe('listEvents', () => {
    it('should list events in reverse chronological order', async () => {
      await eventRepo.appendEvent({
        encounterId: testEncounterId,
        eventType: 'FIRST',
      });

      await eventRepo.appendEvent({
        encounterId: testEncounterId,
        eventType: 'SECOND',
      });

      await eventRepo.appendEvent({
        encounterId: testEncounterId,
        eventType: 'THIRD',
      });

      const events = await eventRepo.listEvents(testEncounterId);
      expect(events[0].eventType).toBe('THIRD');
      expect(events[1].eventType).toBe('SECOND');
      expect(events[2].eventType).toBe('FIRST');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await eventRepo.appendEvent({
          encounterId: testEncounterId,
          eventType: `EVENT_${i}`,
        });
      }

      const events = await eventRepo.listEvents(testEncounterId, 2);
      expect(events).toHaveLength(2);
    });
  });
});
