import type { Kysely } from 'kysely';
import type {
  WizardStateRepo,
  WizardStateRecord,
} from '../ports/wizardStateRepo.js';
import type { Database, WizardStatesTable } from './schema.js';

/**
 * SQLite implementation of WizardStateRepo.
 */
export class SqliteWizardStateRepo implements WizardStateRepo {
  constructor(private readonly db: Kysely<Database>) {}

  async loadWizardState(instanceId: string): Promise<WizardStateRecord | null> {
    const row = await this.db
      .selectFrom('wizard_states')
      .selectAll()
      .where('instance_id', '=', instanceId)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    return {
      instanceId: row.instance_id,
      machineName: row.machine_name,
      machineVersion: row.machine_version,
      stateJson: row.state_json,
      expiresAt: row.expires_at,
      updatedAt: row.updated_at,
    };
  }

  async saveWizardState(record: WizardStateRecord): Promise<void> {
    const row: WizardStatesTable = {
      instance_id: record.instanceId,
      machine_name: record.machineName,
      machine_version: record.machineVersion,
      state_json: record.stateJson,
      expires_at: record.expiresAt,
      updated_at: record.updatedAt,
    };

    await this.db
      .insertInto('wizard_states')
      .values(row)
      .onConflict((oc) =>
        oc.column('instance_id').doUpdateSet({
          machine_name: record.machineName,
          machine_version: record.machineVersion,
          state_json: record.stateJson,
          expires_at: record.expiresAt,
          updated_at: record.updatedAt,
        })
      )
      .execute();
  }

  async deleteWizardState(instanceId: string): Promise<void> {
    await this.db
      .deleteFrom('wizard_states')
      .where('instance_id', '=', instanceId)
      .execute();
  }
}
