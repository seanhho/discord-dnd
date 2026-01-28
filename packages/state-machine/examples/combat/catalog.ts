/**
 * Combat example - State Catalog
 */

import type { StateCatalog } from '../../src/index.js';
import type { CombatEvent } from './types.js';

export const combatCatalog: StateCatalog<CombatEvent> = {
  machineName: 'CombatEncounter',
  version: '1.0.0',
  description: 'A turn-based combat encounter state machine for tabletop RPG.',

  states: {
    'Setup': {
      summary: 'Adding combatants before combat begins',
      description: 'The DM is setting up the encounter by adding players and enemies.',
      allowedEvents: ['ADD_COMBATANT', 'REMOVE_COMBATANT', 'START_ENCOUNTER'],
      view: {
        templateId: 'combat-setup',
        title: 'Combat Setup',
      },
      tags: ['setup'],
    },

    'Initiative': {
      summary: 'Rolling initiative for all combatants',
      description: 'Each combatant rolls for initiative to determine turn order.',
      allowedEvents: ['ROLL_INIT', 'FINALIZE_INIT', 'END_ENCOUNTER'],
      timeout: {
        seconds: 300,
        onTimeoutEvent: { type: 'TIMEOUT' },
      },
      view: {
        templateId: 'combat-initiative',
        title: 'Roll Initiative',
      },
      tags: ['initiative'],
    },

    'Running.TurnStart': {
      summary: 'Beginning of a combatant\'s turn',
      description: 'The current combatant\'s turn is starting.',
      allowedEvents: ['DECLARE_INTENT', 'PAUSE', 'END_ENCOUNTER', 'TIMEOUT'],
      timeout: {
        seconds: 120,
        onTimeoutEvent: { type: 'TIMEOUT' },
      },
      tags: ['running', 'turn'],
    },

    'Running.AwaitIntent': {
      summary: 'Waiting for combatant to declare action',
      description: 'The current combatant must declare what they want to do.',
      allowedEvents: ['DECLARE_INTENT', 'PAUSE', 'END_ENCOUNTER', 'TIMEOUT'],
      timeout: {
        seconds: 180,
        onTimeoutEvent: { type: 'TIMEOUT' },
      },
      view: {
        templateId: 'combat-await-intent',
        title: 'Declare Your Action',
      },
      tags: ['running', 'turn', 'awaiting-input'],
    },

    'Running.ResolvingAction': {
      summary: 'Resolving the declared action',
      description: 'The DM is resolving the combatant\'s declared action.',
      allowedEvents: ['APPLY_DAMAGE', 'TURN_COMPLETE', 'PAUSE', 'END_ENCOUNTER'],
      tags: ['running', 'turn', 'resolving'],
    },

    'Running.TurnEnd': {
      summary: 'End of a combatant\'s turn',
      description: 'The current combatant\'s turn is ending.',
      allowedEvents: ['NEXT_TURN', 'PAUSE', 'END_ENCOUNTER'],
      tags: ['running', 'turn'],
    },

    'Paused': {
      summary: 'Combat is paused',
      description: 'The encounter is temporarily paused.',
      allowedEvents: ['RESUME', 'END_ENCOUNTER'],
      tags: ['paused'],
    },

    'Ended': {
      summary: 'Combat has ended',
      description: 'The encounter is complete.',
      allowedEvents: [],
      terminal: true,
      tags: ['terminal'],
    },
  },

  transitionTable: [
    // Setup
    { fromStateKey: 'Setup', eventType: 'START_ENCOUNTER', toStateKey: 'Initiative' },

    // Initiative
    { fromStateKey: 'Initiative', eventType: 'FINALIZE_INIT', toStateKey: 'Running.TurnStart' },
    { fromStateKey: 'Initiative', eventType: 'END_ENCOUNTER', toStateKey: 'Ended' },

    // Running - Turn flow
    { fromStateKey: 'Running.TurnStart', eventType: 'DECLARE_INTENT', toStateKey: 'Running.AwaitIntent' },
    { fromStateKey: 'Running.AwaitIntent', eventType: 'DECLARE_INTENT', toStateKey: 'Running.ResolvingAction' },
    { fromStateKey: 'Running.ResolvingAction', eventType: 'TURN_COMPLETE', toStateKey: 'Running.TurnEnd' },
    { fromStateKey: 'Running.TurnEnd', eventType: 'NEXT_TURN', toStateKey: 'Running.TurnStart' },

    // Pause/Resume
    { fromStateKey: 'Running.TurnStart', eventType: 'PAUSE', toStateKey: 'Paused' },
    { fromStateKey: 'Running.AwaitIntent', eventType: 'PAUSE', toStateKey: 'Paused' },
    { fromStateKey: 'Running.ResolvingAction', eventType: 'PAUSE', toStateKey: 'Paused' },
    { fromStateKey: 'Running.TurnEnd', eventType: 'PAUSE', toStateKey: 'Paused' },
    { fromStateKey: 'Paused', eventType: 'RESUME', toStateKey: 'Running.TurnStart' },

    // End from any running state
    { fromStateKey: 'Running.TurnStart', eventType: 'END_ENCOUNTER', toStateKey: 'Ended' },
    { fromStateKey: 'Running.AwaitIntent', eventType: 'END_ENCOUNTER', toStateKey: 'Ended' },
    { fromStateKey: 'Running.ResolvingAction', eventType: 'END_ENCOUNTER', toStateKey: 'Ended' },
    { fromStateKey: 'Running.TurnEnd', eventType: 'END_ENCOUNTER', toStateKey: 'Ended' },
    { fromStateKey: 'Paused', eventType: 'END_ENCOUNTER', toStateKey: 'Ended' },
  ],
};
