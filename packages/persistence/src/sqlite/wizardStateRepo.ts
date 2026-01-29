/**
 * SQLite implementation of WizardStateRepo.
 */

import type { Kysely } from 'kysely';
import type { Database } from './schema.js';
import type {
  WizardStateRepo,
  WizardState,
  SaveWizardStateParams,
} from '../ports/wizardStateRepo.js';

export class SqliteWizardStateRepo implements WizardStateRepo {
  constructor(private readonly db: Kysely<Database>) {}

  async load(instanceId: string): Promise<WizardState | null> {
    const now = Date.now();

    const row = await this.db
      .selectFrom('wizard_states')
      .selectAll()
      .where('instance_id', '=', instanceId)
      .where('expires_at', '>', now)
      .executeTakeFirst();

    if (!row) return null;

    return {
      instanceId: row.instance_id,
      machineName: row.machine_name,
      machineVersion: row.machine_version,
      stateJson: row.state_json,
      expiresAt: row.expires_at,
      updatedAt: row.updated_at,
    };
  }

  async save(params: SaveWizardStateParams): Promise<void> {
    const now = Date.now();

    await this.db
      .insertInto('wizard_states')
      .values({
        instance_id: params.instanceId,
        machine_name: params.machineName,
        machine_version: params.machineVersion,
        state_json: params.stateJson,
        expires_at: params.expiresAt,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc.column('instance_id').doUpdateSet({
          machine_name: params.machineName,
          machine_version: params.machineVersion,
          state_json: params.stateJson,
          expires_at: params.expiresAt,
          updated_at: now,
        })
      )
      .execute();
  }

  async delete(instanceId: string): Promise<void> {
    await this.db
      .deleteFrom('wizard_states')
      .where('instance_id', '=', instanceId)
      .execute();
  }

  async deleteExpired(): Promise<number> {
    const now = Date.now();

    const result = await this.db
      .deleteFrom('wizard_states')
      .where('expires_at', '<=', now)
      .executeTakeFirst();

    return Number(result.numDeletedRows);
  }

  async listByMachine(machineName: string): Promise<WizardState[]> {
    const rows = await this.db
      .selectFrom('wizard_states')
      .selectAll()
      .where('machine_name', '=', machineName)
      .orderBy('updated_at', 'desc')
      .execute();

    return rows.map((row) => ({
      instanceId: row.instance_id,
      machineName: row.machine_name,
      machineVersion: row.machine_version,
      stateJson: row.state_json,
      expiresAt: row.expires_at,
      updatedAt: row.updated_at,
    }));
  }
}
