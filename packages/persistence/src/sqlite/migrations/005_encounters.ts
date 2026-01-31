import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Migration: Create encounters, encounter_participants, and encounter_events tables.
 *
 * Design choices:
 * - turn_index (int) approach for turn pointer - simpler and works well with sorted participant lists
 * - ONE non-ended encounter per (guild_id, channel_id, thread_id) context enforced by partial unique index
 * - NPCs store minimal identity only (display_name, notes), no stat blocks
 * - character_id uniqueness per encounter enforced by partial unique index
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // Encounters table
  await db.schema
    .createTable('encounters')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('setup'))
    .addColumn('guild_id', 'text') // nullable for DMs
    .addColumn('channel_id', 'text', (col) => col.notNull())
    .addColumn('thread_id', 'text') // nullable
    .addColumn('created_by_discord_user_id', 'text', (col) => col.notNull())
    .addColumn('round', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('turn_index', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('initiative_locked', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'integer', (col) => col.notNull())
    .addColumn('updated_at', 'integer', (col) => col.notNull())
    .execute();

  // Add CHECK constraint for status
  await sql`
    CREATE TRIGGER check_encounter_status_insert
    BEFORE INSERT ON encounters
    BEGIN
      SELECT CASE
        WHEN NEW.status NOT IN ('setup', 'initiative', 'running', 'paused', 'ended')
        THEN RAISE(ABORT, 'Invalid encounter status')
      END;
    END
  `.execute(db);

  await sql`
    CREATE TRIGGER check_encounter_status_update
    BEFORE UPDATE OF status ON encounters
    BEGIN
      SELECT CASE
        WHEN NEW.status NOT IN ('setup', 'initiative', 'running', 'paused', 'ended')
        THEN RAISE(ABORT, 'Invalid encounter status')
      END;
    END
  `.execute(db);

  // Index for querying encounters by context and status
  await db.schema
    .createIndex('idx_encounters_context_status')
    .on('encounters')
    .columns(['guild_id', 'channel_id', 'thread_id', 'status'])
    .execute();

  // Partial unique index: only ONE non-ended encounter per context
  // SQLite treats NULL as unique, so we use COALESCE to normalize NULLs
  await sql`
    CREATE UNIQUE INDEX idx_encounters_active_context
    ON encounters(COALESCE(guild_id, ''), channel_id, COALESCE(thread_id, ''))
    WHERE status != 'ended'
  `.execute(db);

  // Encounter participants table
  await db.schema
    .createTable('encounter_participants')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('encounter_id', 'text', (col) =>
      col.notNull().references('encounters.id').onDelete('cascade')
    )
    .addColumn('kind', 'text', (col) => col.notNull())
    .addColumn('display_name', 'text', (col) => col.notNull())
    .addColumn('initiative', 'integer') // nullable until set
    .addColumn('sort_order', 'integer') // precomputed order for faster queries
    .addColumn('character_id', 'text', (col) =>
      col.references('characters.id').onDelete('cascade')
    ) // FK for PCs
    .addColumn('discord_user_id', 'text') // convenience for PCs
    .addColumn('npc_ref', 'text') // uuid/slug for NPCs
    .addColumn('notes', 'text') // notes for NPCs
    .addColumn('created_at', 'integer', (col) => col.notNull())
    .addColumn('updated_at', 'integer', (col) => col.notNull())
    .execute();

  // Add CHECK constraint for kind
  await sql`
    CREATE TRIGGER check_participant_kind_insert
    BEFORE INSERT ON encounter_participants
    BEGIN
      SELECT CASE
        WHEN NEW.kind NOT IN ('pc', 'npc')
        THEN RAISE(ABORT, 'Invalid participant kind')
      END;
    END
  `.execute(db);

  await sql`
    CREATE TRIGGER check_participant_kind_update
    BEFORE UPDATE OF kind ON encounter_participants
    BEGIN
      SELECT CASE
        WHEN NEW.kind NOT IN ('pc', 'npc')
        THEN RAISE(ABORT, 'Invalid participant kind')
      END;
    END
  `.execute(db);

  // Enforce: PC must have character_id, NPC must not
  await sql`
    CREATE TRIGGER check_participant_pc_character_insert
    BEFORE INSERT ON encounter_participants
    BEGIN
      SELECT CASE
        WHEN NEW.kind = 'pc' AND NEW.character_id IS NULL
        THEN RAISE(ABORT, 'PC participant must have character_id')
        WHEN NEW.kind = 'npc' AND NEW.character_id IS NOT NULL
        THEN RAISE(ABORT, 'NPC participant must not have character_id')
      END;
    END
  `.execute(db);

  await sql`
    CREATE TRIGGER check_participant_pc_character_update
    BEFORE UPDATE ON encounter_participants
    BEGIN
      SELECT CASE
        WHEN NEW.kind = 'pc' AND NEW.character_id IS NULL
        THEN RAISE(ABORT, 'PC participant must have character_id')
        WHEN NEW.kind = 'npc' AND NEW.character_id IS NOT NULL
        THEN RAISE(ABORT, 'NPC participant must not have character_id')
      END;
    END
  `.execute(db);

  // Index for listing participants by encounter
  await db.schema
    .createIndex('idx_encounter_participants_encounter')
    .on('encounter_participants')
    .column('encounter_id')
    .execute();

  // Partial unique index: prevent same character being added twice to same encounter
  await sql`
    CREATE UNIQUE INDEX idx_encounter_participants_unique_character
    ON encounter_participants(encounter_id, character_id)
    WHERE character_id IS NOT NULL
  `.execute(db);

  // Encounter events table (optional, for audit/debug)
  await db.schema
    .createTable('encounter_events')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('encounter_id', 'text', (col) =>
      col.notNull().references('encounters.id').onDelete('cascade')
    )
    .addColumn('created_at', 'integer', (col) => col.notNull())
    .addColumn('actor_discord_user_id', 'text')
    .addColumn('event_type', 'text', (col) => col.notNull())
    .addColumn('payload_json', 'text')
    .execute();

  // Index for listing events by encounter
  await db.schema
    .createIndex('idx_encounter_events_encounter_created')
    .on('encounter_events')
    .columns(['encounter_id', 'created_at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Drop triggers first
  await sql`DROP TRIGGER IF EXISTS check_encounter_status_insert`.execute(db);
  await sql`DROP TRIGGER IF EXISTS check_encounter_status_update`.execute(db);
  await sql`DROP TRIGGER IF EXISTS check_participant_kind_insert`.execute(db);
  await sql`DROP TRIGGER IF EXISTS check_participant_kind_update`.execute(db);
  await sql`DROP TRIGGER IF EXISTS check_participant_pc_character_insert`.execute(db);
  await sql`DROP TRIGGER IF EXISTS check_participant_pc_character_update`.execute(db);

  // Drop tables
  await db.schema.dropTable('encounter_events').execute();
  await db.schema.dropTable('encounter_participants').execute();
  await db.schema.dropTable('encounters').execute();
}
