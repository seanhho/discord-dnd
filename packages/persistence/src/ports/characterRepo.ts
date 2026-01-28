import type { AttributeValue, Character } from './models.js';

/**
 * Parameters for creating a new character
 */
export interface CreateCharacterParams {
  /** Owner user ID (internal UUID) */
  userId: string;
  /** Discord guild ID where this character exists */
  guildId: string;
  /** Character name (must be unique per userId+guildId, case-insensitive) */
  name: string;
}

/**
 * Parameters for looking up a character by name
 */
export interface GetByNameParams {
  userId: string;
  guildId: string;
  /** Character name (case-insensitive match) */
  name: string;
}

/**
 * Parameters for listing characters
 */
export interface ListByUserParams {
  userId: string;
  guildId: string;
}

/**
 * Parameters for updating character attributes
 */
export interface UpdateAttributesParams {
  characterId: string;
  /** Attributes to merge (overwrites existing keys) */
  patch: Record<string, AttributeValue>;
}

/**
 * Parameters for removing character attributes
 */
export interface UnsetAttributesParams {
  characterId: string;
  /** Attribute keys to remove */
  keys: string[];
}

/**
 * Parameters for setting active character
 */
export interface SetActiveCharacterParams {
  userId: string;
  guildId: string;
  characterId: string;
}

/**
 * Parameters for getting active character
 */
export interface GetActiveCharacterParams {
  userId: string;
  guildId: string;
}

/**
 * Character repository interface (port).
 * Defines operations for character persistence without exposing implementation details.
 */
export interface CharacterRepo {
  /**
   * Create a new character.
   *
   * @param params - Character creation parameters
   * @returns The newly created character
   * @throws Error if a character with the same name already exists for this user+guild
   */
  createCharacter(params: CreateCharacterParams): Promise<Character>;

  /**
   * Get a character by ID.
   *
   * @param characterId - Character UUID
   * @returns The character if found, null otherwise
   */
  getById(characterId: string): Promise<Character | null>;

  /**
   * Get a character by name (case-insensitive).
   *
   * @param params - Lookup parameters
   * @returns The character if found, null otherwise
   */
  getByName(params: GetByNameParams): Promise<Character | null>;

  /**
   * List all characters for a user in a guild.
   *
   * @param params - Filter parameters
   * @returns Array of characters (may be empty)
   */
  listByUser(params: ListByUserParams): Promise<Character[]>;

  /**
   * Update character attributes by merging with existing.
   * Overwrites keys present in patch, preserves others.
   *
   * @param params - Update parameters with attribute patch
   * @returns The updated character
   * @throws Error if character not found
   */
  updateAttributes(params: UpdateAttributesParams): Promise<Character>;

  /**
   * Remove specific attribute keys from a character.
   *
   * @param params - Parameters with keys to remove
   * @returns The updated character
   * @throws Error if character not found
   */
  unsetAttributes(params: UnsetAttributesParams): Promise<Character>;

  /**
   * Set the active character for a user in a guild.
   * Only one character can be active per (userId, guildId).
   *
   * @param params - Active character parameters
   * @throws Error if character not found or doesn't belong to user+guild
   */
  setActiveCharacter(params: SetActiveCharacterParams): Promise<void>;

  /**
   * Get the currently active character for a user in a guild.
   *
   * @param params - Lookup parameters
   * @returns The active character if set, null otherwise
   */
  getActiveCharacter(params: GetActiveCharacterParams): Promise<Character | null>;
}
