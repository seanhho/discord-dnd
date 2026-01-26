import type { FeatureSlice } from '../../core/types.js';
import { rollCommand, handleRollCommand } from './command.js';

/**
 * Dice rolling feature slice
 *
 * Provides a /roll command that allows users to roll dice with
 * customizable sides, count, modifier, and label.
 */
export const diceFeature: FeatureSlice = {
  name: 'roll',
  command: rollCommand,
  handler: handleRollCommand,
};
