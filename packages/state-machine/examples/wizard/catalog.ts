/**
 * Wizard example - State Catalog
 */

import type { StateCatalog } from '../../src/index.js';
import type { WizardEvent } from './types.js';

export const wizardCatalog: StateCatalog<WizardEvent> = {
  machineName: 'CharacterCreationWizard',
  version: '1.0.0',
  description: 'A step-by-step wizard for creating a new RPG character.',

  states: {
    Idle: {
      summary: 'Wizard not started',
      description: 'Waiting for the user to begin character creation.',
      allowedEvents: ['START'],
      tags: ['initial'],
    },

    Step1: {
      summary: 'Enter character name',
      description: 'First step: the user enters their character name.',
      allowedEvents: ['SET_NAME', 'NEXT', 'CANCEL', 'TIMEOUT'],
      timeout: {
        seconds: 300, // 5 minutes
        onTimeoutEvent: { type: 'TIMEOUT' },
      },
      view: {
        templateId: 'wizard-step1',
        title: 'Step 1: Character Name',
      },
      tags: ['step', 'input'],
    },

    Step2: {
      summary: 'Select character class',
      description: 'Second step: the user selects their character class.',
      allowedEvents: ['SET_CLASS', 'SET_LEVEL', 'NEXT', 'BACK', 'CANCEL', 'TIMEOUT'],
      timeout: {
        seconds: 300,
        onTimeoutEvent: { type: 'TIMEOUT' },
      },
      view: {
        templateId: 'wizard-step2',
        title: 'Step 2: Class & Level',
      },
      tags: ['step', 'input'],
    },

    Review: {
      summary: 'Review character details',
      description: 'Final review before submission.',
      allowedEvents: ['SUBMIT', 'BACK', 'CANCEL', 'TIMEOUT'],
      timeout: {
        seconds: 600, // 10 minutes
        onTimeoutEvent: { type: 'TIMEOUT' },
      },
      view: {
        templateId: 'wizard-review',
        title: 'Review Your Character',
      },
      tags: ['step', 'review'],
    },

    Done: {
      summary: 'Character created successfully',
      description: 'The wizard has completed and the character is created.',
      allowedEvents: [],
      terminal: true,
      tags: ['terminal', 'success'],
    },

    Cancelled: {
      summary: 'Wizard cancelled',
      description: 'The user cancelled the wizard or it timed out.',
      allowedEvents: [],
      terminal: true,
      tags: ['terminal', 'cancelled'],
    },
  },

  transitionTable: [
    { fromStateKey: 'Idle', eventType: 'START', toStateKey: 'Step1', description: 'Begin wizard' },
    { fromStateKey: 'Step1', eventType: 'NEXT', toStateKey: 'Step2', description: 'Proceed to step 2' },
    { fromStateKey: 'Step1', eventType: 'CANCEL', toStateKey: 'Cancelled', description: 'Cancel wizard' },
    { fromStateKey: 'Step1', eventType: 'TIMEOUT', toStateKey: 'Cancelled', description: 'Timeout' },
    { fromStateKey: 'Step2', eventType: 'NEXT', toStateKey: 'Review', description: 'Proceed to review' },
    { fromStateKey: 'Step2', eventType: 'BACK', toStateKey: 'Step1', description: 'Go back to step 1' },
    { fromStateKey: 'Step2', eventType: 'CANCEL', toStateKey: 'Cancelled', description: 'Cancel wizard' },
    { fromStateKey: 'Step2', eventType: 'TIMEOUT', toStateKey: 'Cancelled', description: 'Timeout' },
    { fromStateKey: 'Review', eventType: 'SUBMIT', toStateKey: 'Done', description: 'Create character' },
    { fromStateKey: 'Review', eventType: 'BACK', toStateKey: 'Step2', description: 'Go back to step 2' },
    { fromStateKey: 'Review', eventType: 'CANCEL', toStateKey: 'Cancelled', description: 'Cancel wizard' },
    { fromStateKey: 'Review', eventType: 'TIMEOUT', toStateKey: 'Cancelled', description: 'Timeout' },
  ],
};
