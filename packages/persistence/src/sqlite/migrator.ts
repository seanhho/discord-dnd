import { Kysely, Migrator, type MigrationProvider, type Migration } from 'kysely';
import * as migration001 from './migrations/001_initial.js';
import * as migration003 from './migrations/003_dm_capability.js';
import * as migration004 from './migrations/004_character_creation_states.js';

/**
 * Static migration provider that bundles all migrations.
 * This avoids filesystem dependencies and works well with ESM.
 */
class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return {
      '001_initial': migration001,
      '003_dm_capability': migration003,
      '004_character_creation_states': migration004,
    };
  }
}

/**
 * Run all pending migrations.
 * @param db - Kysely database instance
 * @returns Migration results
 */
export async function runMigrations(db: Kysely<unknown>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: new StaticMigrationProvider(),
  });

  const { error, results } = await migrator.migrateToLatest();

  if (results) {
    for (const result of results) {
      if (result.status === 'Success') {
        console.log(`Migration "${result.migrationName}" executed successfully`);
      } else if (result.status === 'Error') {
        console.error(`Migration "${result.migrationName}" failed`);
      }
    }
  }

  if (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Roll back the last migration.
 * @param db - Kysely database instance
 */
export async function rollbackMigration(db: Kysely<unknown>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: new StaticMigrationProvider(),
  });

  const { error, results } = await migrator.migrateDown();

  if (results) {
    for (const result of results) {
      if (result.status === 'Success') {
        console.log(`Rolled back migration "${result.migrationName}"`);
      } else if (result.status === 'Error') {
        console.error(`Rollback of "${result.migrationName}" failed`);
      }
    }
  }

  if (error) {
    console.error('Rollback failed:', error);
    throw error;
  }
}
