/**
 * Explanation string builders for rule calculations.
 *
 * Generates human-readable breakdowns of how totals were computed.
 */

import type { ModifierStack } from './modifiers.js';

/**
 * Breakdown item for display.
 */
export interface BreakdownItem {
  value: number;
  source: string;
}

/**
 * Full breakdown of a calculation.
 */
export interface Breakdown {
  items: BreakdownItem[];
  total: number;
  advantageState: 'none' | 'advantage' | 'disadvantage';
  advantageExplain?: string;
}

/**
 * Create a breakdown from a modifier stack.
 */
export function createBreakdown(stack: ModifierStack): Breakdown {
  const items = stack.modifiers.map((m) => ({
    value: m.value,
    source: m.source,
  }));

  const total = items.reduce((sum, item) => sum + item.value, 0);

  let advantageExplain: string | undefined;
  if (stack.advantageSources.length > 0 || stack.disadvantageSources.length > 0) {
    const parts: string[] = [];
    if (stack.advantageSources.length > 0) {
      parts.push(`Advantage: ${stack.advantageSources.join(', ')}`);
    }
    if (stack.disadvantageSources.length > 0) {
      parts.push(`Disadvantage: ${stack.disadvantageSources.join(', ')}`);
    }
    advantageExplain = parts.join(' | ');
  }

  return {
    items,
    total,
    advantageState: stack.advantageState,
    advantageExplain,
  };
}

/**
 * Format a number with explicit sign.
 */
export function formatSignedNumber(n: number): string {
  if (n >= 0) return `+${n}`;
  return `${n}`;
}

/**
 * Format a breakdown as a single-line string.
 */
export function formatBreakdownLine(breakdown: Breakdown): string {
  if (breakdown.items.length === 0) {
    return `Total: ${formatSignedNumber(breakdown.total)}`;
  }

  const parts = breakdown.items.map(
    (item) => `${formatSignedNumber(item.value)} (${item.source})`
  );

  let line = parts.join(' ') + ` = ${formatSignedNumber(breakdown.total)}`;

  if (breakdown.advantageState !== 'none') {
    line += ` [${breakdown.advantageState}]`;
  }

  return line;
}

/**
 * Format a breakdown as multiple lines for detailed display.
 */
export function formatBreakdownMultiline(breakdown: Breakdown): string[] {
  const lines: string[] = [];

  for (const item of breakdown.items) {
    lines.push(`  ${formatSignedNumber(item.value)} ${item.source}`);
  }

  lines.push(`  ────`);
  lines.push(`  ${formatSignedNumber(breakdown.total)} Total`);

  if (breakdown.advantageExplain) {
    lines.push(`  ${breakdown.advantageExplain}`);
  }

  return lines;
}

/**
 * Create a simple explain string from parts.
 */
export function buildExplainString(
  parts: Array<{ value: number; label: string }>,
  total: number
): string {
  const formatted = parts
    .filter((p) => p.value !== 0)
    .map((p) => `${formatSignedNumber(p.value)} (${p.label})`)
    .join(' ');

  return `${formatted} = ${formatSignedNumber(total)}`;
}
