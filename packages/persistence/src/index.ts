/**
 * @discord-bot/persistence
 *
 * Persistence layer with repository interfaces (ports) and SQLite adapter.
 *
 * Usage:
 * ```typescript
 * import { SqliteClient, SqliteUserRepo, SqliteCharacterRepo } from '@discord-bot/persistence/sqlite';
 * import type { UserRepo, CharacterRepo } from '@discord-bot/persistence/ports';
 *
 * // Initialize
 * const client = await SqliteClient.create({ dbPath: './data/bot.sqlite' });
 * const userRepo: UserRepo = new SqliteUserRepo(client.kysely);
 * const characterRepo: CharacterRepo = new SqliteCharacterRepo(client.kysely);
 *
 * // Use repositories...
 * const user = await userRepo.getOrCreateByDiscordUserId('123456789');
 *
 * // Cleanup
 * await client.close();
 * ```
 */

// Re-export ports (interfaces and domain models)
export * from './ports/index.js';

// Re-export SQLite adapter
export * from './sqlite/index.js';
