/**
 * Monster management feature slice.
 *
 * Provides commands for managing monsters and NPCs:
 * - /monster set - Set monster attributes (DM only)
 * - /monster active - Set active monster (DM only)
 * - /monster show - Show monster information
 * - /monster get - Get specific attributes
 * - /monster unset - Remove attributes (DM only)
 * - /monster list - List all monsters in guild
 *
 * Key differences from /char:
 * - Monsters are scoped per guild (not per user)
 * - Write operations require DM capability
 * - Key restrictions are RELAXED - any key is allowed (except forbidden ones)
 */

import type { FeatureSlice } from '../../core/types.js';
import { monsterCommand, handleMonsterCommand, setMonsterDeps } from './command.js';
import type { MonsterFeatureDeps } from './types.js';

/**
 * Monster feature slice definition.
 */
export const monsterFeature: FeatureSlice = {
  name: 'monster',
  command: monsterCommand,
  handler: handleMonsterCommand,
};

/**
 * Initialize the monster feature with its dependencies.
 * Must be called during app startup before handling commands.
 */
export function initMonsterFeature(deps: MonsterFeatureDeps): void {
  setMonsterDeps(deps);
}

// Re-export types and utilities that may be needed by other modules
export type { MonsterFeatureDeps, ShowView } from './types.js';
