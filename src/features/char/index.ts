/**
 * Character management feature slice.
 *
 * Provides commands for managing characters:
 * - /char set - Set character attributes
 * - /char active - Set active character
 * - /char show - Show character information
 * - /char get - Get specific attributes
 * - /char unset - Remove attributes
 * - /char setup start|resume|cancel - Character creation wizard
 */

import type { FeatureSlice } from '../../core/types.js';
import { charCommand, handleCharCommand, setCharacterDeps } from './command.js';
import type { CharacterFeatureDeps } from './repo/ports.js';
import {
  initWizardHandler,
  handleWizardButton,
  handleWizardModal,
  isWizardInteraction,
  type WizardHandlerDeps,
} from './setup/index.js';

/**
 * Character feature slice definition.
 */
export const charFeature: FeatureSlice = {
  name: 'char',
  command: charCommand,
  handler: handleCharCommand,
};

/**
 * Extended dependencies including wizard support.
 */
export interface CharacterFeatureFullDeps extends CharacterFeatureDeps, WizardHandlerDeps {}

/**
 * Initialize the character feature with its dependencies.
 * Must be called during app startup before handling commands.
 */
export function initCharFeature(deps: CharacterFeatureDeps): void {
  setCharacterDeps(deps);
}

/**
 * Initialize the wizard handler (call after initCharFeature if using wizard).
 */
export function initCharWizard(deps: WizardHandlerDeps): void {
  initWizardHandler(deps);
}

// Re-export types and utilities that may be needed by other modules
export type { CharacterFeatureDeps } from './repo/ports.js';
export type { ShowView } from './types.js';

// Re-export wizard interaction handlers
export { handleWizardButton, handleWizardModal, isWizardInteraction };
