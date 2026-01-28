import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SqliteClient,
  SqliteUserRepo,
  SqliteCharacterRepo,
  AttrValue,
} from '../../src/index.js';
import type {
  UserRepo,
  CharacterRepo,
  User,
  Character,
} from '../../src/ports/index.js';

describe('SQLite Repositories', () => {
  let client: SqliteClient;
  let userRepo: UserRepo;
  let characterRepo: CharacterRepo;

  beforeEach(async () => {
    // Create in-memory database for each test
    client = await SqliteClient.create({
      dbPath: ':memory:',
      runMigrations: true,
    });
    userRepo = new SqliteUserRepo(client.kysely);
    characterRepo = new SqliteCharacterRepo(client.kysely);
  });

  afterEach(async () => {
    await client.close();
  });

  describe('UserRepo', () => {
    it('should create a new user when discord user id does not exist', async () => {
      const discordUserId = '123456789012345678';

      const user = await userRepo.getOrCreateByDiscordUserId(discordUserId);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.discordUserId).toBe(discordUserId);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
      // Validate ISO format
      expect(() => new Date(user.createdAt)).not.toThrow();
    });

    it('should return existing user when discord user id exists', async () => {
      const discordUserId = '123456789012345678';

      const user1 = await userRepo.getOrCreateByDiscordUserId(discordUserId);
      const user2 = await userRepo.getOrCreateByDiscordUserId(discordUserId);

      expect(user1.id).toBe(user2.id);
      expect(user1.discordUserId).toBe(user2.discordUserId);
    });

    it('should get user by id', async () => {
      const discordUserId = '123456789012345678';
      const created = await userRepo.getOrCreateByDiscordUserId(discordUserId);

      const found = await userRepo.getById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent user id', async () => {
      const found = await userRepo.getById('non-existent-uuid');

      expect(found).toBeNull();
    });

    describe('DM capability', () => {
      it('should default isDm to false for new users', async () => {
        const user = await userRepo.getOrCreateByDiscordUserId('123456789012345678');

        expect(user.isDm).toBe(false);
      });

      it('should set DM status to true via setUserDmStatus', async () => {
        const user = await userRepo.getOrCreateByDiscordUserId('123456789012345678');

        await userRepo.setUserDmStatus(user.id, true);

        const isDm = await userRepo.isUserDm(user.id);
        expect(isDm).toBe(true);
      });

      it('should set DM status to false via setUserDmStatus', async () => {
        const user = await userRepo.getOrCreateByDiscordUserId('123456789012345678');

        // First set to true
        await userRepo.setUserDmStatus(user.id, true);
        expect(await userRepo.isUserDm(user.id)).toBe(true);

        // Then set back to false
        await userRepo.setUserDmStatus(user.id, false);
        expect(await userRepo.isUserDm(user.id)).toBe(false);
      });

      it('should throw when setting DM status for non-existent user', async () => {
        await expect(
          userRepo.setUserDmStatus('non-existent-uuid', true)
        ).rejects.toThrow('User not found');
      });

      it('should return false for isUserDm when user does not exist', async () => {
        const isDm = await userRepo.isUserDm('non-existent-uuid');
        expect(isDm).toBe(false);
      });

      it('should set DM status via setDmByDiscordUserId', async () => {
        const discordUserId = '123456789012345678';

        // Should create user and set DM status
        await userRepo.setDmByDiscordUserId(discordUserId, true);

        const isDm = await userRepo.isDmByDiscordUserId(discordUserId);
        expect(isDm).toBe(true);
      });

      it('should revoke DM status via setDmByDiscordUserId', async () => {
        const discordUserId = '123456789012345678';

        // Grant DM
        await userRepo.setDmByDiscordUserId(discordUserId, true);
        expect(await userRepo.isDmByDiscordUserId(discordUserId)).toBe(true);

        // Revoke DM
        await userRepo.setDmByDiscordUserId(discordUserId, false);
        expect(await userRepo.isDmByDiscordUserId(discordUserId)).toBe(false);
      });

      it('should return false for isDmByDiscordUserId when user does not exist', async () => {
        const isDm = await userRepo.isDmByDiscordUserId('non-existent-discord-id');
        expect(isDm).toBe(false);
      });

      it('should list all DM users', async () => {
        // Create several users
        await userRepo.setDmByDiscordUserId('111111111111111111', true);
        await userRepo.setDmByDiscordUserId('222222222222222222', false);
        await userRepo.setDmByDiscordUserId('333333333333333333', true);
        await userRepo.getOrCreateByDiscordUserId('444444444444444444'); // Non-DM

        const dmUsers = await userRepo.listDmUsers();

        expect(dmUsers).toHaveLength(2);
        const discordIds = dmUsers.map((u) => u.discordUserId).sort();
        expect(discordIds).toEqual(['111111111111111111', '333333333333333333']);
        expect(dmUsers.every((u) => u.isDm === true)).toBe(true);
      });

      it('should return empty array when no DM users exist', async () => {
        // Create some non-DM users
        await userRepo.getOrCreateByDiscordUserId('111111111111111111');
        await userRepo.getOrCreateByDiscordUserId('222222222222222222');

        const dmUsers = await userRepo.listDmUsers();

        expect(dmUsers).toHaveLength(0);
      });

      it('should update updated_at when changing DM status', async () => {
        const user = await userRepo.getOrCreateByDiscordUserId('123456789012345678');
        const originalUpdatedAt = user.updatedAt;

        // Small delay to ensure timestamp changes
        await new Promise((resolve) => setTimeout(resolve, 10));

        await userRepo.setUserDmStatus(user.id, true);
        const updatedUser = await userRepo.getById(user.id);

        expect(updatedUser?.updatedAt).not.toBe(originalUpdatedAt);
      });
    });
  });

  describe('CharacterRepo', () => {
    let user: User;
    const guildId = '987654321098765432';

    beforeEach(async () => {
      user = await userRepo.getOrCreateByDiscordUserId('123456789012345678');
    });

    it('should create a character', async () => {
      const character = await characterRepo.createCharacter({
        userId: user.id,
        guildId,
        name: 'Gandalf',
      });

      expect(character).toBeDefined();
      expect(character.id).toBeDefined();
      expect(character.userId).toBe(user.id);
      expect(character.guildId).toBe(guildId);
      expect(character.name).toBe('Gandalf');
      expect(character.attributes).toEqual({});
    });

    it('should enforce case-insensitive name uniqueness per user+guild', async () => {
      await characterRepo.createCharacter({
        userId: user.id,
        guildId,
        name: 'Gandalf',
      });

      await expect(
        characterRepo.createCharacter({
          userId: user.id,
          guildId,
          name: 'GANDALF',
        })
      ).rejects.toThrow('already exists');
    });

    it('should allow same name in different guilds', async () => {
      const char1 = await characterRepo.createCharacter({
        userId: user.id,
        guildId: 'guild1',
        name: 'Gandalf',
      });

      const char2 = await characterRepo.createCharacter({
        userId: user.id,
        guildId: 'guild2',
        name: 'Gandalf',
      });

      expect(char1.id).not.toBe(char2.id);
    });

    it('should get character by name (case-insensitive)', async () => {
      await characterRepo.createCharacter({
        userId: user.id,
        guildId,
        name: 'Gandalf',
      });

      const found = await characterRepo.getByName({
        userId: user.id,
        guildId,
        name: 'GANDALF',
      });

      expect(found).not.toBeNull();
      expect(found?.name).toBe('Gandalf');
    });

    it('should list characters by user in guild', async () => {
      await characterRepo.createCharacter({
        userId: user.id,
        guildId,
        name: 'Aragorn',
      });
      await characterRepo.createCharacter({
        userId: user.id,
        guildId,
        name: 'Legolas',
      });
      await characterRepo.createCharacter({
        userId: user.id,
        guildId: 'other-guild',
        name: 'Gimli',
      });

      const chars = await characterRepo.listByUser({
        userId: user.id,
        guildId,
      });

      expect(chars).toHaveLength(2);
      expect(chars.map((c) => c.name)).toEqual(['Aragorn', 'Legolas']);
    });

    describe('attributes', () => {
      let character: Character;

      beforeEach(async () => {
        character = await characterRepo.createCharacter({
          userId: user.id,
          guildId,
          name: 'Gandalf',
        });
      });

      it('should update attributes by merging', async () => {
        const updated = await characterRepo.updateAttributes({
          characterId: character.id,
          patch: {
            level: AttrValue.num(20),
            class: AttrValue.str('wizard'),
          },
        });

        expect(updated.attributes).toEqual({
          level: { t: 'n', v: 20 },
          class: { t: 's', v: 'wizard' },
        });

        // Merge more
        const updated2 = await characterRepo.updateAttributes({
          characterId: character.id,
          patch: {
            level: AttrValue.num(21),
            hasStaff: AttrValue.bool(true),
          },
        });

        expect(updated2.attributes).toEqual({
          level: { t: 'n', v: 21 },
          class: { t: 's', v: 'wizard' },
          hasStaff: { t: 'b', v: true },
        });
      });

      it('should unset specific attributes', async () => {
        await characterRepo.updateAttributes({
          characterId: character.id,
          patch: {
            level: AttrValue.num(20),
            class: AttrValue.str('wizard'),
            hasStaff: AttrValue.bool(true),
          },
        });

        const updated = await characterRepo.unsetAttributes({
          characterId: character.id,
          keys: ['class', 'nonexistent'],
        });

        expect(updated.attributes).toEqual({
          level: { t: 'n', v: 20 },
          hasStaff: { t: 'b', v: true },
        });
      });

      it('should throw when updating non-existent character', async () => {
        await expect(
          characterRepo.updateAttributes({
            characterId: 'non-existent',
            patch: { level: AttrValue.num(1) },
          })
        ).rejects.toThrow('Character not found');
      });
    });

    describe('active character', () => {
      it('should return null when no active character is set', async () => {
        const active = await characterRepo.getActiveCharacter({
          userId: user.id,
          guildId,
        });

        expect(active).toBeNull();
      });

      it('should set and get active character', async () => {
        const char1 = await characterRepo.createCharacter({
          userId: user.id,
          guildId,
          name: 'Aragorn',
        });

        await characterRepo.setActiveCharacter({
          userId: user.id,
          guildId,
          characterId: char1.id,
        });

        const active = await characterRepo.getActiveCharacter({
          userId: user.id,
          guildId,
        });

        expect(active).not.toBeNull();
        expect(active?.id).toBe(char1.id);
        expect(active?.name).toBe('Aragorn');
      });

      it('should switch active character', async () => {
        const char1 = await characterRepo.createCharacter({
          userId: user.id,
          guildId,
          name: 'Aragorn',
        });
        const char2 = await characterRepo.createCharacter({
          userId: user.id,
          guildId,
          name: 'Legolas',
        });

        // Set first as active
        await characterRepo.setActiveCharacter({
          userId: user.id,
          guildId,
          characterId: char1.id,
        });

        let active = await characterRepo.getActiveCharacter({
          userId: user.id,
          guildId,
        });
        expect(active?.id).toBe(char1.id);

        // Switch to second
        await characterRepo.setActiveCharacter({
          userId: user.id,
          guildId,
          characterId: char2.id,
        });

        active = await characterRepo.getActiveCharacter({
          userId: user.id,
          guildId,
        });
        expect(active?.id).toBe(char2.id);
      });

      it('should maintain separate active characters per guild', async () => {
        const guild1 = 'guild1';
        const guild2 = 'guild2';

        const char1 = await characterRepo.createCharacter({
          userId: user.id,
          guildId: guild1,
          name: 'Aragorn',
        });
        const char2 = await characterRepo.createCharacter({
          userId: user.id,
          guildId: guild2,
          name: 'Legolas',
        });

        await characterRepo.setActiveCharacter({
          userId: user.id,
          guildId: guild1,
          characterId: char1.id,
        });
        await characterRepo.setActiveCharacter({
          userId: user.id,
          guildId: guild2,
          characterId: char2.id,
        });

        const active1 = await characterRepo.getActiveCharacter({
          userId: user.id,
          guildId: guild1,
        });
        const active2 = await characterRepo.getActiveCharacter({
          userId: user.id,
          guildId: guild2,
        });

        expect(active1?.name).toBe('Aragorn');
        expect(active2?.name).toBe('Legolas');
      });

      it('should throw when setting active for non-existent character', async () => {
        await expect(
          characterRepo.setActiveCharacter({
            userId: user.id,
            guildId,
            characterId: 'non-existent',
          })
        ).rejects.toThrow('Character not found');
      });

      it('should throw when setting active for character in wrong guild', async () => {
        const char = await characterRepo.createCharacter({
          userId: user.id,
          guildId: 'other-guild',
          name: 'Aragorn',
        });

        await expect(
          characterRepo.setActiveCharacter({
            userId: user.id,
            guildId, // Different from character's guild
            characterId: char.id,
          })
        ).rejects.toThrow('does not belong');
      });
    });

    describe('full integration scenario', () => {
      it('should handle complete character lifecycle', async () => {
        // 1. Create user
        const testUser = await userRepo.getOrCreateByDiscordUserId(
          '999888777666555444'
        );
        expect(testUser.id).toBeDefined();

        // 2. Create two characters
        const wizard = await characterRepo.createCharacter({
          userId: testUser.id,
          guildId,
          name: 'Merlin',
        });
        const warrior = await characterRepo.createCharacter({
          userId: testUser.id,
          guildId,
          name: 'Conan',
        });

        expect(wizard.name).toBe('Merlin');
        expect(warrior.name).toBe('Conan');

        // 3. Set wizard as active
        await characterRepo.setActiveCharacter({
          userId: testUser.id,
          guildId,
          characterId: wizard.id,
        });

        let active = await characterRepo.getActiveCharacter({
          userId: testUser.id,
          guildId,
        });
        expect(active?.id).toBe(wizard.id);

        // 4. Switch to warrior
        await characterRepo.setActiveCharacter({
          userId: testUser.id,
          guildId,
          characterId: warrior.id,
        });

        active = await characterRepo.getActiveCharacter({
          userId: testUser.id,
          guildId,
        });
        expect(active?.id).toBe(warrior.id);
        expect(active?.name).toBe('Conan');

        // 5. Update attributes on warrior
        const updated = await characterRepo.updateAttributes({
          characterId: warrior.id,
          patch: {
            strength: AttrValue.num(18),
            class: AttrValue.str('barbarian'),
            berserker: AttrValue.bool(true),
          },
        });

        expect(updated.attributes).toEqual({
          strength: { t: 'n', v: 18 },
          class: { t: 's', v: 'barbarian' },
          berserker: { t: 'b', v: true },
        });

        // 6. Unset some keys
        const afterUnset = await characterRepo.unsetAttributes({
          characterId: warrior.id,
          keys: ['berserker'],
        });

        expect(afterUnset.attributes).toEqual({
          strength: { t: 'n', v: 18 },
          class: { t: 's', v: 'barbarian' },
        });
        expect(afterUnset.attributes['berserker']).toBeUndefined();

        // 7. Verify active character still has updated attributes
        active = await characterRepo.getActiveCharacter({
          userId: testUser.id,
          guildId,
        });
        expect(active?.attributes).toEqual({
          strength: { t: 'n', v: 18 },
          class: { t: 's', v: 'barbarian' },
        });
      });
    });
  });
});
