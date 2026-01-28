import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteClient, SqliteUserRepo } from '@discord-bot/persistence';
import type { UserRepo } from '@discord-bot/persistence';
import { setDm, listDms } from '../commands.js';

describe('Admin Commands', () => {
  let client: SqliteClient;
  let userRepo: UserRepo;

  beforeEach(async () => {
    // Create in-memory database for each test
    client = await SqliteClient.create({
      dbPath: ':memory:',
      runMigrations: true,
    });
    userRepo = new SqliteUserRepo(client.kysely);
  });

  afterEach(async () => {
    await client.close();
  });

  describe('setDm', () => {
    it('should grant DM capability to a new user', async () => {
      const result = await setDm(userRepo, {
        discordUserId: '123456789012345678',
        enabled: true,
      });

      expect(result.previousIsDm).toBe(false);
      expect(result.newIsDm).toBe(true);
      expect(result.changed).toBe(true);
      expect(result.user.isDm).toBe(true);
    });

    it('should grant DM capability to an existing user', async () => {
      // Pre-create user
      await userRepo.getOrCreateByDiscordUserId('123456789012345678');

      const result = await setDm(userRepo, {
        discordUserId: '123456789012345678',
        enabled: true,
      });

      expect(result.previousIsDm).toBe(false);
      expect(result.newIsDm).toBe(true);
      expect(result.changed).toBe(true);
    });

    it('should revoke DM capability', async () => {
      // Grant DM first
      await userRepo.setDmByDiscordUserId('123456789012345678', true);

      const result = await setDm(userRepo, {
        discordUserId: '123456789012345678',
        enabled: false,
      });

      expect(result.previousIsDm).toBe(true);
      expect(result.newIsDm).toBe(false);
      expect(result.changed).toBe(true);
      expect(result.user.isDm).toBe(false);
    });

    it('should report no change when already has requested status (true)', async () => {
      // Grant DM first
      await userRepo.setDmByDiscordUserId('123456789012345678', true);

      const result = await setDm(userRepo, {
        discordUserId: '123456789012345678',
        enabled: true,
      });

      expect(result.previousIsDm).toBe(true);
      expect(result.newIsDm).toBe(true);
      expect(result.changed).toBe(false);
    });

    it('should report no change when already has requested status (false)', async () => {
      // Create user (defaults to non-DM)
      await userRepo.getOrCreateByDiscordUserId('123456789012345678');

      const result = await setDm(userRepo, {
        discordUserId: '123456789012345678',
        enabled: false,
      });

      expect(result.previousIsDm).toBe(false);
      expect(result.newIsDm).toBe(false);
      expect(result.changed).toBe(false);
    });

    it('should persist DM status in database', async () => {
      await setDm(userRepo, {
        discordUserId: '123456789012345678',
        enabled: true,
      });

      // Verify via direct repo call
      const isDm = await userRepo.isDmByDiscordUserId('123456789012345678');
      expect(isDm).toBe(true);
    });
  });

  describe('listDms', () => {
    it('should return empty array when no DMs exist', async () => {
      const result = await listDms(userRepo);
      expect(result).toEqual([]);
    });

    it('should return all users with DM capability', async () => {
      // Create mix of DM and non-DM users
      await userRepo.setDmByDiscordUserId('111111111111111111', true);
      await userRepo.setDmByDiscordUserId('222222222222222222', true);
      await userRepo.getOrCreateByDiscordUserId('333333333333333333'); // non-DM

      const result = await listDms(userRepo);

      expect(result).toHaveLength(2);
      const discordIds = result.map((u) => u.discordUserId).sort();
      expect(discordIds).toEqual(['111111111111111111', '222222222222222222']);
    });

    it('should not include users with revoked DM capability', async () => {
      // Grant then revoke
      await userRepo.setDmByDiscordUserId('111111111111111111', true);
      await userRepo.setDmByDiscordUserId('111111111111111111', false);

      // Keep this one as DM
      await userRepo.setDmByDiscordUserId('222222222222222222', true);

      const result = await listDms(userRepo);

      expect(result).toHaveLength(1);
      expect(result[0].discordUserId).toBe('222222222222222222');
    });
  });
});
