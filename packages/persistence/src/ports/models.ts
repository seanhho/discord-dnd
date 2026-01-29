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
  /** Whether this user has DM (Dungeon Master) capability */
  readonly isDm: boolean;
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

// ─────────────────────────────────────────────────────────────────────────────
// Encounter Models
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Encounter lifecycle status.
 */
export type EncounterStatus = 'setup' | 'initiative' | 'running' | 'paused' | 'ended';

/**
 * Encounter domain model.
 *
 * An encounter represents a combat session in a Discord context.
 * It does NOT store character state (HP, conditions, etc.) - that lives in
 * the character KV store.
 *
 * Key constraints:
 * - Only ONE non-ended encounter per (guildId, channelId, threadId) context
 * - Any user with DM capability can manage any encounter
 * - created_by is for audit only, not permission control
 */
export interface Encounter {
  /** Internal UUID identifier */
  readonly id: string;
  /** Encounter name/description */
  readonly name: string;
  /** Lifecycle status */
  readonly status: EncounterStatus;
  /** Discord guild ID (null for DMs) */
  readonly guildId: string | null;
  /** Discord channel ID */
  readonly channelId: string;
  /** Discord thread ID (null if not in a thread) */
  readonly threadId: string | null;
  /** Discord user ID who created the encounter (audit only) */
  readonly createdByDiscordUserId: string;
  /** Current combat round (1-indexed) */
  readonly round: number;
  /** Index into the sorted participant list for current turn */
  readonly turnIndex: number;
  /** Whether initiative order is locked (can't add/remove participants) */
  readonly initiativeLocked: boolean;
  /** ISO 8601 timestamp of creation */
  readonly createdAt: string;
  /** ISO 8601 timestamp of last update */
  readonly updatedAt: string;
}

/**
 * Participant kind discriminator.
 */
export type ParticipantKind = 'pc' | 'npc';

/**
 * Encounter participant domain model.
 *
 * Represents a combatant in an encounter. For PCs, this references a character.
 * For NPCs, this stores minimal identity only (no stat blocks).
 *
 * Character state (HP, conditions, etc.) is NOT stored here - it lives in
 * the character KV store.
 */
export interface EncounterParticipant {
  /** Internal UUID identifier */
  readonly id: string;
  /** Encounter this participant belongs to */
  readonly encounterId: string;
  /** Whether this is a PC or NPC */
  readonly kind: ParticipantKind;
  /** Display name in initiative order */
  readonly displayName: string;
  /** Initiative roll value (null until set) */
  readonly initiative: number | null;
  /** Precomputed sort order for efficient queries */
  readonly sortOrder: number | null;
  /** Character ID (required for PCs, null for NPCs) */
  readonly characterId: string | null;
  /** Discord user ID (convenience for PCs) */
  readonly discordUserId: string | null;
  /** NPC reference ID/slug (for NPCs only) */
  readonly npcRef: string | null;
  /** Notes (for NPCs only) */
  readonly notes: string | null;
  /** ISO 8601 timestamp of creation */
  readonly createdAt: string;
  /** ISO 8601 timestamp of last update */
  readonly updatedAt: string;
}

/**
 * Encounter event for audit/debug logging.
 * Does NOT store character state - only records actions taken.
 */
export interface EncounterEvent {
  /** Internal UUID identifier */
  readonly id: string;
  /** Encounter this event belongs to */
  readonly encounterId: string;
  /** ISO 8601 timestamp of when the event occurred */
  readonly createdAt: string;
  /** Discord user ID who performed the action (if applicable) */
  readonly actorDiscordUserId: string | null;
  /** Event type identifier */
  readonly eventType: string;
  /** JSON payload with event-specific data */
  readonly payload: unknown;
}
