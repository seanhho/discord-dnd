import type {
  BaseContext,
  StateCatalog,
  MachineDefinition,
  EffectRunner,
  StorageAdapter,
} from '@discord-bot/state-machine';
import { createEngine, createMachine } from '@discord-bot/state-machine';
import { ABILITIES } from '@discord-bot/dnd5e';
import type { Ability } from '@discord-bot/dnd5e';
import type { CharacterCreationRepo } from '../repo/ports.js';

type DraftAbilityScores = Partial<Record<Ability, number>>;

export interface CharacterCreationDraft {
  name?: string;
  class?: string;
  level?: number;
  abilities: DraftAbilityScores;
  hpMax?: number;
  ac?: number;
  speed?: number;
  weaponName?: string;
  weaponDamage?: string;
  weaponProficient?: boolean;
}

export type CharacterCreationState =
  | { type: 'Idle' }
  | { type: 'Name'; draft: CharacterCreationDraft }
  | { type: 'Class'; draft: CharacterCreationDraft }
  | { type: 'Level'; draft: CharacterCreationDraft }
  | { type: 'Ability'; draft: CharacterCreationDraft; abilityIndex: number }
  | { type: 'HP'; draft: CharacterCreationDraft }
  | { type: 'AC'; draft: CharacterCreationDraft }
  | { type: 'Speed'; draft: CharacterCreationDraft }
  | { type: 'WeaponName'; draft: CharacterCreationDraft }
  | { type: 'WeaponDamage'; draft: CharacterCreationDraft }
  | { type: 'WeaponProficient'; draft: CharacterCreationDraft }
  | { type: 'Review'; draft: CharacterCreationDraft }
  | { type: 'Complete'; draft: CharacterCreationDraft };

export type CharacterCreationEvent =
  | { type: 'START' }
  | { type: 'ANSWER'; value: string }
  | { type: 'BACK' }
  | { type: 'CANCEL' }
  | { type: 'FINISH' };

export interface CharacterCreationContext extends BaseContext {
  readonly userId: string;
  readonly guildId: string;
}

const catalog: StateCatalog<CharacterCreationEvent> = {
  machineName: 'CharacterCreation',
  version: '1.0.0',
  states: {
    Idle: { summary: 'No active creation', allowedEvents: ['START'] },
    Name: { summary: 'Collecting name', allowedEvents: ['ANSWER', 'BACK', 'CANCEL'] },
    Class: { summary: 'Collecting class', allowedEvents: ['ANSWER', 'BACK', 'CANCEL'] },
    Level: { summary: 'Collecting level', allowedEvents: ['ANSWER', 'BACK', 'CANCEL'] },
    Ability: { summary: 'Collecting ability scores', allowedEvents: ['ANSWER', 'BACK', 'CANCEL'] },
    HP: { summary: 'Collecting hit points', allowedEvents: ['ANSWER', 'BACK', 'CANCEL'] },
    AC: { summary: 'Collecting armor class', allowedEvents: ['ANSWER', 'BACK', 'CANCEL'] },
    Speed: { summary: 'Collecting movement speed', allowedEvents: ['ANSWER', 'BACK', 'CANCEL'] },
    WeaponName: { summary: 'Collecting weapon name', allowedEvents: ['ANSWER', 'BACK', 'CANCEL'] },
    WeaponDamage: { summary: 'Collecting weapon damage', allowedEvents: ['ANSWER', 'BACK', 'CANCEL'] },
    WeaponProficient: {
      summary: 'Collecting weapon proficiency',
      allowedEvents: ['ANSWER', 'BACK', 'CANCEL'],
    },
    Review: { summary: 'Reviewing draft', allowedEvents: ['FINISH', 'BACK', 'CANCEL'] },
    Complete: { summary: 'Complete', allowedEvents: ['START'] },
  },
};

const createDraft = (): CharacterCreationDraft => ({
  abilities: {},
});

const abilityLabel = (ability: Ability): string => {
  switch (ability) {
    case 'str':
      return 'STR (Strength)';
    case 'dex':
      return 'DEX (Dexterity)';
    case 'con':
      return 'CON (Constitution)';
    case 'int':
      return 'INT (Intelligence)';
    case 'wis':
      return 'WIS (Wisdom)';
    case 'cha':
      return 'CHA (Charisma)';
    default:
      return ability;
  }
};

const parseNumber = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const parseBoolean = (value: string): boolean | null => {
  const normalized = value.trim().toLowerCase();
  if (['yes', 'y', 'true', 't'].includes(normalized)) return true;
  if (['no', 'n', 'false', 'f'].includes(normalized)) return false;
  return null;
};

const isSkip = (value: string): boolean => value.trim().toLowerCase() === 'skip';

const clampRange = (value: number, min: number, max: number): boolean =>
  value >= min && value <= max;

const guardAnswer = (
  state: CharacterCreationState,
  value: string
): { ok: true } | { ok: false; reason: string } => {
  switch (state.type) {
    case 'Name': {
      if (!value.trim()) return { ok: false, reason: 'Please provide a name.' };
      if (value.trim().length > 100) {
        return { ok: false, reason: 'Name must be 100 characters or fewer.' };
      }
      return { ok: true };
    }
    case 'Class': {
      if (!value.trim()) return { ok: false, reason: 'Please provide a class.' };
      return { ok: true };
    }
    case 'Level': {
      const num = parseNumber(value);
      if (num === null || !Number.isInteger(num)) {
        return { ok: false, reason: 'Level must be a whole number.' };
      }
      if (!clampRange(num, 1, 20)) {
        return { ok: false, reason: 'Level must be between 1 and 20.' };
      }
      return { ok: true };
    }
    case 'Ability': {
      const num = parseNumber(value);
      if (num === null || !Number.isInteger(num)) {
        return { ok: false, reason: 'Ability score must be a whole number.' };
      }
      if (!clampRange(num, 1, 30)) {
        return { ok: false, reason: 'Ability score must be between 1 and 30.' };
      }
      return { ok: true };
    }
    case 'HP': {
      const num = parseNumber(value);
      if (num === null || !Number.isFinite(num)) {
        return { ok: false, reason: 'HP must be a number.' };
      }
      if (!clampRange(num, 1, 999)) {
        return { ok: false, reason: 'HP must be between 1 and 999.' };
      }
      return { ok: true };
    }
    case 'AC': {
      const num = parseNumber(value);
      if (num === null || !Number.isFinite(num)) {
        return { ok: false, reason: 'AC must be a number.' };
      }
      if (!clampRange(num, 1, 50)) {
        return { ok: false, reason: 'AC must be between 1 and 50.' };
      }
      return { ok: true };
    }
    case 'Speed': {
      const num = parseNumber(value);
      if (num === null || !Number.isFinite(num)) {
        return { ok: false, reason: 'Speed must be a number.' };
      }
      if (!clampRange(num, 0, 200)) {
        return { ok: false, reason: 'Speed must be between 0 and 200.' };
      }
      return { ok: true };
    }
    case 'WeaponName': {
      if (isSkip(value)) return { ok: true };
      if (!value.trim()) return { ok: false, reason: 'Provide a weapon name or type "skip".' };
      return { ok: true };
    }
    case 'WeaponDamage': {
      if (isSkip(value)) return { ok: true };
      if (!value.trim()) return { ok: false, reason: 'Provide damage dice or type "skip".' };
      return { ok: true };
    }
    case 'WeaponProficient': {
      if (isSkip(value)) return { ok: true };
      const parsed = parseBoolean(value);
      if (parsed === null) {
        return { ok: false, reason: 'Answer yes/no (or type "skip").' };
      }
      return { ok: true };
    }
    default:
      return { ok: true };
  }
};

const stepBack = (state: CharacterCreationState): CharacterCreationState => {
  if ('draft' in state) {
    switch (state.type) {
      case 'Name':
        return { type: 'Idle' };
      case 'Class':
        return { type: 'Name', draft: state.draft };
      case 'Level':
        return { type: 'Class', draft: state.draft };
      case 'Ability':
        if (state.abilityIndex > 0) {
          return {
            type: 'Ability',
            draft: state.draft,
            abilityIndex: state.abilityIndex - 1,
          };
        }
        return { type: 'Level', draft: state.draft };
      case 'HP':
        return {
          type: 'Ability',
          draft: state.draft,
          abilityIndex: ABILITIES.length - 1,
        };
      case 'AC':
        return { type: 'HP', draft: state.draft };
      case 'Speed':
        return { type: 'AC', draft: state.draft };
      case 'WeaponName':
        return { type: 'Speed', draft: state.draft };
      case 'WeaponDamage':
        return { type: 'WeaponName', draft: state.draft };
      case 'WeaponProficient':
        return { type: 'WeaponDamage', draft: state.draft };
      case 'Review':
        return { type: 'WeaponProficient', draft: state.draft };
      default:
        return state;
    }
  }
  return state;
};

const applyAnswer = (
  state: CharacterCreationState,
  value: string
): CharacterCreationState => {
  if (!('draft' in state)) return state;

  switch (state.type) {
    case 'Name':
      return { type: 'Class', draft: { ...state.draft, name: value.trim() } };
    case 'Class':
      return { type: 'Level', draft: { ...state.draft, class: value.trim() } };
    case 'Level': {
      const level = Number(value);
      return { type: 'Ability', draft: { ...state.draft, level }, abilityIndex: 0 };
    }
    case 'Ability': {
      const ability = ABILITIES[state.abilityIndex];
      const abilities = { ...state.draft.abilities, [ability]: Number(value) };
      if (state.abilityIndex < ABILITIES.length - 1) {
        return {
          type: 'Ability',
          draft: { ...state.draft, abilities },
          abilityIndex: state.abilityIndex + 1,
        };
      }
      return { type: 'HP', draft: { ...state.draft, abilities } };
    }
    case 'HP': {
      const hpMax = Number(value);
      return { type: 'AC', draft: { ...state.draft, hpMax } };
    }
    case 'AC': {
      const ac = Number(value);
      return { type: 'Speed', draft: { ...state.draft, ac } };
    }
    case 'Speed': {
      const speed = Number(value);
      return { type: 'WeaponName', draft: { ...state.draft, speed } };
    }
    case 'WeaponName': {
      const weaponName = isSkip(value) ? undefined : value.trim();
      return { type: 'WeaponDamage', draft: { ...state.draft, weaponName } };
    }
    case 'WeaponDamage': {
      const weaponDamage = isSkip(value) ? undefined : value.trim();
      return { type: 'WeaponProficient', draft: { ...state.draft, weaponDamage } };
    }
    case 'WeaponProficient': {
      const weaponProficient = isSkip(value) ? undefined : parseBoolean(value) ?? undefined;
      return { type: 'Review', draft: { ...state.draft, weaponProficient } };
    }
    default:
      return state;
  }
};

const definition: MachineDefinition<
  CharacterCreationState,
  CharacterCreationEvent,
  CharacterCreationContext
> = {
  getStateKey: (state) => state.type,
  getInitialState: () => ({ type: 'Idle' }),
  reducer: (state, event) => {
    switch (event.type) {
      case 'START':
        return { state: { type: 'Name', draft: createDraft() } };
      case 'CANCEL':
        return { state: { type: 'Idle' } };
      case 'BACK':
        return { state: stepBack(state) };
      case 'ANSWER':
        return { state: applyAnswer(state, event.value) };
      case 'FINISH':
        if (state.type === 'Review') {
          return { state: { type: 'Complete', draft: state.draft } };
        }
        return { state };
      default:
        return { state };
    }
  },
  effects: () => [],
  guard: (event, state) => {
    if (event.type === 'ANSWER') {
      return guardAnswer(state, event.value);
    }
    return { ok: true };
  },
};

class CharacterCreationStorage implements StorageAdapter<CharacterCreationState> {
  constructor(
    private readonly repo: CharacterCreationRepo,
    private readonly userId: string,
    private readonly guildId: string
  ) {}

  async load(instanceId: string) {
    const record = await this.repo.getByInstanceId(instanceId);
    if (!record) return null;
    return {
      state: record.state as CharacterCreationState,
      meta: record.meta as { catalogVersion: string; updatedAt: string; stateKey?: string },
    };
  }

  async save(instanceId: string, state: CharacterCreationState, meta: unknown) {
    await this.repo.upsertState({
      instanceId,
      userId: this.userId,
      guildId: this.guildId,
      state,
      meta,
    });
  }

  async delete(instanceId: string) {
    await this.repo.deleteByInstanceId(instanceId);
  }
}

class NoopEffectRunner
  implements EffectRunner<CharacterCreationEvent, CharacterCreationContext>
{
  async run(): Promise<void> {}
}

export function createCharacterCreationEngine(
  repo: CharacterCreationRepo,
  userId: string,
  guildId: string
) {
  const machine = createMachine(definition, catalog);
  const storage = new CharacterCreationStorage(repo, userId, guildId);
  return createEngine(machine, {
    storage,
    effectRunner: new NoopEffectRunner(),
    createContext: (instanceId: string) => ({
      instanceId,
      timestamp: new Date().toISOString(),
      userId,
      guildId,
    }),
  });
}

export function formatPrompt(state: CharacterCreationState): string {
  if (state.type === 'Idle') {
    return 'No active character creation. Use `/char create action:start` to begin.';
  }

  if (state.type === 'Complete') {
    return 'Character creation complete! You can start another with `/char create action:start`.';
  }

  if (state.type === 'Review') {
    return [
      '**Review your character:**',
      formatReview(state.draft),
      '',
      'If everything looks good, use `/char create action:finish`.',
      'Or use `/char create action:back` to edit the last step.',
    ].join('\n');
  }

  if (state.type === 'Name') {
    return 'Step 1: What is your character name?';
  }

  if (state.type === 'Class') {
    return 'Step 2: What is your class? (e.g., Fighter, Wizard)';
  }

  if (state.type === 'Level') {
    return 'Step 3: What is your level? (1-20)';
  }

  if (state.type === 'Ability') {
    const ability = ABILITIES[state.abilityIndex];
    return `Step 4: Enter your ${abilityLabel(ability)} score (1-30).`;
  }

  if (state.type === 'HP') {
    return 'Step 5: What is your max HP?';
  }

  if (state.type === 'AC') {
    return 'Step 6: What is your Armor Class (AC)?';
  }

  if (state.type === 'Speed') {
    return 'Step 7: What is your speed (in feet)?';
  }

  if (state.type === 'WeaponName') {
    return 'Step 8: Primary weapon name? (or type "skip")';
  }

  if (state.type === 'WeaponDamage') {
    return 'Step 9: Weapon damage dice (e.g., 1d8+3) or type "skip".';
  }

  if (state.type === 'WeaponProficient') {
    return 'Step 10: Are you proficient with the weapon? (yes/no or "skip")';
  }

  return 'Continue with `/char create action:answer input:<value>`.';
}

export function formatReview(draft: CharacterCreationDraft): string {
  const lines: string[] = [];
  lines.push(`Name: ${draft.name ?? '—'}`);
  lines.push(`Class: ${draft.class ?? '—'}`);
  lines.push(`Level: ${draft.level ?? '—'}`);
  lines.push('Abilities:');
  for (const ability of ABILITIES) {
    lines.push(`  ${abilityLabel(ability)}: ${draft.abilities[ability] ?? '—'}`);
  }
  lines.push(`HP Max: ${draft.hpMax ?? '—'}`);
  lines.push(`AC: ${draft.ac ?? '—'}`);
  lines.push(`Speed: ${draft.speed ?? '—'} ft`);
  if (draft.weaponName || draft.weaponDamage || draft.weaponProficient !== undefined) {
    lines.push('Weapon:');
    lines.push(`  Name: ${draft.weaponName ?? '—'}`);
    lines.push(`  Damage: ${draft.weaponDamage ?? '—'}`);
    lines.push(
      `  Proficient: ${
        draft.weaponProficient === undefined ? '—' : draft.weaponProficient ? 'Yes' : 'No'
      }`
    );
  }
  return lines.join('\n');
}
