/**
 * Character Setup Wizard Catalog
 *
 * Human-readable state definitions for documentation and validation.
 */

import type { StateCatalog } from '@discord-bot/state-machine';
import type { WizardEvent } from './types.js';
import { WIZARD_TIMEOUT_SECONDS, MACHINE_NAME, MACHINE_VERSION } from './types.js';

/**
 * State catalog for the character setup wizard.
 */
export const wizardCatalog: StateCatalog<WizardEvent> = {
  machineName: MACHINE_NAME,
  version: MACHINE_VERSION,
  description: 'Interactive character creation wizard for D&D 5e',

  states: {
    Idle: {
      summary: 'Wizard not started',
      description: 'Initial state before user starts the wizard.',
      allowedEvents: ['START'],
      terminal: false,
    },

    Identity: {
      summary: 'Step 1: Character Identity',
      description: 'Collecting character name, class, level, and optional race/background.',
      allowedEvents: [
        'SET_IDENTITY',
        'SET_MESSAGE_ID',
        'NEXT',
        'CANCEL',
        'TIMEOUT',
      ],
      timeout: {
        seconds: WIZARD_TIMEOUT_SECONDS,
        onTimeoutEvent: { type: 'TIMEOUT' },
      },
      view: {
        templateId: 'identity',
        title: 'Character Identity',
        description: 'Step 1 of 3 - Enter basic character information',
      },
    },

    Abilities: {
      summary: 'Step 2: Ability Scores',
      description: 'Collecting the six ability scores (STR, DEX, CON, INT, WIS, CHA).',
      allowedEvents: [
        'SET_ABILITIES',
        'SET_MESSAGE_ID',
        'NEXT',
        'BACK',
        'CANCEL',
        'TIMEOUT',
      ],
      timeout: {
        seconds: WIZARD_TIMEOUT_SECONDS,
        onTimeoutEvent: { type: 'TIMEOUT' },
      },
      view: {
        templateId: 'abilities',
        title: 'Ability Scores',
        description: 'Step 2 of 3 - Enter your ability scores (1-30)',
      },
    },

    Review: {
      summary: 'Step 3: Review',
      description: 'Showing summary of all entered data before final commit.',
      allowedEvents: [
        'CONFIRM',
        'BACK',
        'CANCEL',
        'TIMEOUT',
      ],
      timeout: {
        seconds: WIZARD_TIMEOUT_SECONDS,
        onTimeoutEvent: { type: 'TIMEOUT' },
      },
      view: {
        templateId: 'review',
        title: 'Review Character',
        description: 'Step 3 of 3 - Review and confirm your character',
      },
    },

    Committing: {
      summary: 'Saving character',
      description: 'Character data is being saved to the database.',
      allowedEvents: ['COMMIT_SUCCESS', 'COMMIT_ERROR'],
      view: {
        templateId: 'committing',
        title: 'Saving...',
        description: 'Creating your character',
      },
    },

    Done: {
      summary: 'Wizard completed',
      description: 'Character was created/updated successfully.',
      allowedEvents: [],
      terminal: true,
      view: {
        templateId: 'done',
        title: 'Character Created!',
        description: 'Your character is ready to use',
      },
    },

    Cancelled: {
      summary: 'Wizard cancelled',
      description: 'User cancelled the wizard.',
      allowedEvents: [],
      terminal: true,
    },

    Expired: {
      summary: 'Wizard expired',
      description: 'Wizard timed out due to inactivity.',
      allowedEvents: [],
      terminal: true,
    },

    Error: {
      summary: 'Error state',
      description: 'An error occurred during the wizard.',
      allowedEvents: [],
      terminal: true,
    },
  },

  transitionTable: [
    { fromStateKey: 'Idle', eventType: 'START', toStateKey: 'Identity', description: 'Begin wizard' },
    { fromStateKey: 'Identity', eventType: 'NEXT', toStateKey: 'Abilities', description: 'Proceed to abilities' },
    { fromStateKey: 'Identity', eventType: 'CANCEL', toStateKey: 'Cancelled', description: 'Cancel wizard' },
    { fromStateKey: 'Identity', eventType: 'TIMEOUT', toStateKey: 'Expired', description: 'Timeout' },
    { fromStateKey: 'Abilities', eventType: 'NEXT', toStateKey: 'Review', description: 'Proceed to review' },
    { fromStateKey: 'Abilities', eventType: 'BACK', toStateKey: 'Identity', description: 'Back to identity' },
    { fromStateKey: 'Abilities', eventType: 'CANCEL', toStateKey: 'Cancelled', description: 'Cancel wizard' },
    { fromStateKey: 'Abilities', eventType: 'TIMEOUT', toStateKey: 'Expired', description: 'Timeout' },
    { fromStateKey: 'Review', eventType: 'CONFIRM', toStateKey: 'Committing', description: 'Confirm and save' },
    { fromStateKey: 'Review', eventType: 'BACK', toStateKey: 'Abilities', description: 'Back to abilities' },
    { fromStateKey: 'Review', eventType: 'CANCEL', toStateKey: 'Cancelled', description: 'Cancel wizard' },
    { fromStateKey: 'Review', eventType: 'TIMEOUT', toStateKey: 'Expired', description: 'Timeout' },
    { fromStateKey: 'Committing', eventType: 'COMMIT_SUCCESS', toStateKey: 'Done', description: 'Save succeeded' },
    { fromStateKey: 'Committing', eventType: 'COMMIT_ERROR', toStateKey: 'Error', description: 'Save failed' },
  ],
};
