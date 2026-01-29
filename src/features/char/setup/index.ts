/**
 * Character Setup Wizard Module
 *
 * Interactive wizard for creating D&D 5e characters.
 */

export {
  initWizardHandler,
  handleSetupStart,
  handleSetupResume,
  handleSetupCancel,
  handleWizardButton,
  handleWizardModal,
  isWizardInteraction,
  type WizardHandlerDeps,
} from './handler.js';

export { wizardCatalog } from './catalog.js';
export { wizardMachineDefinition } from './machine.js';
export { createWizardStorageAdapter } from './storage.js';

export type {
  WizardState,
  WizardEvent,
  WizardEffect,
  WizardContext,
  CharacterDraft,
} from './types.js';
export {
  MACHINE_NAME,
  MACHINE_VERSION,
  WIZARD_TIMEOUT_SECONDS,
  getInstanceId,
  parseInstanceId,
} from './types.js';
