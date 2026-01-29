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
 * Wizard state storage table schema.
 */
export interface WizardStatesTable {
  instance_id: string;
  machine_name: string;
  machine_version: string;
  state_json: string;
  expires_at: number;
  updated_at: number;
}

/**
 * Complete database schema
 */
export interface Database {
  users: UsersTable;
  characters: CharactersTable;
  active_characters: ActiveCharactersTable;
  wizard_states: WizardStatesTable;
}
