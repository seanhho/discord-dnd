import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Initial migration: Create users, characters, and active_characters tables.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // Users table
  await db.schema
    .createTable('users')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('discord_user_id', 'text', (col) => col.notNull().unique())
    .addColumn('created_at', 'text', (col) => col.notNull())
    .addColumn('updated_at', 'text', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('idx_users_discord_user_id')
    .on('users')
    .column('discord_user_id')
    .execute();

  // Characters table
  await db.schema
    .createTable('characters')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) =>
      col.notNull().references('users.id').onDelete('cascade')
    )
    .addColumn('guild_id', 'text', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('name_lower', 'text', (col) => col.notNull())
    .addColumn('attributes', 'text', (col) => col.notNull().defaultTo('{}'))
    .addColumn('created_at', 'text', (col) => col.notNull())
    .addColumn('updated_at', 'text', (col) => col.notNull())
    .execute();

  // Unique constraint on (user_id, guild_id, name_lower) for case-insensitive name uniqueness
  await db.schema
    .createIndex('idx_characters_unique_name')
    .on('characters')
    .columns(['user_id', 'guild_id', 'name_lower'])
    .unique()
    .execute();

  // Index for listing characters by user+guild
  await db.schema
    .createIndex('idx_characters_user_guild')
    .on('characters')
    .columns(['user_id', 'guild_id'])
    .execute();

  // Active characters table (junction for tracking which character is active per user+guild)
  await db.schema
    .createTable('active_characters')
    .addColumn('user_id', 'text', (col) =>
      col.notNull().references('users.id').onDelete('cascade')
    )
    .addColumn('guild_id', 'text', (col) => col.notNull())
    .addColumn('character_id', 'text', (col) =>
      col.notNull().references('characters.id').onDelete('cascade')
    )
    .execute();

  // Composite primary key for active_characters
  await sql`CREATE UNIQUE INDEX idx_active_characters_pk ON active_characters(user_id, guild_id)`.execute(
    db
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('active_characters').execute();
  await db.schema.dropTable('characters').execute();
  await db.schema.dropTable('users').execute();
}
