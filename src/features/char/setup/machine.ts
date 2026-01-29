import { ABILITIES } from '@discord-bot/dnd5e-types';
import { createMachine } from '@discord-bot/state-machine';
import { cancelTimeout, scheduleTimeout } from '@discord-bot/state-machine';
import type { MachineDefinition, ReducerResult } from '@discord-bot/state-machine';
import { buildWizardView } from './view.js';
import { wizardCatalog } from './catalog.js';
import type {
  ApplyPayload,
  EditableStep,
  RenderTarget,
  WizardContext,
  WizardEvent,
  WizardState,
  WizardEffect,
  WizardDraft,
} from './types.js';
import { WIZARD_TIMEOUT_SECONDS } from './types.js';

const TIMEOUT_ID = 'char-setup-timeout';

const EMPTY_STATE: WizardState = {
  type: 'idle',
  wizardId: '',
  discordUserId: '',
  channelId: '',
  guildId: '',
  draft: { abilities: {} },
  expiresAt: 0,
};

const REQUIRED_PRIMARY = ABILITIES.slice(0, 3);
const REQUIRED_SECONDARY = ABILITIES.slice(3, 6);

function computeExpiry(nowIso: string): number {
  const now = new Date(nowIso).getTime();
  return now + WIZARD_TIMEOUT_SECONDS * 1000;
}

function withExpiry(state: WizardState, ctx: WizardContext): WizardState {
  return { ...state, expiresAt: computeExpiry(ctx.timestamp) };
}

function isBlank(value?: string): boolean {
  return !value || value.trim().length === 0;
}

function validateIdentity(state: WizardState): string | null {
  if (isBlank(state.draft.name)) {
    return 'Name is required.';
  }
  if (isBlank(state.draft.class)) {
    return 'Class is required.';
  }
  if (state.draft.level === undefined || Number.isNaN(state.draft.level)) {
    return 'Level is required.';
  }
  if (state.draft.level < 1 || state.draft.level > 20) {
    return 'Level must be between 1 and 20.';
  }
  return null;
}

function validateAbilityRange(value: number | undefined): boolean {
  return value !== undefined && !Number.isNaN(value) && value >= 1 && value <= 30;
}

function validateAbilities(state: WizardState, abilities: readonly string[]): string | null {
  for (const ability of abilities) {
    const value = state.draft.abilities[ability as keyof WizardDraft['abilities']];
    if (!validateAbilityRange(value)) {
      return `${ability.toUpperCase()} must be between 1 and 30.`;
    }
  }
  return null;
}

function buildTarget(event: WizardEvent, state: WizardState): RenderTarget {
  if (event.source === 'button') {
    return { mode: 'update' };
  }
  if (event.source === 'modal') {
    if ('messageId' in event && event.messageId) {
      return { mode: 'edit', messageId: event.messageId, channelId: state.channelId };
    }
  }
  if (event.source === 'system') {
    return { mode: 'channel', channelId: state.channelId };
  }
  return { mode: 'reply' };
}

function baseStateFromStart(event: Extract<WizardEvent, { type: 'START' }>, ctx: WizardContext): WizardState {
  return {
    type: 'identity',
    wizardId: ctx.instanceId,
    discordUserId: event.discordUserId,
    channelId: event.channelId,
    guildId: event.guildId,
    draft: { abilities: {} },
    lastError: undefined,
    expiresAt: computeExpiry(ctx.timestamp),
  };
}

const reducer: MachineDefinition<
  WizardState,
  WizardEvent,
  WizardContext,
  WizardEffect
>['reducer'] = (state, event, ctx): ReducerResult<WizardState, WizardEvent> => {
  switch (event.type) {
    case 'START':
      return { state: baseStateFromStart(event, ctx) };

    case 'RESUME':
      return { state: withExpiry({ ...state, lastError: undefined }, ctx) };

    case 'EDIT_STEP':
      return { state: withExpiry({ ...state, lastError: undefined }, ctx) };

    case 'SET_IDENTITY': {
      const nextDraft = {
        ...state.draft,
        name: event.name.trim(),
        class: event.class.trim(),
        level: event.level,
      };
      const nextState = withExpiry({ ...state, draft: nextDraft }, ctx);
      const error = validateIdentity(nextState);
      if (error) {
        return { state: { ...state, lastError: error } };
      }
      return { state: { ...nextState, lastError: undefined } };
    }

    case 'SET_ABILITIES': {
      const nextDraft = {
        ...state.draft,
        abilities: { ...state.draft.abilities, ...event.scores },
      };
      const nextState = withExpiry({ ...state, draft: nextDraft }, ctx);
      const targetAbilities =
        event.abilitySet === 'primary' ? REQUIRED_PRIMARY : REQUIRED_SECONDARY;
      const error = validateAbilities(nextState, targetAbilities);
      if (error) {
        return { state: { ...state, lastError: error } };
      }
      return { state: { ...nextState, lastError: undefined } };
    }

    case 'SET_OPTIONAL': {
      const nextDraft = {
        ...state.draft,
        race: isBlank(event.race) ? undefined : event.race?.trim(),
        background: isBlank(event.background) ? undefined : event.background?.trim(),
      };
      return {
        state: withExpiry({ ...state, draft: nextDraft, lastError: undefined }, ctx),
      };
    }

    case 'NEXT': {
      if (state.type === 'identity') {
        const error = validateIdentity(state);
        if (error) {
          return { state: { ...state, lastError: error } };
        }
        return {
          state: withExpiry({ ...state, type: 'abilities_primary', lastError: undefined }, ctx),
        };
      }
      if (state.type === 'abilities_primary') {
        const error = validateAbilities(state, REQUIRED_PRIMARY);
        if (error) {
          return { state: { ...state, lastError: error } };
        }
        return {
          state: withExpiry(
            { ...state, type: 'abilities_secondary', lastError: undefined },
            ctx
          ),
        };
      }
      if (state.type === 'abilities_secondary') {
        const error = validateAbilities(state, REQUIRED_SECONDARY);
        if (error) {
          return { state: { ...state, lastError: error } };
        }
        return {
          state: withExpiry({ ...state, type: 'optional', lastError: undefined }, ctx),
        };
      }
      if (state.type === 'optional') {
        return {
          state: withExpiry({ ...state, type: 'review', lastError: undefined }, ctx),
        };
      }
      return { state };
    }

    case 'BACK': {
      if (state.type === 'abilities_primary') {
        return {
          state: withExpiry({ ...state, type: 'identity', lastError: undefined }, ctx),
        };
      }
      if (state.type === 'abilities_secondary') {
        return {
          state: withExpiry(
            { ...state, type: 'abilities_primary', lastError: undefined },
            ctx
          ),
        };
      }
      if (state.type === 'optional') {
        return {
          state: withExpiry(
            { ...state, type: 'abilities_secondary', lastError: undefined },
            ctx
          ),
        };
      }
      if (state.type === 'review') {
        return {
          state: withExpiry({ ...state, type: 'optional', lastError: undefined }, ctx),
        };
      }
      return { state };
    }

    case 'SUBMIT': {
      const identityError = validateIdentity(state);
      const primaryError = validateAbilities(state, REQUIRED_PRIMARY);
      const secondaryError = validateAbilities(state, REQUIRED_SECONDARY);
      const error = identityError ?? primaryError ?? secondaryError;
      if (error) {
        return { state: { ...state, lastError: error } };
      }
      return {
        state: {
          ...withExpiry(state, ctx),
          type: 'committing',
          lastError: undefined,
        },
      };
    }

    case 'CANCEL':
      return {
        state: {
          ...state,
          type: 'cancelled',
          lastError: undefined,
        },
      };

    case 'TIMEOUT':
      return {
        state: {
          ...state,
          type: 'timed_out',
          lastError: undefined,
        },
      };

    case 'APPLY_SUCCESS':
      return {
        state: {
          ...state,
          type: 'done',
          lastError: undefined,
        },
      };

    case 'APPLY_FAILED':
      return {
        state: {
          ...state,
          type: 'review',
          lastError: event.error,
        },
      };

    default:
      return { state };
  }
};

const effects: MachineDefinition<
  WizardState,
  WizardEvent,
  WizardContext,
  WizardEffect
>['effects'] = (prevState, nextState, event) => {
  const effects: WizardEffect[] = [];

  if (event.type !== 'TIMEOUT' && event.source !== 'system') {
    effects.push(
      cancelTimeout(TIMEOUT_ID),
      scheduleTimeout(TIMEOUT_ID, WIZARD_TIMEOUT_SECONDS, {
        type: 'TIMEOUT',
        source: 'system',
      })
    );
  }

  if (event.type === 'EDIT_STEP') {
    effects.push({ type: 'ShowModal', modal: buildModal(nextState, event.step) });
    return effects;
  }

  if (event.type === 'CANCEL') {
    effects.push(
      cancelTimeout(TIMEOUT_ID),
      {
        type: 'Notify',
        level: 'info',
        message: 'Character setup cancelled. You can restart anytime with /char setup start.',
        target: buildTarget(event, nextState),
      },
      { type: 'ClearState', instanceId: nextState.wizardId, reason: 'cancel' }
    );
    return effects;
  }

  if (event.type === 'TIMEOUT') {
    effects.push(
      cancelTimeout(TIMEOUT_ID),
      {
        type: 'Notify',
        level: 'info',
        message: 'Character setup expired due to inactivity. Use /char setup start to begin again.',
        target: buildTarget(event, nextState),
      },
      { type: 'ClearState', instanceId: nextState.wizardId, reason: 'timeout' }
    );
    return effects;
  }

  if (event.type === 'APPLY_SUCCESS') {
    effects.push(
      cancelTimeout(TIMEOUT_ID),
      {
        type: 'Notify',
        level: 'success',
        message: `Character "${event.summary.characterName}" saved! Set as active. Try /char show.`,
        target: buildTarget(event, nextState),
      },
      { type: 'ClearState', instanceId: nextState.wizardId, reason: 'complete' }
    );
    return effects;
  }

  if (event.type === 'APPLY_FAILED') {
    effects.push({
      type: 'Notify',
      level: 'error',
      message: `Could not save character: ${event.error}`,
      target: buildTarget(event, nextState),
    });
  }

  if (nextState.type === 'committing' && prevState.type !== 'committing') {
    const payload: ApplyPayload = {
      discordUserId: nextState.discordUserId,
      channelId: nextState.channelId,
      guildId: nextState.guildId,
      draft: nextState.draft,
    };
    effects.push({ type: 'ApplyCharacterPatch', payload });
  }

  if (
    nextState.type === 'identity' ||
    nextState.type === 'abilities_primary' ||
    nextState.type === 'abilities_secondary' ||
    nextState.type === 'optional' ||
    nextState.type === 'review' ||
    nextState.type === 'committing'
  ) {
    effects.push({
      type: 'RenderStep',
      view: buildWizardView(nextState),
      target: buildTarget(event, nextState),
      discordUserId: nextState.discordUserId,
    });
  }

  if (nextState.lastError) {
    effects.push({
      type: 'Notify',
      level: 'error',
      message: nextState.lastError,
      target: buildTarget(event, nextState),
    });
  }

  return effects;
};

function buildModal(state: WizardState, step: EditableStep) {
  if (step === 'identity') {
    return {
      title: 'Edit Identity',
      step,
      fields: [
        { id: 'name', label: 'Name', value: state.draft.name, required: true },
        { id: 'class', label: 'Class', value: state.draft.class, required: true },
        {
          id: 'level',
          label: 'Level (1-20)',
          value: state.draft.level?.toString(),
          required: true,
        },
      ],
    };
  }

  if (step === 'abilities_primary') {
    return {
      title: 'Edit STR / DEX / CON',
      step,
      fields: REQUIRED_PRIMARY.map((ability) => ({
        id: ability,
        label: ability.toUpperCase(),
        value: state.draft.abilities[ability]?.toString(),
        required: true,
      })),
    };
  }

  if (step === 'abilities_secondary') {
    return {
      title: 'Edit INT / WIS / CHA',
      step,
      fields: REQUIRED_SECONDARY.map((ability) => ({
        id: ability,
        label: ability.toUpperCase(),
        value: state.draft.abilities[ability]?.toString(),
        required: true,
      })),
    };
  }

  return {
    title: 'Edit Optional Details',
    step,
    fields: [
      { id: 'race', label: 'Race', value: state.draft.race },
      { id: 'background', label: 'Background', value: state.draft.background },
    ],
  };
}

export const wizardDefinition: MachineDefinition<
  WizardState,
  WizardEvent,
  WizardContext,
  WizardEffect
> = {
  getStateKey: (state) => state.type,
  getInitialState: () => EMPTY_STATE,
  reducer,
  effects,
};

export const wizardMachine = createMachine(wizardDefinition, wizardCatalog);
