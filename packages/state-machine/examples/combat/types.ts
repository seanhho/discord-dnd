/**
 * Combat example - Types
 *
 * A turn-based combat encounter with initiative, turns, and pause/resume.
 */

import type { BaseState, BaseEvent, BaseContext } from '../../src/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Combatant
// ─────────────────────────────────────────────────────────────────────────────

export interface Combatant {
  id: string;
  name: string;
  initiative?: number;
  hp: number;
  maxHp: number;
  isPlayer: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// State Types
// ─────────────────────────────────────────────────────────────────────────────

export type CombatState =
  | { type: 'Setup'; combatants: Combatant[] }
  | { type: 'Initiative'; combatants: Combatant[] }
  | { type: 'Running'; substate: RunningSubstate; combatants: Combatant[]; turnOrder: string[]; currentTurnIndex: number; round: number }
  | { type: 'Paused'; resumeState: RunningSubstate; combatants: Combatant[]; turnOrder: string[]; currentTurnIndex: number; round: number }
  | { type: 'Ended'; combatants: Combatant[]; victor: 'players' | 'enemies' | 'draw' | null };

export type RunningSubstate =
  | 'TurnStart'
  | 'AwaitIntent'
  | 'ResolvingAction'
  | 'TurnEnd';

// ─────────────────────────────────────────────────────────────────────────────
// Event Types
// ─────────────────────────────────────────────────────────────────────────────

export type CombatEvent =
  | { type: 'START_ENCOUNTER' }
  | { type: 'ADD_COMBATANT'; combatant: Combatant }
  | { type: 'REMOVE_COMBATANT'; combatantId: string }
  | { type: 'ROLL_INIT'; combatantId: string; roll: number }
  | { type: 'FINALIZE_INIT' }
  | { type: 'DECLARE_INTENT'; combatantId: string; action: string; targetId?: string }
  | { type: 'RESOLVE_ACTION' }
  | { type: 'APPLY_DAMAGE'; targetId: string; damage: number }
  | { type: 'TURN_COMPLETE' }
  | { type: 'NEXT_TURN' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'END_ENCOUNTER'; reason: string }
  | { type: 'TIMEOUT' };

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

export interface CombatContext extends BaseContext {
  guildId: string;
  channelId: string;
  dmUserId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Effects
// ─────────────────────────────────────────────────────────────────────────────

export type CombatEffect =
  | { type: 'SendCombatMessage'; message: string; embed?: Record<string, unknown> }
  | { type: 'UpdateInitiativeDisplay'; combatants: Combatant[] }
  | { type: 'PromptForIntent'; combatantId: string; combatantName: string }
  | { type: 'AnnounceTurnStart'; combatantName: string; round: number }
  | { type: 'AnnounceVictory'; victor: string };
