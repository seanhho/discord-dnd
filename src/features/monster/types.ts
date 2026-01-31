/**
 * Shared types for the monster feature.
 */

import type { Monster as MonsterType, AttributeValue } from '@discord-bot/persistence';

// Re-export persistence types for convenience
export type { Monster, AttributeValue } from '@discord-bot/persistence';
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
 * Diff entry showing old vs new value
 */
export interface DiffEntry {
  key: string;
  oldValue?: number | boolean | string;
  newValue: number | boolean | string;
}

/**
 * Service result for set operation
 */
export type SetResult =
  | {
      success: true;
      monster: MonsterType;
      diff: DiffEntry[];
      warnings: string[];
    }
  | { success: false; error: string };

/**
 * Service result for unset operation
 */
export type UnsetResult =
  | {
      success: true;
      monster: MonsterType;
      removed: string[];
      notFound: string[];
    }
  | { success: false; error: string };

/**
 * View options for /monster show
 */
export type ShowView = 'summary' | 'all' | 'help';

/**
 * Monster feature dependencies
 */
export interface MonsterFeatureDeps {
  userRepo: {
    isDmByDiscordUserId(discordUserId: string): Promise<boolean>;
  };
  monsterRepo: {
    createMonster(params: { guildId: string; name: string }): Promise<MonsterType>;
    getMonsterByName(params: { guildId: string; name: string }): Promise<MonsterType | null>;
    listMonsters(params: { guildId: string }): Promise<MonsterType[]>;
    updateMonsterAttributes(params: { monsterId: string; patch: Record<string, AttributeValue> }): Promise<MonsterType>;
    unsetMonsterAttributes(params: { monsterId: string; keys: string[] }): Promise<MonsterType>;
    setActiveMonster(params: { guildId: string; monsterId: string }): Promise<void>;
    getActiveMonster(params: { guildId: string }): Promise<MonsterType | null>;
  };
}
