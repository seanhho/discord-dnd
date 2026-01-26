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
}
