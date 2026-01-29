/**
 * Engine module exports.
 */

export type { RNG } from './rng.js';
export { defaultRNG, createSeededRNG, createMockRNG } from './rng.js';

export type { DiceRollResult, ParsedDice } from './dice.js';
export {
  parseDice,
  rollParsedDice,
  rollDice,
  rollD,
  rollD20,
  formatDiceRoll,
} from './dice.js';

export type { Modifier, ModifierStack } from './modifiers.js';
export {
  createModifierStack,
  addModifier,
  addAdvantage,
  addDisadvantage,
  sumModifiers,
  getModifiersByCategory,
} from './modifiers.js';

export type { BreakdownItem, Breakdown } from './explain.js';
export {
  createBreakdown,
  formatSignedNumber,
  formatBreakdownLine,
  formatBreakdownMultiline,
  buildExplainString,
} from './explain.js';
