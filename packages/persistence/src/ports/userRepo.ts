import type { User } from './models.js';

/**
 * User repository interface (port).
 * Defines operations for user persistence without exposing implementation details.
 */
export interface UserRepo {
  /**
   * Get an existing user by Discord user ID, or create a new one if not found.
   * This is the primary way to resolve Discord users to internal users.
   *
   * @param discordUserId - Discord snowflake user ID
   * @returns The existing or newly created user
   */
  getOrCreateByDiscordUserId(discordUserId: string): Promise<User>;

  /**
   * Get a user by internal ID.
   *
   * @param id - Internal UUID
   * @returns The user if found, null otherwise
   */
  getById(id: string): Promise<User | null>;

  // ─────────────────────────────────────────────────────────────────────────────
  // DM (Dungeon Master) Capability
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Set the DM capability status for a user by internal ID.
   * This should only be called by admin tooling, not feature code.
   *
   * @param userId - Internal UUID
   * @param isDm - Whether the user should have DM capability
   * @throws Error if user not found
   */
  setUserDmStatus(userId: string, isDm: boolean): Promise<void>;

  /**
   * Check if a user has DM capability by internal ID.
   *
   * @param userId - Internal UUID
   * @returns true if user has DM capability, false otherwise (including if user not found)
   */
  isUserDm(userId: string): Promise<boolean>;

  /**
   * Set the DM capability status for a user by Discord user ID.
   * Creates the user if they don't exist.
   * This should only be called by admin tooling, not feature code.
   *
   * @param discordUserId - Discord snowflake user ID
   * @param isDm - Whether the user should have DM capability
   */
  setDmByDiscordUserId(discordUserId: string, isDm: boolean): Promise<void>;

  /**
   * Check if a user has DM capability by Discord user ID.
   * Does NOT create the user if they don't exist.
   *
   * @param discordUserId - Discord snowflake user ID
   * @returns true if user exists and has DM capability, false otherwise
   */
  isDmByDiscordUserId(discordUserId: string): Promise<boolean>;

  /**
   * List all users with DM capability.
   * Used by admin tooling to audit DM assignments.
   *
   * @returns Array of users with isDm = true
   */
  listDmUsers(): Promise<User[]>;
}
