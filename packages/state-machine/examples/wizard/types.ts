/**
 * Wizard example - Types
 *
 * A linear wizard with back/next navigation, review, and timeout handling.
 */

import type { BaseState, BaseEvent, BaseContext } from '../../src/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// State Types
// ─────────────────────────────────────────────────────────────────────────────

export type WizardState =
  | { type: 'Idle' }
  | { type: 'Step1'; name: string }
  | { type: 'Step2'; name: string; class: string }
  | { type: 'Review'; name: string; class: string; level: number }
  | { type: 'Done'; name: string; class: string; level: number }
  | { type: 'Cancelled' };

// ─────────────────────────────────────────────────────────────────────────────
// Event Types
// ─────────────────────────────────────────────────────────────────────────────

export type WizardEvent =
  | { type: 'START' }
  | { type: 'SET_NAME'; name: string }
  | { type: 'SET_CLASS'; class: string }
  | { type: 'SET_LEVEL'; level: number }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'SUBMIT' }
  | { type: 'CANCEL' }
  | { type: 'TIMEOUT' };

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

export interface WizardContext extends BaseContext {
  userId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Effects
// ─────────────────────────────────────────────────────────────────────────────

export type WizardEffect =
  | { type: 'SendPrompt'; promptId: string; data: Record<string, unknown> }
  | { type: 'NotifyComplete'; characterName: string };
