/**
 * Character Setup Wizard Machine
 *
 * Pure reducer + effects implementation for the character creation wizard.
 */

import type { MachineDefinition, ReducerResult, Effect } from '@discord-bot/state-machine';
import { scheduleTimeout, cancelTimeout, persistNow, log } from '@discord-bot/state-machine';
import type {
  WizardState,
  WizardEvent,
  WizardContext,
  WizardEffect,
  CharacterDraft,
  StateIdentity,
  StateAbilities,
  StateReview,
} from './types.js';
import { WIZARD_TIMEOUT_SECONDS } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TIMEOUT_ID = 'wizard-inactivity';

function getExpiresAt(): number {
  return Date.now() + WIZARD_TIMEOUT_SECONDS * 1000;
}

function isActiveState(
  state: WizardState
): state is StateIdentity | StateAbilities | StateReview {
  return state.type === 'Identity' || state.type === 'Abilities' || state.type === 'Review';
}

function createIdentityState(
  discordUserId: string,
  channelId: string,
  guildId: string | null,
  characterName: string,
  draft: CharacterDraft = {}
): StateIdentity {
  return {
    type: 'Identity',
    discordUserId,
    channelId,
    guildId,
    characterName,
    draft: { ...draft, name: draft.name ?? characterName },
    expiresAt: getExpiresAt(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────

function reducer(
  state: WizardState,
  event: WizardEvent,
  _ctx: WizardContext
): ReducerResult<WizardState, WizardEvent> {
  switch (state.type) {
    case 'Idle':
      return reduceIdle(state, event);
    case 'Identity':
      return reduceIdentity(state, event);
    case 'Abilities':
      return reduceAbilities(state, event);
    case 'Review':
      return reduceReview(state, event);
    case 'Committing':
      return reduceCommitting(state, event);
    default:
      // Terminal states don't transition
      return { state };
  }
}

function reduceIdle(
  _state: WizardState,
  event: WizardEvent
): ReducerResult<WizardState, WizardEvent> {
  if (event.type === 'START') {
    return {
      state: createIdentityState(
        event.discordUserId,
        event.channelId,
        event.guildId,
        event.characterName
      ),
    };
  }
  return { state: _state };
}

function reduceIdentity(
  state: StateIdentity,
  event: WizardEvent
): ReducerResult<WizardState, WizardEvent> {
  switch (event.type) {
    case 'SET_IDENTITY':
      return {
        state: {
          ...state,
          draft: {
            ...state.draft,
            name: event.name ?? state.draft.name,
            class: event.class ?? state.draft.class,
            level: event.level ?? state.draft.level,
            race: event.race ?? state.draft.race,
            background: event.background ?? state.draft.background,
          },
          expiresAt: getExpiresAt(),
        },
      };

    case 'SET_MESSAGE_ID':
      return {
        state: { ...state, messageId: event.messageId },
      };

    case 'NEXT':
      // Validate required fields before moving on
      if (!state.draft.name || !state.draft.class || !state.draft.level) {
        // Stay on same step - effects will show error
        return { state };
      }
      return {
        state: {
          type: 'Abilities',
          discordUserId: state.discordUserId,
          channelId: state.channelId,
          guildId: state.guildId,
          characterName: state.characterName,
          draft: state.draft,
          expiresAt: getExpiresAt(),
          messageId: state.messageId,
        },
      };

    case 'CANCEL':
      return {
        state: { type: 'Cancelled', discordUserId: state.discordUserId },
      };

    case 'TIMEOUT':
      return {
        state: { type: 'Expired', discordUserId: state.discordUserId },
      };

    default:
      return { state };
  }
}

function reduceAbilities(
  state: StateAbilities,
  event: WizardEvent
): ReducerResult<WizardState, WizardEvent> {
  switch (event.type) {
    case 'SET_ABILITIES':
      return {
        state: {
          ...state,
          draft: {
            ...state.draft,
            abilities: { ...state.draft.abilities, ...event.abilities },
          },
          expiresAt: getExpiresAt(),
        },
      };

    case 'SET_MESSAGE_ID':
      return {
        state: { ...state, messageId: event.messageId },
      };

    case 'NEXT':
      // All abilities are optional for next, but we validate ranges in effects
      return {
        state: {
          type: 'Review',
          discordUserId: state.discordUserId,
          channelId: state.channelId,
          guildId: state.guildId,
          characterName: state.characterName,
          draft: state.draft,
          expiresAt: getExpiresAt(),
          messageId: state.messageId,
        },
      };

    case 'BACK':
      return {
        state: {
          type: 'Identity',
          discordUserId: state.discordUserId,
          channelId: state.channelId,
          guildId: state.guildId,
          characterName: state.characterName,
          draft: state.draft,
          expiresAt: getExpiresAt(),
          messageId: state.messageId,
        },
      };

    case 'CANCEL':
      return {
        state: { type: 'Cancelled', discordUserId: state.discordUserId },
      };

    case 'TIMEOUT':
      return {
        state: { type: 'Expired', discordUserId: state.discordUserId },
      };

    default:
      return { state };
  }
}

function reduceReview(
  state: StateReview,
  event: WizardEvent
): ReducerResult<WizardState, WizardEvent> {
  switch (event.type) {
    case 'CONFIRM':
      return {
        state: {
          type: 'Committing',
          discordUserId: state.discordUserId,
          channelId: state.channelId,
          guildId: state.guildId,
          characterName: state.characterName,
          draft: state.draft,
          expiresAt: state.expiresAt,
          messageId: state.messageId,
        },
      };

    case 'BACK':
      return {
        state: {
          type: 'Abilities',
          discordUserId: state.discordUserId,
          channelId: state.channelId,
          guildId: state.guildId,
          characterName: state.characterName,
          draft: state.draft,
          expiresAt: getExpiresAt(),
          messageId: state.messageId,
        },
      };

    case 'CANCEL':
      return {
        state: { type: 'Cancelled', discordUserId: state.discordUserId },
      };

    case 'TIMEOUT':
      return {
        state: { type: 'Expired', discordUserId: state.discordUserId },
      };

    default:
      return { state };
  }
}

function reduceCommitting(
  state: WizardState,
  event: WizardEvent
): ReducerResult<WizardState, WizardEvent> {
  if (state.type !== 'Committing') return { state };

  switch (event.type) {
    case 'COMMIT_SUCCESS':
      return {
        state: {
          type: 'Done',
          discordUserId: state.discordUserId,
          channelId: state.channelId,
          guildId: state.guildId,
          characterName: state.characterName,
          draft: state.draft,
          expiresAt: state.expiresAt,
          messageId: state.messageId,
          characterId: event.characterId,
        },
      };

    case 'COMMIT_ERROR':
      return {
        state: {
          type: 'Error',
          discordUserId: state.discordUserId,
          error: event.error,
        },
      };

    default:
      return { state };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Effects
// ─────────────────────────────────────────────────────────────────────────────

type WizardEffectResult = Effect<WizardEvent, WizardEffect>;

function effects(
  prevState: WizardState,
  nextState: WizardState,
  event: WizardEvent,
  _ctx: WizardContext
): WizardEffectResult[] {
  const result: WizardEffectResult[] = [];

  // Log transitions
  if (prevState.type !== nextState.type) {
    result.push(log('info', `Wizard transition: ${prevState.type} -> ${nextState.type}`) as WizardEffectResult);
  }

  // Handle timeout scheduling/cancellation
  if (isActiveState(nextState) && !isActiveState(prevState)) {
    // Entering an active state - schedule timeout
    result.push(
      scheduleTimeout<WizardEvent>(TIMEOUT_ID, WIZARD_TIMEOUT_SECONDS, { type: 'TIMEOUT' })
    );
  } else if (isActiveState(nextState) && isActiveState(prevState)) {
    // Staying in active state - reset timeout
    result.push(cancelTimeout(TIMEOUT_ID) as WizardEffectResult);
    result.push(
      scheduleTimeout<WizardEvent>(TIMEOUT_ID, WIZARD_TIMEOUT_SECONDS, { type: 'TIMEOUT' })
    );
  } else if (!isActiveState(nextState) && isActiveState(prevState)) {
    // Leaving active state - cancel timeout
    result.push(cancelTimeout(TIMEOUT_ID) as WizardEffectResult);
  }

  // Render wizard on state changes
  if (prevState.type === 'Idle' && nextState.type === 'Identity') {
    // Starting wizard - create new message
    result.push({ type: 'RenderWizard', mode: 'create' });
    result.push(persistNow() as WizardEffectResult);
  } else if (
    isActiveState(nextState) &&
    prevState.type !== nextState.type
  ) {
    // Transitioning between active states - edit message
    result.push({ type: 'RenderWizard', mode: 'edit' });
    result.push(persistNow() as WizardEffectResult);
  } else if (
    isActiveState(nextState) &&
    isActiveState(prevState) &&
    event.type.startsWith('SET_')
  ) {
    // Data updated - re-render
    result.push({ type: 'RenderWizard', mode: 'edit' });
    result.push(persistNow() as WizardEffectResult);
  }

  // Handle commit
  if (nextState.type === 'Committing' && prevState.type === 'Review') {
    result.push({ type: 'ApplyCharacter' });
  }

  // Handle terminal states
  if (nextState.type === 'Done') {
    result.push({ type: 'RenderWizard', mode: 'edit' });
    result.push({ type: 'ClearState' });
  }

  if (nextState.type === 'Cancelled') {
    result.push({
      type: 'Notify',
      message: 'Character creation cancelled.',
      ephemeral: true,
    });
    result.push({ type: 'ClearState' });
  }

  if (nextState.type === 'Expired') {
    result.push({
      type: 'Notify',
      message: 'Character creation wizard expired due to inactivity. Use `/char setup start` to begin again.',
      ephemeral: true,
    });
    result.push({ type: 'ClearState' });
  }

  if (nextState.type === 'Error') {
    result.push({
      type: 'Notify',
      message: `Error creating character: ${nextState.error}`,
      ephemeral: true,
    });
    result.push({ type: 'ClearState' });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Machine Definition
// ─────────────────────────────────────────────────────────────────────────────

export const wizardMachineDefinition: MachineDefinition<
  WizardState,
  WizardEvent,
  WizardContext,
  WizardEffect
> = {
  getStateKey: (state: WizardState) => state.type,
  getInitialState: () => ({ type: 'Idle' }),
  reducer,
  effects,
};
