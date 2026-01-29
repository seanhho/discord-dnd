/**
 * Combat example - Machine Definition
 */

import type { MachineDefinition, Effect } from '../../src/index.js';
import { log, scheduleTimeout, cancelTimeout } from '../../src/index.js';
import type {
  CombatState,
  CombatEvent,
  CombatContext,
  CombatEffect,
  Combatant,
  RunningSubstate,
} from './types.js';

const TURN_TIMEOUT_ID = 'combat-turn-timeout';
const INIT_TIMEOUT_ID = 'combat-init-timeout';

/**
 * Get the current combatant from state.
 */
function getCurrentCombatant(state: CombatState): Combatant | undefined {
  if (state.type !== 'Running' && state.type !== 'Paused') return undefined;
  const id = state.turnOrder[state.currentTurnIndex];
  return state.combatants.find((c) => c.id === id);
}

/**
 * Check if all combatants have rolled initiative.
 */
function allInitiativeRolled(combatants: Combatant[]): boolean {
  return combatants.every((c) => c.initiative !== undefined);
}

/**
 * Sort combatants by initiative (descending).
 */
function sortByInitiative(combatants: Combatant[]): string[] {
  return [...combatants]
    .sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0))
    .map((c) => c.id);
}

/**
 * Determine victor based on remaining HP.
 */
function determineVictor(combatants: Combatant[]): 'players' | 'enemies' | 'draw' | null {
  const playersAlive = combatants.filter((c) => c.isPlayer && c.hp > 0);
  const enemiesAlive = combatants.filter((c) => !c.isPlayer && c.hp > 0);

  if (playersAlive.length === 0 && enemiesAlive.length === 0) return 'draw';
  if (playersAlive.length === 0) return 'enemies';
  if (enemiesAlive.length === 0) return 'players';
  return null; // Combat ongoing
}

export const combatDefinition: MachineDefinition<
  CombatState,
  CombatEvent,
  CombatContext,
  CombatEffect
> = {
  getStateKey(state: CombatState): string {
    if (state.type === 'Running') {
      return `Running.${state.substate}`;
    }
    return state.type;
  },

  getInitialState(): CombatState {
    return { type: 'Setup', combatants: [] };
  },

  reducer(
    state: CombatState,
    event: CombatEvent
  ): { state: CombatState; emitted?: CombatEvent[] } {
    switch (state.type) {
      case 'Setup': {
        if (event.type === 'ADD_COMBATANT') {
          return {
            state: {
              ...state,
              combatants: [...state.combatants, event.combatant],
            },
          };
        }
        if (event.type === 'REMOVE_COMBATANT') {
          return {
            state: {
              ...state,
              combatants: state.combatants.filter((c) => c.id !== event.combatantId),
            },
          };
        }
        if (event.type === 'START_ENCOUNTER') {
          if (state.combatants.length < 2) {
            return { state }; // Need at least 2 combatants
          }
          return {
            state: { type: 'Initiative', combatants: state.combatants },
          };
        }
        break;
      }

      case 'Initiative': {
        if (event.type === 'ROLL_INIT') {
          const combatants = state.combatants.map((c) =>
            c.id === event.combatantId ? { ...c, initiative: event.roll } : c
          );
          return { state: { ...state, combatants } };
        }
        if (event.type === 'FINALIZE_INIT') {
          if (!allInitiativeRolled(state.combatants)) {
            return { state }; // Can't finalize without all rolls
          }
          const turnOrder = sortByInitiative(state.combatants);
          return {
            state: {
              type: 'Running',
              substate: 'TurnStart',
              combatants: state.combatants,
              turnOrder,
              currentTurnIndex: 0,
              round: 1,
            },
          };
        }
        if (event.type === 'END_ENCOUNTER') {
          return {
            state: { type: 'Ended', combatants: state.combatants, victor: null },
          };
        }
        break;
      }

      case 'Running': {
        if (event.type === 'DECLARE_INTENT') {
          if (state.substate === 'TurnStart' || state.substate === 'AwaitIntent') {
            return {
              state: { ...state, substate: 'ResolvingAction' },
            };
          }
        }
        if (event.type === 'APPLY_DAMAGE' && state.substate === 'ResolvingAction') {
          const combatants = state.combatants.map((c) =>
            c.id === event.targetId
              ? { ...c, hp: Math.max(0, c.hp - event.damage) }
              : c
          );
          // Check for combat end
          const victor = determineVictor(combatants);
          if (victor) {
            return {
              state: { type: 'Ended', combatants, victor },
            };
          }
          return { state: { ...state, combatants } };
        }
        if (event.type === 'TURN_COMPLETE' && state.substate === 'ResolvingAction') {
          return {
            state: { ...state, substate: 'TurnEnd' },
          };
        }
        if (event.type === 'NEXT_TURN' && state.substate === 'TurnEnd') {
          const nextIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
          const nextRound = nextIndex === 0 ? state.round + 1 : state.round;
          return {
            state: {
              ...state,
              substate: 'TurnStart',
              currentTurnIndex: nextIndex,
              round: nextRound,
            },
            // Emit event to automatically transition to AwaitIntent
            emitted: [{ type: 'DECLARE_INTENT', combatantId: state.turnOrder[nextIndex], action: 'awaiting' }],
          };
        }
        if (event.type === 'PAUSE') {
          return {
            state: {
              type: 'Paused',
              resumeState: state.substate,
              combatants: state.combatants,
              turnOrder: state.turnOrder,
              currentTurnIndex: state.currentTurnIndex,
              round: state.round,
            },
          };
        }
        if (event.type === 'END_ENCOUNTER') {
          return {
            state: {
              type: 'Ended',
              combatants: state.combatants,
              victor: determineVictor(state.combatants),
            },
          };
        }
        if (event.type === 'TIMEOUT') {
          // On timeout, skip to next turn or end
          return {
            state: { ...state, substate: 'TurnEnd' },
            emitted: [{ type: 'NEXT_TURN' }],
          };
        }
        break;
      }

      case 'Paused': {
        if (event.type === 'RESUME') {
          return {
            state: {
              type: 'Running',
              substate: state.resumeState,
              combatants: state.combatants,
              turnOrder: state.turnOrder,
              currentTurnIndex: state.currentTurnIndex,
              round: state.round,
            },
          };
        }
        if (event.type === 'END_ENCOUNTER') {
          return {
            state: {
              type: 'Ended',
              combatants: state.combatants,
              victor: determineVictor(state.combatants),
            },
          };
        }
        break;
      }

      case 'Ended':
        // Terminal state
        break;
    }

    return { state };
  },

  effects(
    prevState: CombatState,
    nextState: CombatState,
    event: CombatEvent,
    ctx: CombatContext
  ): Effect<CombatEvent, CombatEffect>[] {
    const effects: Effect<CombatEvent, CombatEffect>[] = [];

    // Log transitions
    const prevKey = combatDefinition.getStateKey(prevState);
    const nextKey = combatDefinition.getStateKey(nextState);
    effects.push(
      log('debug', `Combat: ${prevKey} -> ${nextKey} via ${event.type}`, {
        guildId: ctx.guildId,
        channelId: ctx.channelId,
      })
    );

    // Announce turn start
    if (nextState.type === 'Running' && nextState.substate === 'TurnStart') {
      const combatant = getCurrentCombatant(nextState);
      if (combatant) {
        effects.push({
          type: 'AnnounceTurnStart',
          combatantName: combatant.name,
          round: nextState.round,
        });
      }
    }

    // Prompt for intent
    if (nextState.type === 'Running' && nextState.substate === 'AwaitIntent') {
      const combatant = getCurrentCombatant(nextState);
      if (combatant) {
        effects.push({
          type: 'PromptForIntent',
          combatantId: combatant.id,
          combatantName: combatant.name,
        });
      }
    }

    // Announce victory
    if (nextState.type === 'Ended' && nextState.victor) {
      effects.push({
        type: 'AnnounceVictory',
        victor: nextState.victor,
      });
    }

    return effects;
  },

  onEnter(state: CombatState): Effect<CombatEvent, CombatEffect>[] {
    const effects: Effect<CombatEvent, CombatEffect>[] = [];

    if (state.type === 'Initiative') {
      effects.push(scheduleTimeout(INIT_TIMEOUT_ID, 300, { type: 'TIMEOUT' }));
      effects.push({
        type: 'UpdateInitiativeDisplay',
        combatants: state.combatants,
      });
    }

    if (state.type === 'Running' && state.substate === 'AwaitIntent') {
      effects.push(scheduleTimeout(TURN_TIMEOUT_ID, 180, { type: 'TIMEOUT' }));
    }

    return effects;
  },

  onExit(state: CombatState): Effect<CombatEvent, CombatEffect>[] {
    const effects: Effect<CombatEvent, CombatEffect>[] = [];

    if (state.type === 'Initiative') {
      effects.push(cancelTimeout(INIT_TIMEOUT_ID));
    }

    if (state.type === 'Running' && state.substate === 'AwaitIntent') {
      effects.push(cancelTimeout(TURN_TIMEOUT_ID));
    }

    return effects;
  },
};
