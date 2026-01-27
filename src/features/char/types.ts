/**
 * Shared types for the character feature.
 * Re-exports persistence types and defines feature-specific types.
 */

import type { Character as CharacterType } from '@discord-bot/persistence';

// Re-export persistence types for convenience
export type {
  User,
  Character,
  AttributeValue,
} from '@discord-bot/persistence';
export { AttrValue } from '@discord-bot/persistence';

/**
 * Parsed key-value entry from user input
 */
export interface ParsedEntry {
  key: string;
  rawValue: string;
}

/**
 * Result of parsing a patch string
 */
export type ParseResult =
  | { success: true; entries: ParsedEntry[] }
  | { success: false; error: string };

/**
 * Validation result for a single key
 */
export interface KeyValidation {
  key: string;
  valid: boolean;
  coercedType: 'number' | 'boolean' | 'string';
  value: number | boolean | string;
  warning?: string;
  error?: string;
}

/**
 * Result of validating a patch
 */
export interface ValidationResult {
  success: boolean;
  validations: KeyValidation[];
  errors: string[];
  warnings: string[];
}

/**
 * Computed/derived values for a character
 */
export interface ComputedValues {
  proficiencyBonus?: number;
  strMod?: number;
  dexMod?: number;
  conMod?: number;
  intMod?: number;
  wisMod?: number;
  chaMod?: number;
}

/**
 * Diff entry showing old vs new value
 */
export interface DiffEntry {
  key: string;
  oldValue?: number | boolean | string;
  newValue: number | boolean | string;
  affectsComputed: boolean;
}

/**
 * Service result for set operation
 */
export type SetResult =
  | {
      success: true;
      character: CharacterType;
      diff: DiffEntry[];
      computed: ComputedValues;
      warnings: string[];
    }
  | { success: false; error: string };

/**
 * Service result for unset operation
 */
export type UnsetResult =
  | {
      success: true;
      character: CharacterType;
      removed: string[];
      notFound: string[];
    }
  | { success: false; error: string };

/**
 * View options for /char show
 */
export type ShowView =
  | 'summary'
  | 'stats'
  | 'hp'
  | 'equipment'
  | 'attacks'
  | 'all'
  | 'help'
  | 'template'
  | 'characters'
  | 'active';
