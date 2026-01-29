/**
 * Modifier stack system for tracking bonuses and their sources.
 *
 * Provides typed tracking of numeric modifiers and advantage/disadvantage.
 */

import type { AdvantageState } from '@discord-bot/dnd5e-types';

/**
 * A single numeric modifier with source tracking.
 */
export interface Modifier {
  /** The numeric value of the modifier */
  value: number;
  /** Human-readable source description */
  source: string;
  /** Optional category for grouping */
  category?: string;
}

/**
 * Collection of modifiers that can be summed.
 */
export interface ModifierStack {
  /** List of numeric modifiers */
  modifiers: Modifier[];
  /** Advantage state (multiple sources combine) */
  advantageState: AdvantageState;
  /** Sources of advantage (for explain) */
  advantageSources: string[];
  /** Sources of disadvantage (for explain) */
  disadvantageSources: string[];
}

/**
 * Create an empty modifier stack.
 */
export function createModifierStack(): ModifierStack {
  return {
    modifiers: [],
    advantageState: 'none',
    advantageSources: [],
    disadvantageSources: [],
  };
}

/**
 * Add a numeric modifier to the stack.
 */
export function addModifier(
  stack: ModifierStack,
  value: number,
  source: string,
  category?: string
): ModifierStack {
  return {
    ...stack,
    modifiers: [...stack.modifiers, { value, source, category }],
  };
}

/**
 * Add advantage to the stack.
 */
export function addAdvantage(stack: ModifierStack, source: string): ModifierStack {
  const newAdvSources = [...stack.advantageSources, source];
  return {
    ...stack,
    advantageSources: newAdvSources,
    advantageState: computeAdvantageState(newAdvSources, stack.disadvantageSources),
  };
}

/**
 * Add disadvantage to the stack.
 */
export function addDisadvantage(stack: ModifierStack, source: string): ModifierStack {
  const newDisSources = [...stack.disadvantageSources, source];
  return {
    ...stack,
    disadvantageSources: newDisSources,
    advantageState: computeAdvantageState(stack.advantageSources, newDisSources),
  };
}

/**
 * Compute the resulting advantage state.
 * In 5e, any advantage + any disadvantage cancel to normal.
 */
function computeAdvantageState(
  advSources: string[],
  disSources: string[]
): AdvantageState {
  const hasAdv = advSources.length > 0;
  const hasDis = disSources.length > 0;

  if (hasAdv && hasDis) return 'none'; // They cancel
  if (hasAdv) return 'advantage';
  if (hasDis) return 'disadvantage';
  return 'none';
}

/**
 * Sum all modifiers in the stack.
 */
export function sumModifiers(stack: ModifierStack): number {
  return stack.modifiers.reduce((sum, mod) => sum + mod.value, 0);
}

/**
 * Get modifiers by category.
 */
export function getModifiersByCategory(
  stack: ModifierStack,
  category: string
): Modifier[] {
  return stack.modifiers.filter((m) => m.category === category);
}
