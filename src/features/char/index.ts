/**
 * Character management feature slice.
 *
 * Provides commands for managing characters:
 * - /char set - Set character attributes
 * - /char active - Set active character
 * - /char show - Show character information
 * - /char get - Get specific attributes
 * - /char unset - Remove attributes
 */

import type { FeatureSlice } from '../../core/types.js';
import {
  charCommand,
  handleCharCommand,
  handleCharInteraction,
  setCharacterDeps,
} from './command.js';
import type { CharacterFeatureDeps } from './repo/ports.js';
import { initWizardRuntime } from './setup/handlers.js';

/**
 * Character feature slice definition.
 */
export const charFeature: FeatureSlice = {
  name: 'char',
  command: charCommand,
  handler: handleCharCommand,
  interactionHandler: handleCharInteraction,
};

/**
 * Initialize the character feature with its dependencies.
 * Must be called during app startup before handling commands.
 */
export function initCharFeature(deps: CharacterFeatureDeps): void {
  setCharacterDeps(deps);
  initWizardRuntime(deps);
}

// Re-export types and utilities that may be needed by other modules
export type { CharacterFeatureDeps } from './repo/ports.js';
export type { ShowView } from './types.js';
