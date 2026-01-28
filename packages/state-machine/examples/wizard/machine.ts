/**
 * Wizard example - Machine Definition
 */

import type { MachineDefinition, Effect } from '../../src/index.js';
import { log, scheduleTimeout, cancelTimeout } from '../../src/index.js';
import type { WizardState, WizardEvent, WizardContext, WizardEffect } from './types.js';

const STEP_TIMEOUT_ID = 'wizard-step-timeout';

export const wizardDefinition: MachineDefinition<
  WizardState,
  WizardEvent,
  WizardContext,
  WizardEffect
> = {
  getStateKey(state: WizardState): string {
    return state.type;
  },

  getInitialState(): WizardState {
    return { type: 'Idle' };
  },

  reducer(state: WizardState, event: WizardEvent): { state: WizardState; emitted?: WizardEvent[] } {
    switch (state.type) {
      case 'Idle':
        if (event.type === 'START') {
          return { state: { type: 'Step1', name: '' } };
        }
        break;

      case 'Step1':
        if (event.type === 'SET_NAME') {
          return { state: { ...state, name: event.name } };
        }
        if (event.type === 'NEXT') {
          if (!state.name) {
            // Can't proceed without name - stay in same state
            return { state };
          }
          return { state: { type: 'Step2', name: state.name, class: '' } };
        }
        if (event.type === 'CANCEL' || event.type === 'TIMEOUT') {
          return { state: { type: 'Cancelled' } };
        }
        break;

      case 'Step2':
        if (event.type === 'SET_CLASS') {
          return { state: { ...state, class: event.class } };
        }
        if (event.type === 'SET_LEVEL') {
          // Store level temporarily - will be used on NEXT
          return { state };
        }
        if (event.type === 'NEXT') {
          if (!state.class) {
            return { state };
          }
          // Default level to 1 if not set
          return { state: { type: 'Review', name: state.name, class: state.class, level: 1 } };
        }
        if (event.type === 'BACK') {
          return { state: { type: 'Step1', name: state.name } };
        }
        if (event.type === 'CANCEL' || event.type === 'TIMEOUT') {
          return { state: { type: 'Cancelled' } };
        }
        break;

      case 'Review':
        if (event.type === 'SET_LEVEL') {
          return { state: { ...state, level: event.level } };
        }
        if (event.type === 'SUBMIT') {
          return { state: { type: 'Done', name: state.name, class: state.class, level: state.level } };
        }
        if (event.type === 'BACK') {
          return { state: { type: 'Step2', name: state.name, class: state.class } };
        }
        if (event.type === 'CANCEL' || event.type === 'TIMEOUT') {
          return { state: { type: 'Cancelled' } };
        }
        break;

      case 'Done':
      case 'Cancelled':
        // Terminal states - no transitions
        break;
    }

    // No transition - return same state
    return { state };
  },

  effects(
    prevState: WizardState,
    nextState: WizardState,
    event: WizardEvent,
    ctx: WizardContext
  ): Effect<WizardEvent, WizardEffect>[] {
    const effects: Effect<WizardEvent, WizardEffect>[] = [];

    // Log all transitions
    effects.push(
      log('info', `Wizard transition: ${prevState.type} -> ${nextState.type} via ${event.type}`, {
        userId: ctx.userId,
      })
    );

    // Notify completion
    if (nextState.type === 'Done') {
      effects.push({
        type: 'NotifyComplete',
        characterName: nextState.name,
      });
    }

    return effects;
  },

  guard(event: WizardEvent, state: WizardState): { ok: true } | { ok: false; reason: string } {
    // Validate NEXT has required data
    if (event.type === 'NEXT') {
      if (state.type === 'Step1' && !(state as { name: string }).name) {
        return { ok: false, reason: 'Name is required before proceeding' };
      }
      if (state.type === 'Step2' && !(state as { class: string }).class) {
        return { ok: false, reason: 'Class is required before proceeding' };
      }
    }

    // Validate level is reasonable
    if (event.type === 'SET_LEVEL') {
      if (event.level < 1 || event.level > 20) {
        return { ok: false, reason: 'Level must be between 1 and 20' };
      }
    }

    return { ok: true };
  },

  onEnter(state: WizardState, ctx: WizardContext): Effect<WizardEvent, WizardEffect>[] {
    const effects: Effect<WizardEvent, WizardEffect>[] = [];

    // Schedule timeout for interactive steps
    if (state.type === 'Step1' || state.type === 'Step2') {
      effects.push(
        scheduleTimeout(STEP_TIMEOUT_ID, 300, { type: 'TIMEOUT' })
      );
      effects.push({
        type: 'SendPrompt',
        promptId: `wizard-${state.type.toLowerCase()}`,
        data: { userId: ctx.userId, state },
      });
    }

    if (state.type === 'Review') {
      effects.push(
        scheduleTimeout(STEP_TIMEOUT_ID, 600, { type: 'TIMEOUT' })
      );
      effects.push({
        type: 'SendPrompt',
        promptId: 'wizard-review',
        data: { userId: ctx.userId, state },
      });
    }

    return effects;
  },

  onExit(state: WizardState): Effect<WizardEvent, WizardEffect>[] {
    const effects: Effect<WizardEvent, WizardEffect>[] = [];

    // Cancel timeout when leaving interactive steps
    if (state.type === 'Step1' || state.type === 'Step2' || state.type === 'Review') {
      effects.push(cancelTimeout(STEP_TIMEOUT_ID));
    }

    return effects;
  },
};
