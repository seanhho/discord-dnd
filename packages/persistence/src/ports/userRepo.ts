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
}
