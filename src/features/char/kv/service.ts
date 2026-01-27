/**
 * Character attribute service.
 *
 * Handles patch application, cross-field validation, and diff generation.
 */

import type {
  AttributeValue,
  Character,
  DiffEntry,
  SetResult,
  UnsetResult,
  ComputedValues,
} from '../types.js';
import { AttrValue } from '../types.js';
import type { CharacterRepo } from '../repo/ports.js';
import { parsePatch } from './parser.js';
import { validatePatch } from './validators.js';
import { deriveComputed } from '../computed/derive.js';
import { getKeyConfig } from './kv.config.js';

/**
 * Build an AttributeValue from a validated value.
 */
function toAttrValue(
  coercedType: 'number' | 'boolean' | 'string',
  value: number | boolean | string
): AttributeValue {
  switch (coercedType) {
    case 'number':
      return AttrValue.num(value as number);
    case 'boolean':
      return AttrValue.bool(value as boolean);
    case 'string':
      return AttrValue.str(value as string);
  }
}

/**
 * Extract the raw value from an AttributeValue.
 */
function fromAttrValue(attr: AttributeValue): number | boolean | string {
  return attr.v;
}

/**
 * Perform cross-field validation on the effective attributes.
 *
 * @param effective - Merged attributes (existing + patch)
 * @returns Error message if validation fails, undefined otherwise
 */
export function crossFieldValidation(
  effective: Record<string, AttributeValue>
): string | undefined {
  const hpCurrent = effective['hp.current'];
  const hpMax = effective['hp.max'];

  // If both hp.current and hp.max exist, enforce hp.current <= hp.max
  if (hpCurrent && hpMax && hpCurrent.t === 'n' && hpMax.t === 'n') {
    if (hpCurrent.v > hpMax.v) {
      return `hp.current (${hpCurrent.v}) cannot exceed hp.max (${hpMax.v})`;
    }
  }

  return undefined;
}

/**
 * Generate diff entries for a patch.
 */
function generateDiff(
  existing: Record<string, AttributeValue>,
  patch: Record<string, AttributeValue>
): DiffEntry[] {
  const diff: DiffEntry[] = [];

  for (const [key, newAttr] of Object.entries(patch)) {
    const oldAttr = existing[key];
    const config = getKeyConfig(key);

    diff.push({
      key,
      oldValue: oldAttr ? fromAttrValue(oldAttr) : undefined,
      newValue: fromAttrValue(newAttr),
      affectsComputed: config?.affectsComputed ?? false,
    });
  }

  return diff;
}

/**
 * Format a diff entry for display.
 */
export function formatDiffEntry(entry: DiffEntry): string {
  const newStr =
    typeof entry.newValue === 'string' ? `"${entry.newValue}"` : String(entry.newValue);

  if (entry.oldValue === undefined) {
    return `  ${entry.key}: ${newStr} (new)`;
  }

  const oldStr =
    typeof entry.oldValue === 'string' ? `"${entry.oldValue}"` : String(entry.oldValue);

  if (oldStr === newStr) {
    return `  ${entry.key}: ${newStr} (unchanged)`;
  }

  return `  ${entry.key}: ${oldStr} -> ${newStr}`;
}

/**
 * Apply a patch to a character's attributes.
 *
 * This is the main entry point for /char set.
 *
 * @param character - Existing character
 * @param patchString - Raw patch string from user input
 * @param characterRepo - Character repository for persistence
 * @returns Set result with updated character, diff, and warnings
 */
export async function applyPatch(
  character: Character,
  patchString: string,
  characterRepo: CharacterRepo
): Promise<SetResult> {
  // 1. Parse the patch string
  const parseResult = parsePatch(patchString);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error };
  }

  if (parseResult.entries.length === 0) {
    return { success: false, error: 'No attributes to update. Patch is empty.' };
  }

  // 2. Validate and coerce values
  const validationResult = validatePatch(parseResult.entries);
  if (!validationResult.success) {
    return {
      success: false,
      error: `Validation failed:\n${validationResult.errors.join('\n')}`,
    };
  }

  // 3. Build the patch record
  const patch: Record<string, AttributeValue> = {};
  for (const validation of validationResult.validations) {
    if (validation.valid) {
      patch[validation.key] = toAttrValue(validation.coercedType, validation.value);
    }
  }

  // 4. Build effective attributes (existing + patch)
  const effective = { ...character.attributes, ...patch };

  // 5. Cross-field validation
  const crossFieldError = crossFieldValidation(effective);
  if (crossFieldError) {
    return { success: false, error: crossFieldError };
  }

  // 6. Generate diff
  const diff = generateDiff(character.attributes, patch);

  // 7. Apply to database
  const updatedCharacter = await characterRepo.updateAttributes({
    characterId: character.id,
    patch,
  });

  // 8. Compute derived values if any affectsComputed keys changed
  const anyAffectsComputed = diff.some((d) => d.affectsComputed);
  let computed: ComputedValues = {};
  if (anyAffectsComputed) {
    computed = deriveComputed(updatedCharacter.attributes);
  }

  return {
    success: true,
    character: updatedCharacter,
    diff,
    computed,
    warnings: validationResult.warnings,
  };
}

/**
 * Unset (remove) attributes from a character.
 *
 * @param character - Existing character
 * @param keysString - Space-separated list of keys to remove
 * @param characterRepo - Character repository for persistence
 * @returns Unset result
 */
export async function unsetKeys(
  character: Character,
  keysString: string,
  characterRepo: CharacterRepo
): Promise<UnsetResult> {
  const keys = keysString
    .split(/\s+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  if (keys.length === 0) {
    return { success: false, error: 'No keys provided to unset.' };
  }

  // Determine which keys exist
  const existing = character.attributes;
  const toRemove: string[] = [];
  const notFound: string[] = [];

  for (const key of keys) {
    if (key in existing) {
      toRemove.push(key);
    } else {
      notFound.push(key);
    }
  }

  if (toRemove.length === 0) {
    return {
      success: true,
      character,
      removed: [],
      notFound,
    };
  }

  // Apply to database
  const updatedCharacter = await characterRepo.unsetAttributes({
    characterId: character.id,
    keys: toRemove,
  });

  return {
    success: true,
    character: updatedCharacter,
    removed: toRemove,
    notFound,
  };
}

/**
 * Get attribute values for specific keys or prefix.
 */
export function getAttributeValues(
  attributes: Record<string, AttributeValue>,
  options: { keys?: string[]; prefix?: string; includeComputed?: boolean }
): Record<string, { value: string; isComputed: boolean }> {
  const result: Record<string, { value: string; isComputed: boolean }> = {};

  if (options.keys) {
    for (const key of options.keys) {
      const attr = attributes[key];
      if (attr) {
        const val = fromAttrValue(attr);
        result[key] = {
          value: typeof val === 'string' ? `"${val}"` : String(val),
          isComputed: false,
        };
      } else {
        result[key] = { value: '(unset)', isComputed: false };
      }
    }
  }

  if (options.prefix) {
    for (const [key, attr] of Object.entries(attributes)) {
      if (key.startsWith(options.prefix)) {
        const val = fromAttrValue(attr);
        result[key] = {
          value: typeof val === 'string' ? `"${val}"` : String(val),
          isComputed: false,
        };
      }
    }
  }

  // Add computed values if requested
  if (options.includeComputed) {
    const computed = deriveComputed(attributes);

    if (computed.proficiencyBonus !== undefined) {
      const matchesKeys = options.keys?.some(
        (k) => k === 'computed.proficiency' || k.startsWith('computed')
      );
      const matchesPrefix =
        options.prefix && 'computed.proficiency'.startsWith(options.prefix);
      if (matchesKeys || matchesPrefix || (!options.keys && !options.prefix)) {
        result['computed.proficiency'] = {
          value: `+${computed.proficiencyBonus}`,
          isComputed: true,
        };
      }
    }

    const modKeys = ['strMod', 'dexMod', 'conMod', 'intMod', 'wisMod', 'chaMod'] as const;
    for (const modKey of modKeys) {
      const mod = computed[modKey];
      if (mod !== undefined) {
        const computedKey = `computed.${modKey.replace('Mod', '')}Mod`;
        const matchesKeys = options.keys?.some(
          (k) => k === computedKey || k.startsWith('computed')
        );
        const matchesPrefix = options.prefix && computedKey.startsWith(options.prefix);
        if (matchesKeys || matchesPrefix || (!options.keys && !options.prefix)) {
          result[computedKey] = {
            value: mod >= 0 ? `+${mod}` : `${mod}`,
            isComputed: true,
          };
        }
      }
    }
  }

  return result;
}
