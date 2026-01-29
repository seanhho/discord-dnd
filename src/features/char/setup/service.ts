/**
 * Character Setup Wizard Service
 *
 * Integrates wizard with existing /char set logic.
 */

import { ABILITIES } from '@discord-bot/dnd5e-types';
import type { CharacterRepo, UserRepo, AttributeValue } from '@discord-bot/persistence';
import { AttrValue } from '@discord-bot/persistence';
import type { CharacterDraft } from './types.js';

/**
 * Build a patch object from the wizard draft.
 * Returns a formatted string for the existing applyPatch function.
 */
export function buildPatchString(draft: CharacterDraft): string {
  const entries: string[] = [];

  if (draft.name) {
    entries.push(`name:"${draft.name.replace(/"/g, '\\"')}"`);
  }
  if (draft.class) {
    entries.push(`class:"${draft.class.replace(/"/g, '\\"')}"`);
  }
  if (draft.level !== undefined) {
    entries.push(`level:${draft.level}`);
  }
  if (draft.race) {
    entries.push(`race:"${draft.race.replace(/"/g, '\\"')}"`);
  }
  if (draft.background) {
    entries.push(`background:"${draft.background.replace(/"/g, '\\"')}"`);
  }

  if (draft.abilities) {
    for (const ability of ABILITIES) {
      const value = draft.abilities[ability];
      if (value !== undefined) {
        entries.push(`${ability}:${value}`);
      }
    }
  }

  return `{${entries.join(', ')}}`;
}

/**
 * Build a typed patch object from the wizard draft.
 */
export function buildPatchObject(
  draft: CharacterDraft
): Record<string, AttributeValue> {
  const patch: Record<string, AttributeValue> = {};

  if (draft.name) {
    patch['name'] = AttrValue.str(draft.name);
  }
  if (draft.class) {
    patch['class'] = AttrValue.str(draft.class);
  }
  if (draft.level !== undefined) {
    patch['level'] = AttrValue.num(draft.level);
  }
  if (draft.race) {
    patch['race'] = AttrValue.str(draft.race);
  }
  if (draft.background) {
    patch['background'] = AttrValue.str(draft.background);
  }

  if (draft.abilities) {
    for (const ability of ABILITIES) {
      const value = draft.abilities[ability];
      if (value !== undefined) {
        patch[ability] = AttrValue.num(value);
      }
    }
  }

  return patch;
}

/**
 * Validate the draft before committing.
 * Returns error message if invalid, undefined if valid.
 */
export function validateDraft(draft: CharacterDraft): string | undefined {
  // Required fields
  if (!draft.name?.trim()) {
    return 'Character name is required.';
  }
  if (!draft.class?.trim()) {
    return 'Character class is required.';
  }
  if (draft.level === undefined) {
    return 'Character level is required.';
  }

  // Level range
  if (draft.level < 1 || draft.level > 20) {
    return 'Level must be between 1 and 20.';
  }

  // Ability score ranges
  if (draft.abilities) {
    for (const ability of ABILITIES) {
      const value = draft.abilities[ability];
      if (value !== undefined) {
        if (!Number.isInteger(value)) {
          return `${ability.toUpperCase()} must be a whole number.`;
        }
        if (value < 1 || value > 30) {
          return `${ability.toUpperCase()} must be between 1 and 30.`;
        }
      }
    }
  }

  return undefined;
}

/**
 * Apply the wizard draft to create/update a character.
 * Uses the same validation and persistence path as /char set.
 */
export async function applyPatchFromDraft(
  discordUserId: string,
  guildId: string | null,
  characterName: string,
  draft: CharacterDraft,
  userRepo: UserRepo,
  characterRepo: CharacterRepo
): Promise<{ success: true; characterId: string } | { success: false; error: string }> {
  // Validate draft
  const validationError = validateDraft(draft);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // Get or create user
  const user = await userRepo.getOrCreateByDiscordUserId(discordUserId);

  // Use 'DM' as guildId for DMs
  const effectiveGuildId = guildId ?? 'DM';

  // Get or create character
  let character = await characterRepo.getByName({
    userId: user.id,
    guildId: effectiveGuildId,
    name: characterName,
  });

  if (!character) {
    character = await characterRepo.createCharacter({
      userId: user.id,
      guildId: effectiveGuildId,
      name: characterName,
    });
  }

  // Build and apply patch
  const patch = buildPatchObject(draft);

  try {
    const updatedCharacter = await characterRepo.updateAttributes({
      characterId: character.id,
      patch,
    });

    // Set as active character
    await characterRepo.setActiveCharacter({
      userId: user.id,
      guildId: effectiveGuildId,
      characterId: updatedCharacter.id,
    });

    return { success: true, characterId: updatedCharacter.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}
