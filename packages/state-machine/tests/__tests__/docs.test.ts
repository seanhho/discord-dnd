/**
 * Documentation generation tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateMarkdown,
  generateMermaid,
  getStateSummaries,
  type StateCatalog,
} from '../../src/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Test Types
// ─────────────────────────────────────────────────────────────────────────────

type TestEvent =
  | { type: 'START' }
  | { type: 'NEXT' }
  | { type: 'TIMEOUT' };

// ─────────────────────────────────────────────────────────────────────────────
// Test Catalog
// ─────────────────────────────────────────────────────────────────────────────

const testCatalog: StateCatalog<TestEvent> = {
  machineName: 'DocumentationTest',
  version: '2.0.0',
  description: 'A machine for testing documentation generation.',
  states: {
    Idle: {
      summary: 'Waiting for input',
      description: 'The system is idle and waiting for the user to start.',
      allowedEvents: ['START'],
      tags: ['initial', 'waiting'],
    },
    Processing: {
      summary: 'Processing data',
      allowedEvents: ['NEXT', 'TIMEOUT'],
      timeout: {
        seconds: 30,
        onTimeoutEvent: { type: 'TIMEOUT' },
      },
      view: {
        templateId: 'processing-template',
        title: 'Please Wait',
      },
      tags: ['active'],
    },
    Complete: {
      summary: 'Processing complete',
      allowedEvents: [],
      terminal: true,
      tags: ['terminal'],
    },
  },
  transitionTable: [
    { fromStateKey: 'Idle', eventType: 'START', toStateKey: 'Processing', description: 'Begin processing' },
    { fromStateKey: 'Processing', eventType: 'NEXT', toStateKey: 'Complete', description: 'Finish successfully' },
    { fromStateKey: 'Processing', eventType: 'TIMEOUT', toStateKey: 'Complete', description: 'Timeout occurred' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Markdown Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('generateMarkdown', () => {
  it('should include machine name and version', () => {
    const markdown = generateMarkdown(testCatalog);

    expect(markdown).toContain('# DocumentationTest');
    expect(markdown).toContain('**Version:** 2.0.0');
  });

  it('should include machine description', () => {
    const markdown = generateMarkdown(testCatalog);

    expect(markdown).toContain('A machine for testing documentation generation.');
  });

  it('should include state sections', () => {
    const markdown = generateMarkdown(testCatalog);

    expect(markdown).toContain('### Idle');
    expect(markdown).toContain('### Processing');
    expect(markdown).toContain('### Complete');
  });

  it('should include state summaries', () => {
    const markdown = generateMarkdown(testCatalog);

    expect(markdown).toContain('**Summary:** Waiting for input');
    expect(markdown).toContain('**Summary:** Processing data');
  });

  it('should include allowed events', () => {
    const markdown = generateMarkdown(testCatalog);

    expect(markdown).toContain('`START`');
    expect(markdown).toContain('`NEXT`');
    expect(markdown).toContain('`TIMEOUT`');
  });

  it('should include timeout information', () => {
    const markdown = generateMarkdown(testCatalog);

    expect(markdown).toContain('**Timeout:** 30s');
    expect(markdown).toContain('`TIMEOUT`');
  });

  it('should include tags', () => {
    const markdown = generateMarkdown(testCatalog);

    expect(markdown).toContain('**Tags:**');
    expect(markdown).toContain('`initial`');
    expect(markdown).toContain('`waiting`');
  });

  it('should indicate terminal states', () => {
    const markdown = generateMarkdown(testCatalog);

    expect(markdown).toContain('**Terminal State:** Yes');
  });

  it('should include transition table', () => {
    const markdown = generateMarkdown(testCatalog);

    expect(markdown).toContain('## Transition Table');
    expect(markdown).toContain('| Idle | `START` | Processing |');
    expect(markdown).toContain('Begin processing');
  });

  it('should include events summary', () => {
    const markdown = generateMarkdown(testCatalog);

    expect(markdown).toContain('## Events Summary');
    expect(markdown).toContain('`START` - allowed in: Idle');
    expect(markdown).toContain('`NEXT` - allowed in: Processing');
  });

  it('should respect options', () => {
    const markdown = generateMarkdown(testCatalog, {
      includeTimeouts: false,
      includeTags: false,
      includeTransitionTable: false,
    });

    expect(markdown).not.toContain('**Timeout:**');
    expect(markdown).not.toContain('**Tags:**');
    expect(markdown).not.toContain('## Transition Table');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mermaid Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('generateMermaid', () => {
  it('should generate valid mermaid syntax', () => {
    const mermaid = generateMermaid(testCatalog);

    expect(mermaid).toContain('```mermaid');
    expect(mermaid).toContain('stateDiagram-v2');
    expect(mermaid).toContain('```');
  });

  it('should include direction', () => {
    const mermaid = generateMermaid(testCatalog, { direction: 'LR' });

    expect(mermaid).toContain('direction LR');
  });

  it('should include state definitions', () => {
    const mermaid = generateMermaid(testCatalog);

    expect(mermaid).toContain('Idle: Idle');
    expect(mermaid).toContain('Processing: Processing');
    expect(mermaid).toContain('Complete: Complete');
  });

  it('should mark terminal states', () => {
    const mermaid = generateMermaid(testCatalog);

    expect(mermaid).toContain('Complete --> [*]');
  });

  it('should include initial state arrow', () => {
    const mermaid = generateMermaid(testCatalog);

    expect(mermaid).toContain('[*] --> Idle');
  });

  it('should include transitions with labels', () => {
    const mermaid = generateMermaid(testCatalog);

    expect(mermaid).toContain('Idle --> Processing: START');
    expect(mermaid).toContain('Processing --> Complete: NEXT');
    expect(mermaid).toContain('Processing --> Complete: TIMEOUT');
  });

  it('should omit labels when configured', () => {
    const mermaid = generateMermaid(testCatalog, { includeEventLabels: false });

    expect(mermaid).toContain('Idle --> Processing');
    expect(mermaid).not.toContain(': START');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// State Summary Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('getStateSummaries', () => {
  it('should return summaries for all states', () => {
    const summaries = getStateSummaries(testCatalog);

    expect(summaries).toHaveLength(3);
  });

  it('should include correct fields', () => {
    const summaries = getStateSummaries(testCatalog);
    const idle = summaries.find((s) => s.key === 'Idle')!;

    expect(idle.key).toBe('Idle');
    expect(idle.summary).toBe('Waiting for input');
    expect(idle.allowedEvents).toEqual(['START']);
    expect(idle.hasTimeout).toBe(false);
    expect(idle.isTerminal).toBe(false);
    expect(idle.tags).toEqual(['initial', 'waiting']);
  });

  it('should include timeout info', () => {
    const summaries = getStateSummaries(testCatalog);
    const processing = summaries.find((s) => s.key === 'Processing')!;

    expect(processing.hasTimeout).toBe(true);
    expect(processing.timeoutSeconds).toBe(30);
  });

  it('should identify terminal states', () => {
    const summaries = getStateSummaries(testCatalog);
    const complete = summaries.find((s) => s.key === 'Complete')!;

    expect(complete.isTerminal).toBe(true);
  });
});
