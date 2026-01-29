import type { Kysely } from 'kysely';

/**
 * Migration 004: Add character creation state storage.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('character_creation_states')
    .addColumn('instance_id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) =>
      col.notNull().references('users.id').onDelete('cascade')
    )
    .addColumn('guild_id', 'text', (col) => col.notNull())
    .addColumn('state', 'text', (col) => col.notNull())
    .addColumn('meta', 'text', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) => col.notNull())
    .addColumn('updated_at', 'text', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('idx_character_creation_states_user_guild')
    .on('character_creation_states')
    .columns(['user_id', 'guild_id'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('character_creation_states').execute();
}
