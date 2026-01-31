import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SqliteClient,
  SqliteUserRepo,
  SqliteMonsterRepo,
  AttrValue,
} from '../../src/index.js';
import type { MonsterRepo, Monster } from '../../src/ports/index.js';

describe('MonsterRepo', () => {
  let client: SqliteClient;
  let monsterRepo: MonsterRepo;
  const guildId = '987654321098765432';

  beforeEach(async () => {
    // Create in-memory database for each test
    client = await SqliteClient.create({
      dbPath: ':memory:',
      runMigrations: true,
    });
    monsterRepo = new SqliteMonsterRepo(client.kysely);
  });

  afterEach(async () => {
    await client.close();
  });

  describe('createMonster', () => {
    it('should create a monster', async () => {
      const monster = await monsterRepo.createMonster({
        guildId,
        name: 'Goblin',
      });

      expect(monster).toBeDefined();
      expect(monster.id).toBeDefined();
      expect(monster.guildId).toBe(guildId);
      expect(monster.name).toBe('Goblin');
      expect(monster.attributes).toEqual({});
      expect(monster.createdAt).toBeDefined();
      expect(monster.updatedAt).toBeDefined();
    });

    it('should enforce case-insensitive name uniqueness per guild', async () => {
      await monsterRepo.createMonster({
        guildId,
        name: 'Goblin',
      });

      await expect(
        monsterRepo.createMonster({
          guildId,
          name: 'GOBLIN',
        })
      ).rejects.toThrow('already exists');
    });

    it('should allow same name in different guilds', async () => {
      const monster1 = await monsterRepo.createMonster({
        guildId: 'guild1',
        name: 'Goblin',
      });

      const monster2 = await monsterRepo.createMonster({
        guildId: 'guild2',
        name: 'Goblin',
      });

      expect(monster1.id).not.toBe(monster2.id);
    });
  });

  describe('getMonsterByName', () => {
    it('should get monster by name (case-insensitive)', async () => {
      await monsterRepo.createMonster({
        guildId,
        name: 'Goblin',
      });

      const found = await monsterRepo.getMonsterByName({
        guildId,
        name: 'GOBLIN',
      });

      expect(found).not.toBeNull();
      expect(found?.name).toBe('Goblin');
    });

    it('should return null for non-existent monster', async () => {
      const found = await monsterRepo.getMonsterByName({
        guildId,
        name: 'NonExistent',
      });

      expect(found).toBeNull();
    });

    it('should not find monster from different guild', async () => {
      await monsterRepo.createMonster({
        guildId: 'guild1',
        name: 'Goblin',
      });

      const found = await monsterRepo.getMonsterByName({
        guildId: 'guild2',
        name: 'Goblin',
      });

      expect(found).toBeNull();
    });
  });

  describe('listMonsters', () => {
    it('should list monsters by guild', async () => {
      await monsterRepo.createMonster({
        guildId,
        name: 'Goblin',
      });
      await monsterRepo.createMonster({
        guildId,
        name: 'Orc',
      });
      await monsterRepo.createMonster({
        guildId: 'other-guild',
        name: 'Dragon',
      });

      const monsters = await monsterRepo.listMonsters({ guildId });

      expect(monsters).toHaveLength(2);
      expect(monsters.map((m) => m.name).sort()).toEqual(['Goblin', 'Orc']);
    });

    it('should return empty array when no monsters exist', async () => {
      const monsters = await monsterRepo.listMonsters({ guildId });

      expect(monsters).toHaveLength(0);
    });
  });

  describe('updateMonsterAttributes', () => {
    let monster: Monster;

    beforeEach(async () => {
      monster = await monsterRepo.createMonster({
        guildId,
        name: 'Goblin',
      });
    });

    it('should update attributes by merging', async () => {
      const updated = await monsterRepo.updateMonsterAttributes({
        monsterId: monster.id,
        patch: {
          ac: AttrValue.num(15),
          'hp.max': AttrValue.num(22),
        },
      });

      expect(updated.attributes).toEqual({
        ac: { t: 'n', v: 15 },
        'hp.max': { t: 'n', v: 22 },
      });

      // Merge more
      const updated2 = await monsterRepo.updateMonsterAttributes({
        monsterId: monster.id,
        patch: {
          ac: AttrValue.num(16),
          speed: AttrValue.num(30),
        },
      });

      expect(updated2.attributes).toEqual({
        ac: { t: 'n', v: 16 },
        'hp.max': { t: 'n', v: 22 },
        speed: { t: 'n', v: 30 },
      });
    });

    it('should support all attribute types', async () => {
      const updated = await monsterRepo.updateMonsterAttributes({
        monsterId: monster.id,
        patch: {
          ac: AttrValue.num(15),
          legendary: AttrValue.bool(false),
          name: AttrValue.str('Goblin Boss'),
        },
      });

      expect(updated.attributes).toEqual({
        ac: { t: 'n', v: 15 },
        legendary: { t: 'b', v: false },
        name: { t: 's', v: 'Goblin Boss' },
      });
    });

    it('should support arbitrary keys (not restricted to allowlist)', async () => {
      // Monster keys are NOT restricted like character keys
      const updated = await monsterRepo.updateMonsterAttributes({
        monsterId: monster.id,
        patch: {
          'attack.bite.name': AttrValue.str('Bite'),
          'attack.bite.bonus': AttrValue.num(4),
          'attack.bite.damage': AttrValue.str('1d6+2'),
          customAttribute: AttrValue.str('custom value'),
          'deeply.nested.key.path': AttrValue.num(42),
        },
      });

      expect(updated.attributes['attack.bite.name']).toEqual({ t: 's', v: 'Bite' });
      expect(updated.attributes['attack.bite.bonus']).toEqual({ t: 'n', v: 4 });
      expect(updated.attributes['customAttribute']).toEqual({ t: 's', v: 'custom value' });
      expect(updated.attributes['deeply.nested.key.path']).toEqual({ t: 'n', v: 42 });
    });

    it('should throw when updating non-existent monster', async () => {
      await expect(
        monsterRepo.updateMonsterAttributes({
          monsterId: 'non-existent',
          patch: { ac: AttrValue.num(15) },
        })
      ).rejects.toThrow('Monster not found');
    });
  });

  describe('unsetMonsterAttributes', () => {
    let monster: Monster;

    beforeEach(async () => {
      monster = await monsterRepo.createMonster({
        guildId,
        name: 'Goblin',
      });
      await monsterRepo.updateMonsterAttributes({
        monsterId: monster.id,
        patch: {
          ac: AttrValue.num(15),
          'hp.max': AttrValue.num(22),
          speed: AttrValue.num(30),
        },
      });
    });

    it('should unset specific attributes', async () => {
      const updated = await monsterRepo.unsetMonsterAttributes({
        monsterId: monster.id,
        keys: ['ac', 'nonexistent'],
      });

      expect(updated.attributes).toEqual({
        'hp.max': { t: 'n', v: 22 },
        speed: { t: 'n', v: 30 },
      });
    });

    it('should handle unsetting all attributes', async () => {
      const updated = await monsterRepo.unsetMonsterAttributes({
        monsterId: monster.id,
        keys: ['ac', 'hp.max', 'speed'],
      });

      expect(updated.attributes).toEqual({});
    });

    it('should throw when unsetting from non-existent monster', async () => {
      await expect(
        monsterRepo.unsetMonsterAttributes({
          monsterId: 'non-existent',
          keys: ['ac'],
        })
      ).rejects.toThrow('Monster not found');
    });
  });

  describe('active monster', () => {
    it('should return null when no active monster is set', async () => {
      const active = await monsterRepo.getActiveMonster({ guildId });

      expect(active).toBeNull();
    });

    it('should set and get active monster', async () => {
      const goblin = await monsterRepo.createMonster({
        guildId,
        name: 'Goblin',
      });

      await monsterRepo.setActiveMonster({
        guildId,
        monsterId: goblin.id,
      });

      const active = await monsterRepo.getActiveMonster({ guildId });

      expect(active).not.toBeNull();
      expect(active?.id).toBe(goblin.id);
      expect(active?.name).toBe('Goblin');
    });

    it('should switch active monster', async () => {
      const goblin = await monsterRepo.createMonster({
        guildId,
        name: 'Goblin',
      });
      const orc = await monsterRepo.createMonster({
        guildId,
        name: 'Orc',
      });

      // Set first as active
      await monsterRepo.setActiveMonster({
        guildId,
        monsterId: goblin.id,
      });

      let active = await monsterRepo.getActiveMonster({ guildId });
      expect(active?.id).toBe(goblin.id);

      // Switch to second
      await monsterRepo.setActiveMonster({
        guildId,
        monsterId: orc.id,
      });

      active = await monsterRepo.getActiveMonster({ guildId });
      expect(active?.id).toBe(orc.id);
    });

    it('should maintain separate active monsters per guild', async () => {
      const guild1 = 'guild1';
      const guild2 = 'guild2';

      const goblin = await monsterRepo.createMonster({
        guildId: guild1,
        name: 'Goblin',
      });
      const dragon = await monsterRepo.createMonster({
        guildId: guild2,
        name: 'Dragon',
      });

      await monsterRepo.setActiveMonster({
        guildId: guild1,
        monsterId: goblin.id,
      });
      await monsterRepo.setActiveMonster({
        guildId: guild2,
        monsterId: dragon.id,
      });

      const active1 = await monsterRepo.getActiveMonster({ guildId: guild1 });
      const active2 = await monsterRepo.getActiveMonster({ guildId: guild2 });

      expect(active1?.name).toBe('Goblin');
      expect(active2?.name).toBe('Dragon');
    });

    it('should throw when setting active for non-existent monster', async () => {
      await expect(
        monsterRepo.setActiveMonster({
          guildId,
          monsterId: 'non-existent',
        })
      ).rejects.toThrow('Monster not found');
    });

    it('should throw when setting active for monster in wrong guild', async () => {
      const monster = await monsterRepo.createMonster({
        guildId: 'other-guild',
        name: 'Goblin',
      });

      await expect(
        monsterRepo.setActiveMonster({
          guildId, // Different from monster's guild
          monsterId: monster.id,
        })
      ).rejects.toThrow('does not belong');
    });
  });

  describe('full integration scenario', () => {
    it('should handle complete monster lifecycle', async () => {
      // 1. Create two monsters
      const goblin = await monsterRepo.createMonster({
        guildId,
        name: 'Goblin',
      });
      const orc = await monsterRepo.createMonster({
        guildId,
        name: 'Orc',
      });

      expect(goblin.name).toBe('Goblin');
      expect(orc.name).toBe('Orc');

      // 2. Set goblin as active
      await monsterRepo.setActiveMonster({
        guildId,
        monsterId: goblin.id,
      });

      let active = await monsterRepo.getActiveMonster({ guildId });
      expect(active?.id).toBe(goblin.id);

      // 3. Switch to orc
      await monsterRepo.setActiveMonster({
        guildId,
        monsterId: orc.id,
      });

      active = await monsterRepo.getActiveMonster({ guildId });
      expect(active?.id).toBe(orc.id);
      expect(active?.name).toBe('Orc');

      // 4. Update attributes on orc
      const updated = await monsterRepo.updateMonsterAttributes({
        monsterId: orc.id,
        patch: {
          ac: AttrValue.num(13),
          'hp.max': AttrValue.num(15),
          str: AttrValue.num(16),
          'attack.greataxe.name': AttrValue.str('Greataxe'),
          'attack.greataxe.bonus': AttrValue.num(5),
        },
      });

      expect(updated.attributes).toEqual({
        ac: { t: 'n', v: 13 },
        'hp.max': { t: 'n', v: 15 },
        str: { t: 'n', v: 16 },
        'attack.greataxe.name': { t: 's', v: 'Greataxe' },
        'attack.greataxe.bonus': { t: 'n', v: 5 },
      });

      // 5. Unset some keys
      const afterUnset = await monsterRepo.unsetMonsterAttributes({
        monsterId: orc.id,
        keys: ['attack.greataxe.name', 'attack.greataxe.bonus'],
      });

      expect(afterUnset.attributes).toEqual({
        ac: { t: 'n', v: 13 },
        'hp.max': { t: 'n', v: 15 },
        str: { t: 'n', v: 16 },
      });

      // 6. Verify active monster still has updated attributes
      active = await monsterRepo.getActiveMonster({ guildId });
      expect(active?.attributes).toEqual({
        ac: { t: 'n', v: 13 },
        'hp.max': { t: 'n', v: 15 },
        str: { t: 'n', v: 16 },
      });

      // 7. List all monsters
      const monsters = await monsterRepo.listMonsters({ guildId });
      expect(monsters).toHaveLength(2);
    });
  });
});
