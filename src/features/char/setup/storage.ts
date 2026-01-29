import type { StorageAdapter, StateMeta } from '@discord-bot/state-machine';
import type { WizardState } from './types.js';
import type { WizardStateRepo } from '../repo/ports.js';

export class WizardStateStorage implements StorageAdapter<WizardState> {
  constructor(
    private readonly repo: WizardStateRepo,
    private readonly machineName: string
  ) {}

  async load(instanceId: string) {
    const record = await this.repo.loadWizardState(instanceId);
    if (!record) {
      return null;
    }
    return {
      state: JSON.parse(record.stateJson) as WizardState,
      meta: {
        catalogVersion: record.machineVersion,
        updatedAt: new Date(record.updatedAt).toISOString(),
        stateKey: undefined,
      },
    };
  }

  async save(instanceId: string, state: WizardState, meta: StateMeta): Promise<void> {
    await this.repo.saveWizardState({
      instanceId,
      machineName: this.machineName,
      machineVersion: meta.catalogVersion,
      stateJson: JSON.stringify(state),
      expiresAt: state.expiresAt,
      updatedAt: new Date(meta.updatedAt).getTime(),
    });
  }

  async delete(instanceId: string): Promise<void> {
    await this.repo.deleteWizardState(instanceId);
  }
}
