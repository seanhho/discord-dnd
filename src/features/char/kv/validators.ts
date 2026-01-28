/**
 * Validators for character attributes.
 *
 * Uses kv.config.ts as the source of truth for type coercion and constraints.
 * Unknown keys are allowed but stored as strings with a warning.
 */

import type { ParsedEntry, KeyValidation, ValidationResult } from '../types.js';
import { getKeyConfig, type KvKeyConfig } from './kv.config.js';

/**
 * Validate and coerce a single key-value pair.
 *
 * @param entry - Parsed key-value entry
 * @returns Validation result with coerced value
 */
export function validateEntry(entry: ParsedEntry): KeyValidation {
  const { key, rawValue } = entry;
  const config = getKeyConfig(key);

  if (!config) {
    // Unknown key - store as string with warning
    return {
      key,
      valid: true,
      coercedType: 'string',
      value: rawValue,
      warning: `Unknown key "${key}" - storing as string. Use /char show view:help to see valid keys.`,
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
  const config = getKeyConfig(key);
  return config?.affectsComputed ?? false;
}
