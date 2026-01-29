import type { Kysely } from 'kysely';

/**
 * Migration: Create wizard_states table for persisting state machine state.
 *
 * This table stores wizard/state machine instances that need to survive restarts.
 * Examples: character creation wizard, interactive setup flows.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('wizard_states')
    .addColumn('instance_id', 'text', (col) => col.primaryKey())
    .addColumn('machine_name', 'text', (col) => col.notNull())
    .addColumn('machine_version', 'text', (col) => col.notNull())
    .addColumn('state_json', 'text', (col) => col.notNull())
    .addColumn('expires_at', 'integer', (col) => col.notNull())
    .addColumn('updated_at', 'integer', (col) => col.notNull())
    .execute();

  // Index for listing by machine and cleanup queries
  await db.schema
    .createIndex('idx_wizard_states_machine')
    .on('wizard_states')
    .column('machine_name')
    .execute();

  // Index for expiration cleanup
  await db.schema
    .createIndex('idx_wizard_states_expires')
    .on('wizard_states')
    .column('expires_at')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('wizard_states').execute();
}
