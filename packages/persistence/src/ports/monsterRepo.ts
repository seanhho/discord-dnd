import type { AttributeValue, Monster } from './models.js';

/**
 * Parameters for creating a new monster
 */
export interface CreateMonsterParams {
  /** Discord guild ID where this monster exists */
  guildId: string;
  /** Monster name (must be unique per guildId, case-insensitive) */
  name: string;
}

/**
 * Parameters for looking up a monster by name
 */
export interface GetMonsterByNameParams {
  guildId: string;
  /** Monster name (case-insensitive match) */
  name: string;
}

/**
 * Parameters for listing monsters
 */
export interface ListMonstersParams {
  guildId: string;
}

/**
 * Parameters for updating monster attributes
 */
export interface UpdateMonsterAttributesParams {
  monsterId: string;
  /** Attributes to merge (overwrites existing keys) */
  patch: Record<string, AttributeValue>;
}

/**
 * Parameters for removing monster attributes
 */
export interface UnsetMonsterAttributesParams {
  monsterId: string;
  /** Attribute keys to remove */
  keys: string[];
}

/**
 * Parameters for setting active monster
 */
export interface SetActiveMonsterParams {
  guildId: string;
  monsterId: string;
}

/**
 * Parameters for getting active monster
 */
export interface GetActiveMonsterParams {
  guildId: string;
}

/**
 * Monster repository interface (port).
 * Defines operations for monster persistence without exposing implementation details.
 *
 * Monsters are:
 * - Scoped per guild (not per user)
 * - Manageable by any user with DM capability
 * - Viewable by anyone (access control is in feature layer)
 */
export interface MonsterRepo {
  /**
   * Create a new monster.
   *
   * @param params - Monster creation parameters
   * @returns The newly created monster
   * @throws Error if a monster with the same name already exists for this guild
   */
  createMonster(params: CreateMonsterParams): Promise<Monster>;

  /**
   * Get a monster by name (case-insensitive).
   *
   * @param params - Lookup parameters
   * @returns The monster if found, null otherwise
   */
  getMonsterByName(params: GetMonsterByNameParams): Promise<Monster | null>;

  /**
   * Get a monster by ID.
   *
   * @param monsterId - Monster UUID
   * @returns The monster if found, null otherwise
   */
  getMonsterById(monsterId: string): Promise<Monster | null>;

  /**
   * List all monsters for a guild.
   *
   * @param params - Filter parameters
   * @returns Array of monsters (may be empty)
   */
  listMonsters(params: ListMonstersParams): Promise<Monster[]>;

  /**
   * Update monster attributes by merging with existing.
   * Overwrites keys present in patch, preserves others.
   *
   * @param params - Update parameters with attribute patch
   * @returns The updated monster
   * @throws Error if monster not found
   */
  updateMonsterAttributes(params: UpdateMonsterAttributesParams): Promise<Monster>;

  /**
   * Remove specific attribute keys from a monster.
   *
   * @param params - Parameters with keys to remove
   * @returns The updated monster
   * @throws Error if monster not found
   */
  unsetMonsterAttributes(params: UnsetMonsterAttributesParams): Promise<Monster>;

  /**
   * Set the active monster for a guild.
   * Only one monster can be active per guild.
   *
   * @param params - Active monster parameters
   * @throws Error if monster not found or doesn't belong to guild
   */
  setActiveMonster(params: SetActiveMonsterParams): Promise<void>;

  /**
   * Get the currently active monster for a guild.
   *
   * @param params - Lookup parameters
   * @returns The active monster if set, null otherwise
   */
  getActiveMonster(params: GetActiveMonsterParams): Promise<Monster | null>;
}
