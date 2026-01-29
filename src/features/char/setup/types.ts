import type { Ability } from '@discord-bot/dnd5e-types';
import type { BaseContext } from '@discord-bot/state-machine';

export const WIZARD_TIMEOUT_SECONDS = 600;

export type EditableStep =
  | 'identity'
  | 'abilities_primary'
  | 'abilities_secondary'
  | 'optional';

export type WizardStep =
  | EditableStep
  | 'review'
  | 'committing'
  | 'done'
  | 'cancelled'
  | 'timed_out'
  | 'idle';

export interface WizardDraft {
  name?: string;
  class?: string;
  level?: number;
  race?: string;
  background?: string;
  abilities: Partial<Record<Ability, number>>;
}

export interface WizardBaseState {
  type: WizardStep;
  wizardId: string;
  discordUserId: string;
  channelId: string;
  guildId: string;
  draft: WizardDraft;
  lastError?: string;
  expiresAt: number;
}

export type WizardState =
  | WizardBaseState
  | (WizardBaseState & { type: 'idle' })
  | (WizardBaseState & { type: 'identity' })
  | (WizardBaseState & { type: 'abilities_primary' })
  | (WizardBaseState & { type: 'abilities_secondary' })
  | (WizardBaseState & { type: 'optional' })
  | (WizardBaseState & { type: 'review' })
  | (WizardBaseState & { type: 'committing' })
  | (WizardBaseState & { type: 'done' })
  | (WizardBaseState & { type: 'cancelled' })
  | (WizardBaseState & { type: 'timed_out' });

export type InteractionSource = 'command' | 'button' | 'modal' | 'system';

export type WizardEvent =
  | {
      type: 'START';
      source: 'command';
      discordUserId: string;
      channelId: string;
      guildId: string;
    }
  | { type: 'RESUME'; source: 'command' }
  | { type: 'NEXT'; source: 'button' }
  | { type: 'BACK'; source: 'button' }
  | { type: 'SUBMIT'; source: 'button' }
  | { type: 'CANCEL'; source: 'button' | 'command' }
  | { type: 'EDIT_STEP'; source: 'button'; step: EditableStep }
  | {
      type: 'SET_IDENTITY';
      source: 'modal';
      name: string;
      class: string;
      level: number;
      messageId: string;
    }
  | {
      type: 'SET_ABILITIES';
      source: 'modal';
      abilitySet: 'primary' | 'secondary';
      scores: Partial<Record<Ability, number>>;
      messageId: string;
    }
  | {
      type: 'SET_OPTIONAL';
      source: 'modal';
      race?: string;
      background?: string;
      messageId: string;
    }
  | { type: 'TIMEOUT'; source: 'system' }
  | { type: 'APPLY_SUCCESS'; source: 'system'; summary: ApplySummary }
  | { type: 'APPLY_FAILED'; source: 'system'; error: string };

export interface WizardContext extends BaseContext {
  interaction?: unknown;
}

export interface WizardViewField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface WizardView {
  title: string;
  description: string;
  fields: WizardViewField[];
  footer?: string;
  progress: string;
  errors?: string[];
  step: WizardStep;
}

export interface WizardModalField {
  id: string;
  label: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
}

export interface WizardModal {
  title: string;
  step: EditableStep;
  fields: WizardModalField[];
}

export type RenderTarget =
  | { mode: 'reply' }
  | { mode: 'update' }
  | { mode: 'edit'; messageId: string; channelId: string }
  | { mode: 'channel'; channelId: string };

export interface ApplyPayload {
  discordUserId: string;
  channelId: string;
  guildId: string;
  draft: WizardDraft;
}

export interface ApplySummary {
  characterName: string;
  appliedKeys: string[];
}

export type WizardEffect =
  | {
      type: 'RenderStep';
      view: WizardView;
      target: RenderTarget;
      discordUserId: string;
    }
  | { type: 'ShowModal'; modal: WizardModal }
  | { type: 'Notify'; level: 'info' | 'error' | 'success'; message: string; target: RenderTarget }
  | { type: 'ApplyCharacterPatch'; payload: ApplyPayload }
  | { type: 'ClearState'; instanceId: string; reason: 'cancel' | 'timeout' | 'complete' };
