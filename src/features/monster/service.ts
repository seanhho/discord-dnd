/**
 * Monster attribute service.
 *
 * Handles patch application and diff generation.
 */

import type {
  AttributeValue,
  Monster,
  DiffEntry,
  SetResult,
  UnsetResult,
  MonsterFeatureDeps,
} from './types.js';
import { AttrValue } from './types.js';
import { parsePatch, validatePatch } from './parser.js';

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
 * Generate diff entries for a patch.
 */
function generateDiff(
  existing: Record<string, AttributeValue>,
  patch: Record<string, AttributeValue>
): DiffEntry[] {
  const diff: DiffEntry[] = [];

  for (const [key, newAttr] of Object.entries(patch)) {
    const oldAttr = existing[key];

    diff.push({
      key,
      oldValue: oldAttr ? fromAttrValue(oldAttr) : undefined,
      newValue: fromAttrValue(newAttr),
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
 * Apply a patch to a monster's attributes.
 *
 * @param monster - Existing monster
 * @param patchString - Raw patch string from user input
 * @param monsterRepo - Monster repository for persistence
 * @returns Set result with updated monster, diff, and warnings
 */
export async function applyPatch(
  monster: Monster,
  patchString: string,
  monsterRepo: MonsterFeatureDeps['monsterRepo']
): Promise<SetResult> {
  // 1. Parse the patch string
  const parseResult = parsePatch(patchString);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error };
  }

  if (parseResult.entries.length === 0) {
    return { success: false, error: 'No attributes to update. Patch is empty.' };
  }

  // 2. Validate and coerce values (NO key allowlist enforcement for monsters)
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

  // 4. Generate diff
  const diff = generateDiff(monster.attributes, patch);

  // 5. Apply to database
  const updatedMonster = await monsterRepo.updateMonsterAttributes({
    monsterId: monster.id,
    patch,
  });

  return {
    success: true,
    monster: updatedMonster,
    diff,
    warnings: validationResult.warnings,
  };
}

/**
 * Unset (remove) attributes from a monster.
 *
 * @param monster - Existing monster
 * @param keysString - Space-separated list of keys to remove
 * @param monsterRepo - Monster repository for persistence
 * @returns Unset result
 */
export async function unsetKeys(
  monster: Monster,
  keysString: string,
  monsterRepo: MonsterFeatureDeps['monsterRepo']
): Promise<UnsetResult> {
  const keys = keysString
    .split(/\s+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  if (keys.length === 0) {
    return { success: false, error: 'No keys provided to unset.' };
  }

  // Determine which keys exist
  const existing = monster.attributes;
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
      monster,
      removed: [],
      notFound,
    };
  }

  // Apply to database
  const updatedMonster = await monsterRepo.unsetMonsterAttributes({
    monsterId: monster.id,
    keys: toRemove,
  });

  return {
    success: true,
    monster: updatedMonster,
    removed: toRemove,
    notFound,
  };
}

/**
 * Result of getting attribute values.
 */
export interface GetAttributeValuesResult {
  values: Record<string, { value: string }>;
}

/**
 * Get attribute values for specific keys or prefix.
 */
export function getAttributeValues(
  attributes: Record<string, AttributeValue>,
  options: { keys?: string[]; prefix?: string }
): GetAttributeValuesResult {
  const values: Record<string, { value: string }> = {};

  if (options.keys) {
    for (const key of options.keys) {
      const attr = attributes[key];
      if (attr) {
        const val = fromAttrValue(attr);
        values[key] = {
          value: typeof val === 'string' ? `"${val}"` : String(val),
        };
      } else {
        values[key] = { value: '(unset)' };
      }
    }
  }

  if (options.prefix) {
    for (const [key, attr] of Object.entries(attributes)) {
      if (key.startsWith(options.prefix)) {
        const val = fromAttrValue(attr);
        values[key] = {
          value: typeof val === 'string' ? `"${val}"` : String(val),
        };
      }
    }
  }

  return { values };
}
