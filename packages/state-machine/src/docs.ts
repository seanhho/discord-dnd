/**
 * Documentation generation from state catalogs.
 */

import type { BaseEvent } from './types.js';
import type { StateCatalog } from './catalog.js';

// ─────────────────────────────────────────────────────────────────────────────
// Markdown Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for markdown generation.
 */
export interface MarkdownOptions {
  /** Include state descriptions */
  includeDescriptions?: boolean;
  /** Include timeout information */
  includeTimeouts?: boolean;
  /** Include view metadata */
  includeViews?: boolean;
  /** Include tags */
  includeTags?: boolean;
  /** Include transition table */
  includeTransitionTable?: boolean;
}

const DEFAULT_MARKDOWN_OPTIONS: Required<MarkdownOptions> = {
  includeDescriptions: true,
  includeTimeouts: true,
  includeViews: false,
  includeTags: true,
  includeTransitionTable: true,
};

/**
 * Generate markdown documentation from a catalog.
 */
export function generateMarkdown<E extends BaseEvent>(
  catalog: StateCatalog<E>,
  options: MarkdownOptions = {}
): string {
  const opts = { ...DEFAULT_MARKDOWN_OPTIONS, ...options };
  const lines: string[] = [];

  // Header
  lines.push(`# ${catalog.machineName}`);
  lines.push('');
  lines.push(`**Version:** ${catalog.version}`);
  lines.push('');

  if (catalog.description) {
    lines.push(catalog.description);
    lines.push('');
  }

  // States section
  lines.push('## States');
  lines.push('');

  const stateEntries = Object.entries(catalog.states);
  for (const [stateKey, descriptor] of stateEntries) {
    lines.push(`### ${stateKey}`);
    lines.push('');
    lines.push(`**Summary:** ${descriptor.summary}`);
    lines.push('');

    if (opts.includeDescriptions && descriptor.description) {
      lines.push(descriptor.description);
      lines.push('');
    }

    // Allowed events
    lines.push('**Allowed Events:**');
    if (descriptor.allowedEvents.length > 0) {
      for (const eventType of descriptor.allowedEvents) {
        lines.push(`- \`${eventType}\``);
      }
    } else {
      lines.push('- *(none)*');
    }
    lines.push('');

    // Timeout
    if (opts.includeTimeouts && descriptor.timeout) {
      lines.push(
        `**Timeout:** ${descriptor.timeout.seconds}s → \`${descriptor.timeout.onTimeoutEvent.type}\``
      );
      lines.push('');
    }

    // Tags
    if (opts.includeTags && descriptor.tags && descriptor.tags.length > 0) {
      lines.push(`**Tags:** ${descriptor.tags.map((t) => `\`${t}\``).join(', ')}`);
      lines.push('');
    }

    // Terminal
    if (descriptor.terminal) {
      lines.push('**Terminal State:** Yes');
      lines.push('');
    }
  }

  // Transition table
  if (opts.includeTransitionTable && catalog.transitionTable && catalog.transitionTable.length > 0) {
    lines.push('## Transition Table');
    lines.push('');
    lines.push('| From | Event | To | Description |');
    lines.push('|------|-------|-----|-------------|');

    for (const entry of catalog.transitionTable) {
      const desc = entry.description ?? '';
      lines.push(`| ${entry.fromStateKey} | \`${entry.eventType}\` | ${entry.toStateKey} | ${desc} |`);
    }
    lines.push('');
  }

  // Event summary
  lines.push('## Events Summary');
  lines.push('');
  const allEvents = new Set<string>();
  for (const descriptor of Object.values(catalog.states)) {
    for (const eventType of descriptor.allowedEvents) {
      allEvents.add(eventType);
    }
  }
  const sortedEvents = Array.from(allEvents).sort();
  for (const eventType of sortedEvents) {
    const statesAllowing = stateEntries
      .filter(([, d]) => d.allowedEvents.includes(eventType))
      .map(([k]) => k);
    lines.push(`- \`${eventType}\` - allowed in: ${statesAllowing.join(', ')}`);
  }
  lines.push('');

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Mermaid Diagram Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for Mermaid diagram generation.
 */
export interface MermaidOptions {
  /** Diagram direction (TB = top-bottom, LR = left-right) */
  direction?: 'TB' | 'LR';
  /** Include event labels on transitions */
  includeEventLabels?: boolean;
}

const DEFAULT_MERMAID_OPTIONS: Required<MermaidOptions> = {
  direction: 'TB',
  includeEventLabels: true,
};

/**
 * Generate a Mermaid state diagram from a catalog.
 *
 * Note: This uses the transitionTable if available. Without it,
 * we can only show states and their allowed events, not actual transitions.
 */
export function generateMermaid<E extends BaseEvent>(
  catalog: StateCatalog<E>,
  options: MermaidOptions = {}
): string {
  const opts = { ...DEFAULT_MERMAID_OPTIONS, ...options };
  const lines: string[] = [];

  lines.push('```mermaid');
  lines.push(`stateDiagram-v2`);
  lines.push(`    direction ${opts.direction}`);
  lines.push('');

  // Sanitize state key for Mermaid (replace dots with underscores)
  const sanitize = (key: string) => key.replace(/\./g, '_');

  // Add state definitions
  for (const [stateKey, descriptor] of Object.entries(catalog.states)) {
    const sanitized = sanitize(stateKey);
    lines.push(`    ${sanitized}: ${stateKey}`);
    if (descriptor.terminal) {
      lines.push(`    ${sanitized} --> [*]`);
    }
  }
  lines.push('');

  // Find initial state (first one, or one with no incoming transitions)
  const stateKeys = Object.keys(catalog.states);
  const firstStateKey = stateKeys[0];
  if (firstStateKey) {
    lines.push(`    [*] --> ${sanitize(firstStateKey)}`);
  }

  // Add transitions from transition table
  if (catalog.transitionTable && catalog.transitionTable.length > 0) {
    lines.push('');
    for (const entry of catalog.transitionTable) {
      const from = sanitize(entry.fromStateKey);
      const to = sanitize(entry.toStateKey);
      if (opts.includeEventLabels) {
        lines.push(`    ${from} --> ${to}: ${entry.eventType}`);
      } else {
        lines.push(`    ${from} --> ${to}`);
      }
    }
  }

  lines.push('```');

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// State Summary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Summary information for a state.
 */
export interface StateSummary {
  key: string;
  summary: string;
  allowedEvents: string[];
  hasTimeout: boolean;
  timeoutSeconds?: number;
  isTerminal: boolean;
  tags: string[];
}

/**
 * Get a summary of all states in a catalog.
 */
export function getStateSummaries<E extends BaseEvent>(
  catalog: StateCatalog<E>
): StateSummary[] {
  return Object.entries(catalog.states).map(([key, descriptor]) => ({
    key,
    summary: descriptor.summary,
    allowedEvents: descriptor.allowedEvents,
    hasTimeout: !!descriptor.timeout,
    timeoutSeconds: descriptor.timeout?.seconds,
    isTerminal: descriptor.terminal ?? false,
    tags: descriptor.tags ?? [],
  }));
}
