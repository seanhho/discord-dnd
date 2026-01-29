import { isCharKvKey, ABILITIES } from '@discord-bot/dnd5e-types';
import type { CharacterRepo, UserRepo } from '../repo/ports.js';
import { applyPatch } from '../kv/service.js';
import type { WizardDraft } from './types.js';

function escapeString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function formatValue(value: string | number | boolean): string {
  if (typeof value === 'string') {
    return `"${escapeString(value)}"`;
  }
  return String(value);
}

function buildPatchEntries(draft: WizardDraft): [string, string | number][] {
  const entries: [string, string | number][] = [];

  if (draft.name) {
    entries.push(['name', draft.name]);
  }
  if (draft.class) {
    entries.push(['class', draft.class]);
  }
  if (draft.level !== undefined) {
    entries.push(['level', draft.level]);
  }
  if (draft.race) {
    entries.push(['race', draft.race]);
  }
  if (draft.background) {
    entries.push(['background', draft.background]);
  }

  for (const ability of ABILITIES) {
    const value = draft.abilities[ability];
    if (value !== undefined) {
      entries.push([ability, value]);
    }
  }

  return entries.filter(([key]) => isCharKvKey(key));
}

export function buildPatchString(draft: WizardDraft): {
  patchString: string;
  appliedKeys: string[];
} {
  const entries = buildPatchEntries(draft);
  const patch = entries
    .map(([key, value]) => `${key}:${formatValue(value)}`)
    .join(', ');

  return {
    patchString: `{${patch}}`,
    appliedKeys: entries.map(([key]) => key),
  };
}

export async function applyWizardPatch(params: {
  discordUserId: string;
  guildId: string;
  draft: WizardDraft;
  userRepo: UserRepo;
  characterRepo: CharacterRepo;
}): Promise<{ success: true; characterName: string; appliedKeys: string[] } | { success: false; error: string }> {
  const { discordUserId, guildId, draft, userRepo, characterRepo } = params;

  const user = await userRepo.getOrCreateByDiscordUserId(discordUserId);
  if (!draft.name) {
    return { success: false, error: 'Character name is required.' };
  }

  let character = await characterRepo.getByName({
    userId: user.id,
    guildId,
    name: draft.name,
  });

  if (!character) {
    character = await characterRepo.createCharacter({
      userId: user.id,
      guildId,
      name: draft.name,
    });
  }

  const { patchString, appliedKeys } = buildPatchString(draft);
  const result = await applyPatch(character, patchString, characterRepo);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  await characterRepo.setActiveCharacter({
    userId: user.id,
    guildId,
    characterId: result.character.id,
  });

  return {
    success: true,
    characterName: result.character.name,
    appliedKeys,
  };
}
