import { ABILITIES } from '@discord-bot/dnd5e-types';
import type { WizardState, WizardView, WizardViewField } from './types.js';

const STEP_ORDER: WizardState['type'][] = [
  'identity',
  'abilities_primary',
  'abilities_secondary',
  'optional',
  'review',
];

function formatValue(value?: string | number): string {
  if (value === undefined || value === null || value === '') {
    return '_Not set_';
  }
  return String(value);
}

function abilityFields(
  state: WizardState,
  abilities: readonly string[]
): WizardViewField[] {
  return abilities.map((ability) => ({
    name: ability.toUpperCase(),
    value: formatValue(state.draft.abilities[ability as keyof typeof state.draft.abilities]),
    inline: true,
  }));
}

function progressFor(step: WizardState['type']): string {
  const index = STEP_ORDER.indexOf(step);
  if (index === -1) {
    return '';
  }
  return `Step ${index + 1} of ${STEP_ORDER.length}`;
}

export function buildWizardView(state: WizardState): WizardView {
  const progress = progressFor(state.type);

  if (state.type === 'identity') {
    return {
      title: 'Character Setup: Identity',
      description: 'Let’s start with the basics.',
      progress,
      step: state.type,
      errors: state.lastError ? [state.lastError] : undefined,
      fields: [
        { name: 'Name', value: formatValue(state.draft.name) },
        { name: 'Class', value: formatValue(state.draft.class) },
        { name: 'Level', value: formatValue(state.draft.level) },
      ],
    };
  }

  if (state.type === 'abilities_primary') {
    return {
      title: 'Character Setup: Ability Scores (1/2)',
      description: 'Set STR, DEX, and CON.',
      progress,
      step: state.type,
      errors: state.lastError ? [state.lastError] : undefined,
      fields: abilityFields(state, ABILITIES.slice(0, 3)),
    };
  }

  if (state.type === 'abilities_secondary') {
    return {
      title: 'Character Setup: Ability Scores (2/2)',
      description: 'Set INT, WIS, and CHA.',
      progress,
      step: state.type,
      errors: state.lastError ? [state.lastError] : undefined,
      fields: abilityFields(state, ABILITIES.slice(3, 6)),
    };
  }

  if (state.type === 'optional') {
    return {
      title: 'Character Setup: Optional Basics',
      description: 'Fill these in if you want.',
      progress,
      step: state.type,
      errors: state.lastError ? [state.lastError] : undefined,
      fields: [
        { name: 'Race', value: formatValue(state.draft.race) },
        { name: 'Background', value: formatValue(state.draft.background) },
      ],
    };
  }

  if (state.type === 'review') {
    return {
      title: 'Character Setup: Review',
      description: 'Confirm the details before saving.',
      progress,
      step: state.type,
      errors: state.lastError ? [state.lastError] : undefined,
      fields: [
        { name: 'Name', value: formatValue(state.draft.name) },
        { name: 'Class', value: formatValue(state.draft.class) },
        { name: 'Level', value: formatValue(state.draft.level) },
        ...abilityFields(state, ABILITIES),
        { name: 'Race', value: formatValue(state.draft.race) },
        { name: 'Background', value: formatValue(state.draft.background) },
      ],
    };
  }

  if (state.type === 'committing') {
    return {
      title: 'Character Setup: Saving',
      description: 'Applying your character data...',
      progress,
      step: state.type,
      fields: [],
    };
  }

  return {
    title: 'Character Setup',
    description: 'Wizard status update.',
    progress,
    step: state.type,
    fields: [],
  };
}
