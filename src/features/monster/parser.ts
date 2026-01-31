/**
 * Parser for {key:value, key:value, ...} patch format for monsters.
 *
 * RELAXED KEY VALIDATION:
 * - Unlike /char, monster keys are NOT restricted to a predefined allowlist
 * - Unknown keys are allowed
 * - Still protects against prototype pollution keys
 *
 * Rules:
 * - Must start with "{" and end with "}"
 * - Comma-separated key:value pairs
 * - Key regex: [a-zA-Z0-9_.-]+
 * - Values: number, boolean (true/false), quoted string, or unquoted token
 * - Whitespace is ignored
 * - Duplicate keys: last one wins
 */

import type { ParsedEntry, ParseResult, KeyValidation, ValidationResult } from './types.js';

/** Keys that could be used for prototype pollution attacks */
const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];

/** Valid key pattern */
const KEY_PATTERN = /^[a-zA-Z0-9_.-]+$/;

/**
 * Parse a patch string into key-value entries.
 *
 * @param input - The raw input string (e.g., "{ac:15, name:\"Goblin\"}")
 * @returns Parse result with entries or error
 */
export function parsePatch(input: string): ParseResult {
  const trimmed = input.trim();

  // Must start with { and end with }
  if (!trimmed.startsWith('{')) {
    return { success: false, error: 'Patch must start with "{"' };
  }
  if (!trimmed.endsWith('}')) {
    return { success: false, error: 'Patch must end with "}"' };
  }

  // Extract content between braces
  const content = trimmed.slice(1, -1).trim();

  // Empty patch is valid
  if (content === '') {
    return { success: true, entries: [] };
  }

  const entries = new Map<string, string>();
  let pos = 0;

  while (pos < content.length) {
    // Skip whitespace
    pos = skipWhitespace(content, pos);
    if (pos >= content.length) break;

    // Parse key
    const keyResult = parseKey(content, pos);
    if (!keyResult.success) {
      return { success: false, error: keyResult.error };
    }
    const key = keyResult.value;
    pos = keyResult.endPos;

    // Validate key format
    if (!KEY_PATTERN.test(key)) {
      return {
        success: false,
        error: `Invalid key format: "${key}". Keys must contain only letters, numbers, underscores, dots, or hyphens.`,
      };
    }

    // Security check - prototype pollution protection
    if (FORBIDDEN_KEYS.includes(key.toLowerCase())) {
      return {
        success: false,
        error: `Forbidden key: "${key}". This key is not allowed for security reasons.`,
      };
    }

    // Skip whitespace
    pos = skipWhitespace(content, pos);

    // Expect colon
    if (content[pos] !== ':') {
      return {
        success: false,
        error: `Expected ":" after key "${key}" at position ${pos}`,
      };
    }
    pos++; // Skip colon

    // Skip whitespace
    pos = skipWhitespace(content, pos);

    // Parse value
    const valueResult = parseValue(content, pos);
    if (!valueResult.success) {
      return { success: false, error: valueResult.error };
    }
    pos = valueResult.endPos;

    // Store entry (last one wins for duplicates)
    entries.set(key, valueResult.value);

    // Skip whitespace
    pos = skipWhitespace(content, pos);

    // Check for comma or end
    if (pos < content.length) {
      if (content[pos] === ',') {
        pos++; // Skip comma
      } else {
        return {
          success: false,
          error: `Expected "," or "}" at position ${pos}, found "${content[pos]}"`,
        };
      }
    }
  }

  // Convert map to entries array
  const result: ParsedEntry[] = Array.from(entries.entries()).map(
    ([key, rawValue]) => ({ key, rawValue })
  );

  return { success: true, entries: result };
}

function skipWhitespace(str: string, pos: number): number {
  while (pos < str.length && /\s/.test(str[pos]!)) {
    pos++;
  }
  return pos;
}

type KeyParseResult =
  | { success: true; value: string; endPos: number }
  | { success: false; error: string };

function parseKey(str: string, startPos: number): KeyParseResult {
  let pos = startPos;
  let key = '';

  while (pos < str.length) {
    const char = str[pos]!;
    if (char === ':' || char === ',' || char === '}' || /\s/.test(char)) {
      break;
    }
    key += char;
    pos++;
  }

  if (key === '') {
    return { success: false, error: `Expected key at position ${startPos}` };
  }

  return { success: true, value: key, endPos: pos };
}

type ValueParseResult =
  | { success: true; value: string; endPos: number }
  | { success: false; error: string };

function parseValue(str: string, startPos: number): ValueParseResult {
  if (startPos >= str.length) {
    return { success: false, error: `Expected value at position ${startPos}` };
  }

  const char = str[startPos]!;

  // Quoted string
  if (char === '"') {
    return parseQuotedString(str, startPos);
  }

  // Unquoted value (number, boolean, or unquoted string token)
  return parseUnquotedValue(str, startPos);
}

function parseQuotedString(str: string, startPos: number): ValueParseResult {
  let pos = startPos + 1; // Skip opening quote
  let value = '';

  while (pos < str.length) {
    const char = str[pos]!;

    if (char === '"') {
      // End of string
      return { success: true, value, endPos: pos + 1 };
    }

    if (char === '\\' && pos + 1 < str.length) {
      // Escape sequence
      const nextChar = str[pos + 1]!;
      if (nextChar === '"' || nextChar === '\\') {
        value += nextChar;
        pos += 2;
        continue;
      }
    }

    value += char;
    pos++;
  }

  return { success: false, error: 'Unterminated quoted string' };
}

function parseUnquotedValue(str: string, startPos: number): ValueParseResult {
  let pos = startPos;
  let value = '';

  while (pos < str.length) {
    const char = str[pos]!;
    // Stop at delimiters
    if (char === ',' || char === '}' || /\s/.test(char)) {
      break;
    }
    value += char;
    pos++;
  }

  if (value === '') {
    return { success: false, error: `Expected value at position ${startPos}` };
  }

  return { success: true, value, endPos: pos };
}

/**
 * Validate and coerce a single key-value pair.
 * Monster keys are NOT restricted - any key is allowed (except forbidden ones).
 * Values are coerced to number, boolean, or string.
 */
export function validateEntry(entry: ParsedEntry): KeyValidation {
  const { key, rawValue } = entry;

  // Try to parse as number
  const num = Number(rawValue);
  if (!Number.isNaN(num) && rawValue !== '') {
    return {
      key,
      valid: true,
      coercedType: 'number',
      value: num,
    };
  }

  // Try to parse as boolean
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

  // Default to string
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
