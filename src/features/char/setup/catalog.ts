import type { StateCatalog } from '@discord-bot/state-machine';
import type { WizardEvent } from './types.js';

export const wizardCatalog: StateCatalog<WizardEvent> = {
  machineName: 'CharSetupWizard',
  version: '1.0.0',
  description: 'Guided wizard for creating a D&D 5e character.',
  states: {
    idle: {
      description: 'No active wizard instance.',
      allowedEvents: ['START'],
    },
    identity: {
      description: 'Collect character identity.',
      allowedEvents: [
        'SET_IDENTITY',
        'EDIT_STEP',
        'NEXT',
        'CANCEL',
        'RESUME',
        'TIMEOUT',
      ],
    },
    abilities_primary: {
      description: 'Collect STR/DEX/CON.',
      allowedEvents: [
        'SET_ABILITIES',
        'EDIT_STEP',
        'NEXT',
        'BACK',
        'CANCEL',
        'RESUME',
        'TIMEOUT',
      ],
    },
    abilities_secondary: {
      description: 'Collect INT/WIS/CHA.',
      allowedEvents: [
        'SET_ABILITIES',
        'EDIT_STEP',
        'NEXT',
        'BACK',
        'CANCEL',
        'RESUME',
        'TIMEOUT',
      ],
    },
    optional: {
      description: 'Collect optional basics.',
      allowedEvents: [
        'SET_OPTIONAL',
        'EDIT_STEP',
        'NEXT',
        'BACK',
        'CANCEL',
        'RESUME',
        'TIMEOUT',
      ],
    },
    review: {
      description: 'Review and confirm character.',
      allowedEvents: [
        'EDIT_STEP',
        'SUBMIT',
        'BACK',
        'CANCEL',
        'RESUME',
        'TIMEOUT',
      ],
    },
    committing: {
      description: 'Applying character patch.',
      allowedEvents: ['APPLY_SUCCESS', 'APPLY_FAILED', 'TIMEOUT'],
    },
    done: {
      description: 'Wizard completed.',
      allowedEvents: [],
    },
    cancelled: {
      description: 'Wizard cancelled.',
      allowedEvents: [],
    },
    timed_out: {
      description: 'Wizard expired due to inactivity.',
      allowedEvents: [],
    },
  },
};
