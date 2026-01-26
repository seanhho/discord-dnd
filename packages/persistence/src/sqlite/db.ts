import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Database as DatabaseSchema } from './schema.js';
import { runMigrations } from './migrator.js';

/**
 * Configuration for SQLite database connection.
 */
export interface SqliteConfig {
  /**
   * Path to the SQLite database file.
   * Use ":memory:" for an in-memory database (useful for testing).
   * @default "./data/bot.sqlite"
   */
  dbPath?: string;
  /**
   * Whether to run migrations automatically on connect.
   * @default true
   */
  runMigrations?: boolean;
}

/**
 * SQLite database client wrapper.
 * Manages the Kysely instance and better-sqlite3 connection lifecycle.
 */
export class SqliteClient {
  private readonly db: Kysely<DatabaseSchema>;
  private readonly config: Required<SqliteConfig>;

  private constructor(db: Kysely<DatabaseSchema>, config: Required<SqliteConfig>) {
    this.db = db;
    this.config = config;
  }

  /**
   * Create and initialize a new SQLite client.
   * @param config - Database configuration
   */
  static async create(config: SqliteConfig = {}): Promise<SqliteClient> {
    const resolvedConfig: Required<SqliteConfig> = {
      dbPath: config.dbPath ?? process.env['DB_PATH'] ?? './data/bot.sqlite',
      runMigrations: config.runMigrations ?? true,
    };

    // Ensure directory exists for file-based databases
    if (resolvedConfig.dbPath !== ':memory:') {
      const dir = dirname(resolvedConfig.dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    // Create better-sqlite3 instance
    const sqliteDb = new Database(resolvedConfig.dbPath);

    // Enable WAL mode for better concurrent performance (file-based only)
    if (resolvedConfig.dbPath !== ':memory:') {
      sqliteDb.pragma('journal_mode = WAL');
    }

    // Enable foreign keys
    sqliteDb.pragma('foreign_keys = ON');

    // Create Kysely instance
    const db = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({
        database: sqliteDb,
      }),
    });

    const client = new SqliteClient(db, resolvedConfig);

    // Run migrations if enabled
    if (resolvedConfig.runMigrations) {
      await runMigrations(db as Kysely<unknown>);
    }

    return client;
  }

  /**
   * Get the Kysely database instance for queries.
   */
  get kysely(): Kysely<DatabaseSchema> {
    return this.db;
  }

  /**
   * Close the database connection.
   * Should be called when shutting down the application.
   */
  async close(): Promise<void> {
    await this.db.destroy();
    // Note: better-sqlite3 is synchronous and closes when Kysely destroys it
  }

  /**
   * Check if the database is using an in-memory connection.
   */
  get isInMemory(): boolean {
    return this.config.dbPath === ':memory:';
  }
}
