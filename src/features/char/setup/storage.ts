/**
 * Storage Adapter for Character Setup Wizard
 *
 * Bridges the state machine storage interface with our persistence layer.
 */

import type { StorageAdapter, StoredState, StateMeta } from '@discord-bot/state-machine';
import type { WizardStateRepo } from '@discord-bot/persistence';
import type { WizardState } from './types.js';
import { MACHINE_NAME, MACHINE_VERSION } from './types.js';

/**
 * Creates a storage adapter that persists wizard state to the database.
 */
export function createWizardStorageAdapter(
  repo: WizardStateRepo
): StorageAdapter<WizardState> {
  return {
    async load(instanceId: string): Promise<StoredState<WizardState> | null> {
      const stored = await repo.load(instanceId);
      if (!stored) return null;

      try {
        const state = JSON.parse(stored.stateJson) as WizardState;
        const meta: StateMeta = {
          catalogVersion: stored.machineVersion,
          updatedAt: new Date(stored.updatedAt).toISOString(),
          stateKey: state.type,
        };
        return { state, meta };
      } catch {
        // Corrupted state - delete it
        await repo.delete(instanceId);
        return null;
      }
    },

    async save(
      instanceId: string,
      state: WizardState,
      meta: StateMeta
    ): Promise<void> {
      // Calculate expiration based on state
      let expiresAt: number;
      if ('expiresAt' in state && typeof state.expiresAt === 'number') {
        expiresAt = state.expiresAt;
      } else {
        // Terminal states expire immediately (cleanup on next load)
        expiresAt = Date.now();
      }

      await repo.save({
        instanceId,
        machineName: MACHINE_NAME,
        machineVersion: meta.catalogVersion || MACHINE_VERSION,
        stateJson: JSON.stringify(state),
        expiresAt,
      });
    },

    async delete(instanceId: string): Promise<void> {
      await repo.delete(instanceId);
    },
  };
}
