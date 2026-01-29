/**
 * Tests for WizardStateRepo SQLite implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteClient } from '../../src/sqlite/db.js';
import { SqliteWizardStateRepo } from '../../src/sqlite/wizardStateRepo.js';

describe('WizardStateRepo', () => {
  let client: SqliteClient;
  let repo: SqliteWizardStateRepo;

  beforeEach(async () => {
    // Use in-memory database for tests
    client = await SqliteClient.create({ dbPath: ':memory:' });
    repo = new SqliteWizardStateRepo(client.kysely);
  });

  afterEach(async () => {
    await client.close();
  });

  describe('save and load', () => {
    it('should save and load wizard state', async () => {
      const now = Date.now();
      const expiresAt = now + 600000; // 10 minutes from now

      await repo.save({
        instanceId: 'test-instance-1',
        machineName: 'char-setup',
        machineVersion: '1.0.0',
        stateJson: JSON.stringify({ type: 'Identity', draft: {} }),
        expiresAt,
      });

      const loaded = await repo.load('test-instance-1');

      expect(loaded).not.toBeNull();
      expect(loaded!.instanceId).toBe('test-instance-1');
      expect(loaded!.machineName).toBe('char-setup');
      expect(loaded!.machineVersion).toBe('1.0.0');
      expect(loaded!.expiresAt).toBe(expiresAt);

      const state = JSON.parse(loaded!.stateJson);
      expect(state.type).toBe('Identity');
    });

    it('should return null for non-existent instance', async () => {
      const loaded = await repo.load('non-existent');
      expect(loaded).toBeNull();
    });

    it('should return null for expired instance', async () => {
      const expiredAt = Date.now() - 1000; // Already expired

      await repo.save({
        instanceId: 'expired-instance',
        machineName: 'char-setup',
        machineVersion: '1.0.0',
        stateJson: '{}',
        expiresAt: expiredAt,
      });

      const loaded = await repo.load('expired-instance');
      expect(loaded).toBeNull();
    });

    it('should update existing instance on save', async () => {
      const expiresAt = Date.now() + 600000;

      await repo.save({
        instanceId: 'test-instance',
        machineName: 'char-setup',
        machineVersion: '1.0.0',
        stateJson: JSON.stringify({ type: 'Identity' }),
        expiresAt,
      });

      await repo.save({
        instanceId: 'test-instance',
        machineName: 'char-setup',
        machineVersion: '1.0.0',
        stateJson: JSON.stringify({ type: 'Abilities' }),
        expiresAt,
      });

      const loaded = await repo.load('test-instance');
      const state = JSON.parse(loaded!.stateJson);
      expect(state.type).toBe('Abilities');
    });
  });

  describe('delete', () => {
    it('should delete wizard state', async () => {
      await repo.save({
        instanceId: 'to-delete',
        machineName: 'char-setup',
        machineVersion: '1.0.0',
        stateJson: '{}',
        expiresAt: Date.now() + 600000,
      });

      await repo.delete('to-delete');

      const loaded = await repo.load('to-delete');
      expect(loaded).toBeNull();
    });

    it('should not error when deleting non-existent instance', async () => {
      await expect(repo.delete('non-existent')).resolves.not.toThrow();
    });
  });

  describe('deleteExpired', () => {
    it('should delete expired states', async () => {
      const now = Date.now();

      // Create expired state
      await repo.save({
        instanceId: 'expired-1',
        machineName: 'char-setup',
        machineVersion: '1.0.0',
        stateJson: '{}',
        expiresAt: now - 1000,
      });

      // Create another expired state
      await repo.save({
        instanceId: 'expired-2',
        machineName: 'char-setup',
        machineVersion: '1.0.0',
        stateJson: '{}',
        expiresAt: now - 2000,
      });

      // Create valid state
      await repo.save({
        instanceId: 'valid',
        machineName: 'char-setup',
        machineVersion: '1.0.0',
        stateJson: '{}',
        expiresAt: now + 600000,
      });

      const deleted = await repo.deleteExpired();
      expect(deleted).toBe(2);

      // Valid state should still exist
      const valid = await repo.load('valid');
      expect(valid).not.toBeNull();
    });
  });

  describe('listByMachine', () => {
    it('should list states by machine name', async () => {
      const expiresAt = Date.now() + 600000;

      await repo.save({
        instanceId: 'char-1',
        machineName: 'char-setup',
        machineVersion: '1.0.0',
        stateJson: '{}',
        expiresAt,
      });

      await repo.save({
        instanceId: 'char-2',
        machineName: 'char-setup',
        machineVersion: '1.0.0',
        stateJson: '{}',
        expiresAt,
      });

      await repo.save({
        instanceId: 'other-1',
        machineName: 'other-machine',
        machineVersion: '1.0.0',
        stateJson: '{}',
        expiresAt,
      });

      const charSetupStates = await repo.listByMachine('char-setup');
      expect(charSetupStates).toHaveLength(2);
      expect(charSetupStates.map((s) => s.instanceId).sort()).toEqual(['char-1', 'char-2']);

      const otherStates = await repo.listByMachine('other-machine');
      expect(otherStates).toHaveLength(1);
    });

    it('should return empty array for unknown machine', async () => {
      const states = await repo.listByMachine('unknown');
      expect(states).toHaveLength(0);
    });
  });
});
