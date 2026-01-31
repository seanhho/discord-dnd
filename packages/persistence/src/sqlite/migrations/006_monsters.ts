import type { Kysely } from 'kysely';

/**
 * Migration: Create monsters and active_monsters tables.
 *
 * Design choices:
 * - Monsters are scoped per guild (not per user)
 * - Any user with DM capability can create/edit monsters
 * - Name uniqueness is case-insensitive per guild
 * - Active monster is per guild (one active monster per guild)
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // Monsters table
  await db.schema
    .createTable('monsters')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('guild_id', 'text', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('name_lower', 'text', (col) => col.notNull())
    .addColumn('attributes', 'text', (col) => col.notNull().defaultTo('{}'))
    .addColumn('created_at', 'text', (col) => col.notNull())
    .addColumn('updated_at', 'text', (col) => col.notNull())
    .execute();

  // Unique constraint on (guild_id, name_lower) for case-insensitive name uniqueness
  await db.schema
    .createIndex('idx_monsters_unique_name')
    .on('monsters')
    .columns(['guild_id', 'name_lower'])
    .unique()
    .execute();

  // Index for listing monsters by guild
  await db.schema
    .createIndex('idx_monsters_guild')
    .on('monsters')
    .column('guild_id')
    .execute();

  // Active monsters table (one active monster per guild)
  await db.schema
    .createTable('active_monsters')
    .addColumn('guild_id', 'text', (col) => col.primaryKey())
    .addColumn('monster_id', 'text', (col) =>
      col.notNull().references('monsters.id').onDelete('cascade')
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('active_monsters').execute();
  await db.schema.dropTable('monsters').execute();
}
