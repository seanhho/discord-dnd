import type { Encounter, EncounterStatus, EncounterParticipant, EncounterEvent } from './models.js';

// ─────────────────────────────────────────────────────────────────────────────
// Encounter Repository
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parameters for creating a new encounter.
 */
export interface CreateEncounterParams {
  /** Encounter name/description */
  name: string;
  /** Discord guild ID (null for DMs) */
  guildId?: string | null;
  /** Discord channel ID */
  channelId: string;
  /** Discord thread ID (null if not in a thread) */
  threadId?: string | null;
  /** Discord user ID who created the encounter */
  createdByDiscordUserId: string;
}

/**
 * Parameters for querying encounters by context.
 */
export interface EncounterContextParams {
  /** Discord guild ID (null for DMs) */
  guildId?: string | null;
  /** Discord channel ID */
  channelId: string;
  /** Discord thread ID (null if not in a thread) */
  threadId?: string | null;
}

/**
 * Parameters for updating an encounter.
 */
export interface UpdateEncounterParams {
  /** New status */
  status?: EncounterStatus;
  /** New name */
  name?: string;
  /** New round number */
  round?: number;
  /** New turn index */
  turnIndex?: number;
  /** Whether initiative is locked */
  initiativeLocked?: boolean;
}

/**
 * Encounter repository interface (port).
 * Handles persistence of encounter metadata and turn loop state.
 *
 * IMPORTANT: This repository does NOT read or write character KV state.
 * Character state (HP, conditions, etc.) is managed separately.
 */
export interface EncounterRepo {
  /**
   * Create a new encounter in a context.
   *
   * @param params - Encounter creation parameters
   * @returns The newly created encounter
   * @throws Error if there's already an active (non-ended) encounter in this context
   */
  createEncounter(params: CreateEncounterParams): Promise<Encounter>;

  /**
   * Get an encounter by ID.
   *
   * @param encounterId - Encounter UUID
   * @returns The encounter if found, null otherwise
   */
  getEncounter(encounterId: string): Promise<Encounter | null>;

  /**
   * Get the active (non-ended) encounter in a context.
   *
   * @param params - Context parameters
   * @returns The active encounter if found, null otherwise
   */
  getActiveEncounterByContext(params: EncounterContextParams): Promise<Encounter | null>;

  /**
   * Update an encounter's metadata or turn loop state.
   *
   * @param encounterId - Encounter UUID
   * @param patch - Fields to update
   * @returns The updated encounter
   * @throws Error if encounter not found
   */
  updateEncounter(encounterId: string, patch: UpdateEncounterParams): Promise<Encounter>;

  /**
   * End an encounter (sets status to 'ended').
   *
   * @param encounterId - Encounter UUID
   * @throws Error if encounter not found
   */
  endEncounter(encounterId: string): Promise<void>;

  /**
   * List all encounters in a context (including ended ones).
   *
   * @param params - Context parameters
   * @returns Array of encounters (may be empty)
   */
  listEncountersByContext(params: EncounterContextParams): Promise<Encounter[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Encounter Participant Repository
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parameters for adding a PC participant.
 */
export interface AddPcParticipantParams {
  /** Encounter UUID */
  encounterId: string;
  /** Character UUID (must exist in characters table) */
  characterId: string;
  /** Display name override (uses character name if not provided) */
  displayName?: string;
  /** Discord user ID (convenience field) */
  discordUserId?: string;
}

/**
 * Parameters for adding an NPC participant.
 */
export interface AddNpcParticipantParams {
  /** Encounter UUID */
  encounterId: string;
  /** Display name for the NPC */
  displayName: string;
  /** Optional NPC reference ID/slug */
  npcRef?: string;
  /** Optional notes */
  notes?: string;
}

/**
 * Entry for bulk initiative setting.
 */
export interface InitiativeEntry {
  /** Participant UUID */
  participantId: string;
  /** Initiative value */
  initiative: number;
}

/**
 * Encounter participant repository interface (port).
 * Handles persistence of encounter participants.
 *
 * IMPORTANT: This repository does NOT read or write character KV state.
 * Character state (HP, conditions, etc.) is managed separately.
 */
export interface EncounterParticipantRepo {
  /**
   * Add a PC participant to an encounter.
   *
   * @param params - PC participant parameters
   * @returns The newly created participant
   * @throws Error if character already in encounter or encounter not found
   */
  addPcParticipant(params: AddPcParticipantParams): Promise<EncounterParticipant>;

  /**
   * Add an NPC participant to an encounter.
   *
   * @param params - NPC participant parameters
   * @returns The newly created participant
   * @throws Error if encounter not found
   */
  addNpcParticipant(params: AddNpcParticipantParams): Promise<EncounterParticipant>;

  /**
   * Remove a participant from an encounter.
   *
   * @param encounterId - Encounter UUID
   * @param participantId - Participant UUID
   * @throws Error if participant not found
   */
  removeParticipant(encounterId: string, participantId: string): Promise<void>;

  /**
   * List all participants in an encounter.
   * Returns participants sorted by initiative (desc) then by sort_order.
   *
   * @param encounterId - Encounter UUID
   * @returns Array of participants (may be empty)
   */
  listParticipants(encounterId: string): Promise<EncounterParticipant[]>;

  /**
   * Get a single participant by ID.
   *
   * @param encounterId - Encounter UUID
   * @param participantId - Participant UUID
   * @returns The participant if found, null otherwise
   */
  getParticipant(encounterId: string, participantId: string): Promise<EncounterParticipant | null>;

  /**
   * Set initiative for a single participant.
   *
   * @param encounterId - Encounter UUID
   * @param participantId - Participant UUID
   * @param initiative - Initiative value
   * @throws Error if participant not found
   */
  setInitiative(encounterId: string, participantId: string, initiative: number): Promise<void>;

  /**
   * Set initiative for multiple participants atomically.
   *
   * @param encounterId - Encounter UUID
   * @param entries - Array of participant/initiative pairs
   * @throws Error if any participant not found
   */
  bulkSetInitiative(encounterId: string, entries: InitiativeEntry[]): Promise<void>;

  /**
   * Reorder participants by setting sort_order.
   * Used for tie-breaking when initiatives are equal.
   *
   * @param encounterId - Encounter UUID
   * @param orderedParticipantIds - Participant IDs in desired order
   * @throws Error if any participant not found
   */
  reorderParticipants(encounterId: string, orderedParticipantIds: string[]): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Encounter Event Repository (Optional, for audit/debug)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parameters for appending an event.
 */
export interface AppendEventParams {
  /** Encounter UUID */
  encounterId: string;
  /** Discord user ID who performed the action */
  actorDiscordUserId?: string | null;
  /** Event type identifier */
  eventType: string;
  /** Event-specific payload */
  payload?: unknown;
}

/**
 * Encounter event repository interface (port).
 * Handles persistence of encounter audit/debug events.
 *
 * IMPORTANT: Events should NOT contain character state snapshots.
 */
export interface EncounterEventRepo {
  /**
   * Append an event to an encounter's log.
   *
   * @param params - Event parameters
   * @throws Error if encounter not found
   */
  appendEvent(params: AppendEventParams): Promise<void>;

  /**
   * List events for an encounter.
   *
   * @param encounterId - Encounter UUID
   * @param limit - Maximum number of events to return (default: 100)
   * @returns Array of events, newest first
   */
  listEvents(encounterId: string, limit?: number): Promise<EncounterEvent[]>;
}
