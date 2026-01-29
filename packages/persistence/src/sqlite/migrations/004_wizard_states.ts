import type { Kysely } from 'kysely';

/**
 * Migration 004: Add wizard state persistence.
 *
 * Adds wizard_states table for storing state machine instances.
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
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('wizard_states').execute();
}
