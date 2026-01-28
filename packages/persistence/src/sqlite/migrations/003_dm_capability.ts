import type { Kysely } from 'kysely';

/**
 * Migration 003: Add DM (Dungeon Master) capability to users.
 *
 * Adds an is_dm boolean column to the users table.
 * DM capability is global per user (not guild-scoped) and determines
 * whether a user can perform DM-only actions (encounters, NPC control, etc.).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('is_dm', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('users').dropColumn('is_dm').execute();
}
