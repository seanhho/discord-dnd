/**
 * Domain models for persistence layer.
 * These types are SQLite-agnostic and represent the public API.
 */

/**
 * Tagged attribute value types for preserving type information in JSON storage.
 * - "n" = number
 * - "b" = boolean
 * - "s" = string
 */
export type AttributeValue =
  | { t: 'n'; v: number }
  | { t: 'b'; v: boolean }
  | { t: 's'; v: string };

/**
 * Helper functions for creating typed attribute values
 */
export const AttrValue = {
  num: (v: number): AttributeValue => ({ t: 'n', v }),
  bool: (v: boolean): AttributeValue => ({ t: 'b', v }),
  str: (v: string): AttributeValue => ({ t: 's', v }),
} as const;

/**
 * User domain model.
 * Represents a Discord user in our system.
 */
export interface User {
  /** Internal UUID identifier */
  readonly id: string;
  /** Discord user ID (snowflake) */
  readonly discordUserId: string;
  /** ISO 8601 timestamp of creation */
  readonly createdAt: string;
  /** ISO 8601 timestamp of last update */
  readonly updatedAt: string;
}

/**
 * Character domain model.
 * A character belongs to a user and is scoped to a guild.
 */
export interface Character {
  /** Internal UUID identifier */
  readonly id: string;
  /** Owner user ID (FK to User.id) */
  readonly userId: string;
  /** Discord guild ID (snowflake) where this character exists */
  readonly guildId: string;
  /** Character name (unique per userId+guildId, case-insensitive) */
  readonly name: string;
  /** Key-value attributes with typed values */
  readonly attributes: Record<string, AttributeValue>;
  /** ISO 8601 timestamp of creation */
  readonly createdAt: string;
  /** ISO 8601 timestamp of last update */
  readonly updatedAt: string;
}
