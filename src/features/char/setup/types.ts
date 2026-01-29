/**
 * Character Setup Wizard Types
 *
 * Defines state, events, and effects for the character creation wizard.
 */

import type { Ability } from '@discord-bot/dnd5e-types';

// ─────────────────────────────────────────────────────────────────────────────
// Wizard State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draft character data being collected during the wizard.
 */
export interface CharacterDraft {
  name?: string;
  class?: string;
  level?: number;
  race?: string;
  background?: string;
  abilities?: Partial<Record<Ability, number>>;
}

/**
 * Common fields shared by all wizard states.
 */
interface WizardStateBase {
  /** Discord user ID */
  discordUserId: string;
  /** Discord channel ID where wizard was started */
  channelId: string;
  /** Discord guild ID (null for DMs) */
  guildId: string | null;
  /** Target character name */
  characterName: string;
  /** Collected draft data */
  draft: CharacterDraft;
  /** Expiration timestamp (Unix ms) */
  expiresAt: number;
  /** Message ID for the wizard embed (for editing) */
  messageId?: string;
}

/**
 * Idle state - wizard not started.
 */
export interface StateIdle {
  readonly type: 'Idle';
}

/**
 * Identity step - collecting name, class, level.
 */
export interface StateIdentity extends WizardStateBase {
  readonly type: 'Identity';
}

/**
 * Abilities step - collecting ability scores.
 */
export interface StateAbilities extends WizardStateBase {
  readonly type: 'Abilities';
}

/**
 * Review step - showing summary before commit.
 */
export interface StateReview extends WizardStateBase {
  readonly type: 'Review';
}

/**
 * Committing state - saving character.
 */
export interface StateCommitting extends WizardStateBase {
  readonly type: 'Committing';
}

/**
 * Done state - wizard completed successfully.
 */
export interface StateDone extends WizardStateBase {
  readonly type: 'Done';
  /** Created/updated character ID */
  characterId: string;
}

/**
 * Cancelled state - user cancelled wizard.
 */
export interface StateCancelled {
  readonly type: 'Cancelled';
  discordUserId: string;
}

/**
 * Expired state - wizard timed out.
 */
export interface StateExpired {
  readonly type: 'Expired';
  discordUserId: string;
}

/**
 * Error state - something went wrong.
 */
export interface StateError {
  readonly type: 'Error';
  discordUserId: string;
  error: string;
}

/**
 * Union of all wizard states.
 */
export type WizardState =
  | StateIdle
  | StateIdentity
  | StateAbilities
  | StateReview
  | StateCommitting
  | StateDone
  | StateCancelled
  | StateExpired
  | StateError;

// ─────────────────────────────────────────────────────────────────────────────
// Wizard Events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start the wizard.
 */
export interface EventStart {
  readonly type: 'START';
  discordUserId: string;
  channelId: string;
  guildId: string | null;
  characterName: string;
}

/**
 * Update identity fields.
 */
export interface EventSetIdentity {
  readonly type: 'SET_IDENTITY';
  name?: string;
  class?: string;
  level?: number;
  race?: string;
  background?: string;
}

/**
 * Update ability scores.
 */
export interface EventSetAbilities {
  readonly type: 'SET_ABILITIES';
  abilities: Partial<Record<Ability, number>>;
}

/**
 * Move to next step.
 */
export interface EventNext {
  readonly type: 'NEXT';
}

/**
 * Move to previous step.
 */
export interface EventBack {
  readonly type: 'BACK';
}

/**
 * Confirm and commit character.
 */
export interface EventConfirm {
  readonly type: 'CONFIRM';
}

/**
 * Character commit succeeded.
 */
export interface EventCommitSuccess {
  readonly type: 'COMMIT_SUCCESS';
  characterId: string;
}

/**
 * Character commit failed.
 */
export interface EventCommitError {
  readonly type: 'COMMIT_ERROR';
  error: string;
}

/**
 * Cancel the wizard.
 */
export interface EventCancel {
  readonly type: 'CANCEL';
}

/**
 * Wizard timed out.
 */
export interface EventTimeout {
  readonly type: 'TIMEOUT';
}

/**
 * Resume existing wizard (on start if one exists).
 */
export interface EventResume {
  readonly type: 'RESUME';
}

/**
 * Store message ID for editing.
 */
export interface EventSetMessageId {
  readonly type: 'SET_MESSAGE_ID';
  messageId: string;
}

/**
 * Union of all wizard events.
 */
export type WizardEvent =
  | EventStart
  | EventSetIdentity
  | EventSetAbilities
  | EventNext
  | EventBack
  | EventConfirm
  | EventCommitSuccess
  | EventCommitError
  | EventCancel
  | EventTimeout
  | EventResume
  | EventSetMessageId;

// ─────────────────────────────────────────────────────────────────────────────
// Custom Effects
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send or update the wizard embed.
 */
export interface EffectRenderWizard {
  readonly type: 'RenderWizard';
  /** Whether to create new message or edit existing */
  mode: 'create' | 'edit';
}

/**
 * Show a modal for input.
 */
export interface EffectShowModal {
  readonly type: 'ShowModal';
  modalType: 'identity' | 'abilities';
}

/**
 * Apply the character patch using existing /char set logic.
 */
export interface EffectApplyCharacter {
  readonly type: 'ApplyCharacter';
}

/**
 * Send a notification message.
 */
export interface EffectNotify {
  readonly type: 'Notify';
  message: string;
  ephemeral: boolean;
}

/**
 * Delete the wizard state from persistence.
 */
export interface EffectClearState {
  readonly type: 'ClearState';
}

/**
 * Union of custom wizard effects.
 */
export type WizardEffect =
  | EffectRenderWizard
  | EffectShowModal
  | EffectApplyCharacter
  | EffectNotify
  | EffectClearState;

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended context for wizard machine.
 */
export interface WizardContext {
  readonly instanceId: string;
  readonly timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Wizard timeout in seconds (10 minutes). */
export const WIZARD_TIMEOUT_SECONDS = 600;

/** Machine name for persistence. */
export const MACHINE_NAME = 'char-setup';

/** Machine version for migration support. */
export const MACHINE_VERSION = '1.0.0';

/**
 * Generate instance ID for a user.
 * Strategy: one wizard per user globally.
 */
export function getInstanceId(discordUserId: string): string {
  return `char-setup:${discordUserId}`;
}

/**
 * Parse instance ID to get user ID.
 */
export function parseInstanceId(instanceId: string): string | null {
  const match = instanceId.match(/^char-setup:(.+)$/);
  return match?.[1] ?? null;
}
