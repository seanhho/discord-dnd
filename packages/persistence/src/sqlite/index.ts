/**
 * SQLite adapter module.
 * Exports the SQLite client and repository implementations.
 */

export { SqliteClient } from './db.js';
export type { SqliteConfig } from './db.js';
export { SqliteUserRepo } from './userRepo.js';
export { SqliteCharacterRepo } from './characterRepo.js';
export { SqliteEncounterRepo } from './encounterRepo.js';
export { SqliteEncounterParticipantRepo } from './encounterParticipantRepo.js';
export { SqliteEncounterEventRepo } from './encounterEventRepo.js';
export { SqliteMonsterRepo } from './monsterRepo.js';
export { runMigrations, rollbackMigration } from './migrator.js';
