/**
 * Validators for character attributes.
 *
 * STRICT KEY ENFORCEMENT:
 * - Only keys defined in @discord-bot/dnd5e-types are allowed
 * - Unknown keys are REJECTED (not stored)
 * - Validation happens BEFORE any persistence updates
 */

import {
  isCharKvKey,
  getInvalidKeys,
} from '@discord-bot/dnd5e-types';
import type { ParsedEntry, KeyValidation, ValidationResult } from '../types.js';
import { getKeyConfigOrDefault, type KvKeyConfig } from './kv.config.js';

/**
 * Error result when invalid keys are detected.
 */
export interface InvalidKeysError {
  success: false;
  error: string;
  invalidKeys: string[];
}

/**
 * Validate that all keys in a patch are allowed.
 *
 * This is the FIRST validation step - it must pass before any other validation.
 *
 * @param entries - Parsed entries to validate
 * @returns Error if any keys are invalid, undefined if all keys are valid
 */
export function validateAllKeysAllowed(entries: ParsedEntry[]): InvalidKeysError | undefined {
  const keys = entries.map((e) => e.key);
  const invalidKeys = getInvalidKeys(keys);

  if (invalidKeys.length > 0) {
    const keyList = invalidKeys.map((k) => `"${k}"`).join(', ');
    const error = [
      `Unknown keys: ${keyList}`,
      '',
      'Only predefined character attribute keys are allowed.',
      'Use `/char show view:help` to see valid keys.',
      '',
      'For inventory items, use the format: inv.<item_id>.<property>',
      'Example: inv.longsword.name, inv.longsword.damage',
    ].join('\n');

    return {
      success: false,
      error,
      invalidKeys,
    };
  }

  return undefined;
}

/**
 * Validate and coerce a single key-value pair.
 *
 * @param entry - Parsed key-value entry
 * @returns Validation result with coerced value
 */
export function validateEntry(entry: ParsedEntry): KeyValidation {
  const { key, rawValue } = entry;

  // Key must be allowed (this should have been checked already, but double-check)
  if (!isCharKvKey(key)) {
    return {
      key,
      valid: false,
      coercedType: 'string',
      value: rawValue,
      error: `Unknown key "${key}". Use /char show view:help to see valid keys.`,
    };
  }

  const config = getKeyConfigOrDefault(key);
  if (!config) {
    // This shouldn't happen if isCharKvKey passed, but handle gracefully
    return {
      key,
      valid: true,
      coercedType: 'string',
      value: rawValue,
    };
  }

  return validateKnownKey(key, rawValue, config);
}

function validateKnownKey(
  key: string,
  rawValue: string,
  config: KvKeyConfig
): KeyValidation {
  switch (config.type) {
    case 'number':
      return validateNumber(key, rawValue, config);
    case 'boolean':
      return validateBoolean(key, rawValue, config);
    case 'string':
      return validateString(key, rawValue, config);
  }
}

function validateNumber(
  key: string,
  rawValue: string,
  config: KvKeyConfig
): KeyValidation {
  const num = Number(rawValue);

  if (Number.isNaN(num)) {
    return {
      key,
      valid: false,
      coercedType: 'number',
      value: 0,
      error: `"${key}" must be a number, got "${rawValue}"`,
    };
  }

  if (!Number.isInteger(num)) {
    return {
      key,
      valid: false,
      coercedType: 'number',
      value: 0,
      error: `"${key}" must be an integer, got "${rawValue}"`,
    };
  }

  if (config.min !== undefined && num < config.min) {
    return {
      key,
      valid: false,
      coercedType: 'number',
      value: num,
      error: `"${key}" must be at least ${config.min}, got ${num}`,
    };
  }

  if (config.max !== undefined && num > config.max) {
    return {
      key,
      valid: false,
      coercedType: 'number',
      value: num,
      error: `"${key}" must be at most ${config.max}, got ${num}`,
    };
  }

  return {
    key,
    valid: true,
    coercedType: 'number',
    value: num,
  };
}

function validateBoolean(
  key: string,
  rawValue: string,
  _config: KvKeyConfig
): KeyValidation {
  const lower = rawValue.toLowerCase();

  if (lower === 'true') {
    return {
      key,
      valid: true,
      coercedType: 'boolean',
      value: true,
    };
  }

  if (lower === 'false') {
    return {
      key,
      valid: true,
      coercedType: 'boolean',
      value: false,
    };
  }

  return {
    key,
    valid: false,
    coercedType: 'boolean',
    value: false,
    error: `"${key}" must be true or false, got "${rawValue}"`,
  };
}

function validateString(
  key: string,
  rawValue: string,
  config: KvKeyConfig
): KeyValidation {
  // Check enum constraint if present
  if (config.enum && !config.enum.includes(rawValue)) {
    return {
      key,
      valid: false,
      coercedType: 'string',
      value: rawValue,
      error: `"${key}" must be one of: ${config.enum.join(', ')}. Got "${rawValue}"`,
    };
  }

  return {
    key,
    valid: true,
    coercedType: 'string',
    value: rawValue,
  };
}

/**
 * Validate all entries in a patch.
 *
 * IMPORTANT: This function assumes all keys have already been validated as allowed.
 * Call validateAllKeysAllowed() first.
 *
 * @param entries - Parsed entries to validate
 * @returns Validation result with all validations, errors, and warnings
 */
export function validatePatch(entries: ParsedEntry[]): ValidationResult {
  const validations: KeyValidation[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const entry of entries) {
    const validation = validateEntry(entry);
    validations.push(validation);

    if (!validation.valid && validation.error) {
      errors.push(validation.error);
    }
    if (validation.warning) {
      warnings.push(validation.warning);
    }
  }

  return {
    success: errors.length === 0,
    validations,
    errors,
    warnings,
  };
}

/**
 * Check if a key affects computed values.
 */
export function keyAffectsComputed(key: string): boolean {
  const config = getKeyConfigOrDefault(key);
  return config?.affectsComputed ?? false;
}
