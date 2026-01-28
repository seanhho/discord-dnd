import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Migration: Convert from guild-scoped to user-scoped characters.
 *
 * Changes:
 * 1. Drop guild-based uniqueness constraint (user_id, guild_id, name_lower)
 * 2. Add user-based uniqueness constraint (user_id, name_lower)
 * 3. Make guild_id nullable (keep for historical data)
 * 4. Convert active_characters from (user_id, guild_id) to (user_id) only
 *
 * Migration strategy for active characters:
 * - If a user has multiple active characters across guilds, keep the most recently created one
 * - This is deterministic and favors the user's latest activity
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // SQLite doesn't support ALTER COLUMN, so we need to recreate tables

  // ============ CHARACTERS TABLE ============

  // 1. Check for name collisions within same user across guilds
  // If "Gandalf" exists in guild1 and guild2 for the same user, we need to handle it
  // Strategy: Keep the first one, rename duplicates with suffix
  const duplicates = await sql<{ user_id: string; name_lower: string; cnt: number }>`
    SELECT user_id, name_lower, COUNT(*) as cnt
    FROM characters
    GROUP BY user_id, name_lower
    HAVING COUNT(*) > 1
  `.execute(db);

  // Rename duplicates by appending _1, _2, etc.
  for (const dup of duplicates.rows) {
    const chars = await sql<{ id: string; name: string; guild_id: string }>`
      SELECT id, name, guild_id
      FROM characters
      WHERE user_id = ${dup.user_id} AND name_lower = ${dup.name_lower}
      ORDER BY created_at ASC
    `.execute(db);

    // Skip the first one (keep original), rename the rest
    for (let i = 1; i < chars.rows.length; i++) {
      const char = chars.rows[i]!;
      const newName = `${char.name}_${char.guild_id.slice(-4)}`;
      const newNameLower = newName.toLowerCase();
      await sql`
        UPDATE characters
        SET name = ${newName}, name_lower = ${newNameLower}
        WHERE id = ${char.id}
      `.execute(db);
    }
  }

  // 2. Create new characters table with user-scoped uniqueness
  await sql`
    CREATE TABLE characters_new (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      guild_id TEXT,
      name TEXT NOT NULL,
      name_lower TEXT NOT NULL,
      attributes TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `.execute(db);

  // 3. Copy data
  await sql`
    INSERT INTO characters_new (id, user_id, guild_id, name, name_lower, attributes, created_at, updated_at)
    SELECT id, user_id, guild_id, name, name_lower, attributes, created_at, updated_at
    FROM characters
  `.execute(db);

  // 4. Drop old table and rename new
  await sql`DROP TABLE characters`.execute(db);
  await sql`ALTER TABLE characters_new RENAME TO characters`.execute(db);

  // 5. Create user-scoped unique index
  await sql`
    CREATE UNIQUE INDEX idx_characters_unique_name ON characters(user_id, name_lower)
  `.execute(db);

  // 6. Create index for listing by user
  await sql`
    CREATE INDEX idx_characters_user ON characters(user_id)
  `.execute(db);

  // ============ ACTIVE_CHARACTERS TABLE ============

  // 1. Create new active_characters table with user-only key
  await sql`
    CREATE TABLE active_characters_new (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      updated_at TEXT NOT NULL
    )
  `.execute(db);

  // 2. Migrate data - for users with multiple active chars across guilds, keep most recent
  // Use a subquery to get the most recently set active character per user
  const timestamp = new Date().toISOString();
  await sql`
    INSERT INTO active_characters_new (user_id, character_id, updated_at)
    SELECT user_id, character_id, ${timestamp}
    FROM (
      SELECT user_id, character_id,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY ROWID DESC) as rn
      FROM active_characters
    )
    WHERE rn = 1
  `.execute(db);

  // 3. Drop old table and rename new
  await sql`DROP TABLE active_characters`.execute(db);
  await sql`ALTER TABLE active_characters_new RENAME TO active_characters`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Reverse migration - restore guild-scoped tables
  // Note: This may lose data if duplicates were renamed

  // ============ CHARACTERS TABLE ============
  await sql`
    CREATE TABLE characters_new (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      name_lower TEXT NOT NULL,
      attributes TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `.execute(db);

  // Copy data, using empty string for null guild_id
  await sql`
    INSERT INTO characters_new (id, user_id, guild_id, name, name_lower, attributes, created_at, updated_at)
    SELECT id, user_id, COALESCE(guild_id, ''), name, name_lower, attributes, created_at, updated_at
    FROM characters
  `.execute(db);

  await sql`DROP TABLE characters`.execute(db);
  await sql`ALTER TABLE characters_new RENAME TO characters`.execute(db);

  await sql`
    CREATE UNIQUE INDEX idx_characters_unique_name ON characters(user_id, guild_id, name_lower)
  `.execute(db);
  await sql`
    CREATE INDEX idx_characters_user_guild ON characters(user_id, guild_id)
  `.execute(db);

  // ============ ACTIVE_CHARACTERS TABLE ============
  await sql`
    CREATE TABLE active_characters_new (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      guild_id TEXT NOT NULL,
      character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE
    )
  `.execute(db);

  // Copy data with empty guild_id
  await sql`
    INSERT INTO active_characters_new (user_id, guild_id, character_id)
    SELECT user_id, '', character_id
    FROM active_characters
  `.execute(db);

  await sql`DROP TABLE active_characters`.execute(db);
  await sql`ALTER TABLE active_characters_new RENAME TO active_characters`.execute(db);

  await sql`
    CREATE UNIQUE INDEX idx_active_characters_pk ON active_characters(user_id, guild_id)
  `.execute(db);
}
