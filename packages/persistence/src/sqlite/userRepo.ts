import type { Kysely } from 'kysely';
import { randomUUID } from 'node:crypto';
import type { User } from '../ports/models.js';
import type { UserRepo } from '../ports/userRepo.js';
import type { Database, UsersTable } from './schema.js';

/**
 * Map database row to domain User model.
 */
function toUser(row: UsersTable): User {
  return {
    id: row.id,
    discordUserId: row.discord_user_id,
    isDm: row.is_dm === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get current ISO timestamp.
 */
function now(): string {
  return new Date().toISOString();
}

/**
 * SQLite implementation of UserRepo.
 */
export class SqliteUserRepo implements UserRepo {
  constructor(private readonly db: Kysely<Database>) {}

  async getOrCreateByDiscordUserId(discordUserId: string): Promise<User> {
    // Try to find existing user first
    const existing = await this.db
      .selectFrom('users')
      .selectAll()
      .where('discord_user_id', '=', discordUserId)
      .executeTakeFirst();

    if (existing) {
      return toUser(existing);
    }

    // Create new user
    const timestamp = now();
    const newUser: UsersTable = {
      id: randomUUID(),
      discord_user_id: discordUserId,
      is_dm: 0,
      created_at: timestamp,
      updated_at: timestamp,
    };

    await this.db.insertInto('users').values(newUser).execute();

    return toUser(newUser);
  }

  async getById(id: string): Promise<User | null> {
    const row = await this.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? toUser(row) : null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DM (Dungeon Master) Capability
  // ─────────────────────────────────────────────────────────────────────────────

  async setUserDmStatus(userId: string, isDm: boolean): Promise<void> {
    const result = await this.db
      .updateTable('users')
      .set({
        is_dm: isDm ? 1 : 0,
        updated_at: now(),
      })
      .where('id', '=', userId)
      .executeTakeFirst();

    if (result.numUpdatedRows === 0n) {
      throw new Error(`User not found: ${userId}`);
    }
  }

  async isUserDm(userId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('users')
      .select('is_dm')
      .where('id', '=', userId)
      .executeTakeFirst();

    return row?.is_dm === 1;
  }

  async setDmByDiscordUserId(discordUserId: string, isDm: boolean): Promise<void> {
    // Get or create the user first
    const user = await this.getOrCreateByDiscordUserId(discordUserId);
    // Then set their DM status
    await this.setUserDmStatus(user.id, isDm);
  }

  async isDmByDiscordUserId(discordUserId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('users')
      .select('is_dm')
      .where('discord_user_id', '=', discordUserId)
      .executeTakeFirst();

    // Returns false if user doesn't exist (no auto-create)
    return row?.is_dm === 1;
  }

  async listDmUsers(): Promise<User[]> {
    const rows = await this.db
      .selectFrom('users')
      .selectAll()
      .where('is_dm', '=', 1)
      .orderBy('discord_user_id', 'asc')
      .execute();

    return rows.map(toUser);
  }
}
