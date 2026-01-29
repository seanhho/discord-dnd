/**
 * Kysely database schema types.
 * These types define the SQLite table structure for type-safe queries.
 * INTERNAL: These types should not be exported outside the sqlite module.
 */

/**
 * Users table schema
 */
export interface UsersTable {
  id: string;
  discord_user_id: string;
  /** 0 = false, 1 = true (SQLite boolean for DM capability) */
  is_dm: number;
  created_at: string;
  updated_at: string;
}

/**
 * Characters table schema
 */
export interface CharactersTable {
  id: string;
  user_id: string;
  guild_id: string;
  name: string;
  /** Lowercase name for case-insensitive uniqueness */
  name_lower: string;
  /** JSON-encoded Record<string, AttributeValue> */
  attributes: string;
  created_at: string;
  updated_at: string;
}

/**
 * Active character mapping table schema.
 * Composite primary key (user_id, guild_id) ensures only one active per scope.
 */
export interface ActiveCharactersTable {
  user_id: string;
  guild_id: string;
  character_id: string;
}

/**
 * Encounters table schema
 */
export interface EncountersTable {
  id: string;
  name: string;
  /** setup | initiative | running | paused | ended */
  status: string;
  guild_id: string | null;
  channel_id: string;
  thread_id: string | null;
  created_by_discord_user_id: string;
  round: number;
  turn_index: number;
  /** 0 = false, 1 = true */
  initiative_locked: number;
  created_at: number;
  updated_at: number;
}

/**
 * Encounter participants table schema
 */
export interface EncounterParticipantsTable {
  id: string;
  encounter_id: string;
  /** pc | npc */
  kind: string;
  display_name: string;
  initiative: number | null;
  sort_order: number | null;
  character_id: string | null;
  discord_user_id: string | null;
  npc_ref: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Encounter events table schema (audit/debug)
 */
export interface EncounterEventsTable {
  id: string;
  encounter_id: string;
  created_at: number;
  actor_discord_user_id: string | null;
  event_type: string;
  payload_json: string | null;
}

/**
 * Complete database schema
 */
export interface Database {
  users: UsersTable;
  characters: CharactersTable;
  active_characters: ActiveCharactersTable;
  encounters: EncountersTable;
  encounter_participants: EncounterParticipantsTable;
  encounter_events: EncounterEventsTable;
}
