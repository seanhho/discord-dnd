import type { Kysely } from 'kysely';
import { randomUUID } from 'node:crypto';
import type { AttributeValue, Character } from '../ports/models.js';
import type {
  CharacterRepo,
  CreateCharacterParams,
  GetByNameParams,
  ListByUserParams,
  UpdateAttributesParams,
  UnsetAttributesParams,
  SetActiveCharacterParams,
  GetActiveCharacterParams,
} from '../ports/characterRepo.js';
import type { Database, CharactersTable } from './schema.js';

/**
 * Map database row to domain Character model.
 */
function toCharacter(row: CharactersTable): Character {
  return {
    id: row.id,
    userId: row.user_id,
    guildId: row.guild_id,
    name: row.name,
    attributes: JSON.parse(row.attributes) as Record<string, AttributeValue>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get current ISO timestamp.
 */
function now(): string {
  return new Date().toISOString();
}

/**
 * SQLite implementation of CharacterRepo.
 */
export class SqliteCharacterRepo implements CharacterRepo {
  constructor(private readonly db: Kysely<Database>) {}

  async createCharacter(params: CreateCharacterParams): Promise<Character> {
    const { userId, guildId, name } = params;
    const timestamp = now();

    const newCharacter: CharactersTable = {
      id: randomUUID(),
      user_id: userId,
      guild_id: guildId,
      name: name,
      name_lower: name.toLowerCase(),
      attributes: '{}',
      created_at: timestamp,
      updated_at: timestamp,
    };

    try {
      await this.db.insertInto('characters').values(newCharacter).execute();
    } catch (error) {
      // Check for unique constraint violation
      if (
        error instanceof Error &&
        error.message.includes('UNIQUE constraint failed')
      ) {
        throw new Error(
          `Character "${name}" already exists for this user in this guild`
        );
      }
      throw error;
    }

    return toCharacter(newCharacter);
  }

  async getByName(params: GetByNameParams): Promise<Character | null> {
    const { userId, guildId, name } = params;

    const row = await this.db
      .selectFrom('characters')
      .selectAll()
      .where('user_id', '=', userId)
      .where('guild_id', '=', guildId)
      .where('name_lower', '=', name.toLowerCase())
      .executeTakeFirst();

    return row ? toCharacter(row) : null;
  }

  async listByUser(params: ListByUserParams): Promise<Character[]> {
    const { userId, guildId } = params;

    const rows = await this.db
      .selectFrom('characters')
      .selectAll()
      .where('user_id', '=', userId)
      .where('guild_id', '=', guildId)
      .orderBy('name', 'asc')
      .execute();

    return rows.map(toCharacter);
  }

  async updateAttributes(params: UpdateAttributesParams): Promise<Character> {
    const { characterId, patch } = params;

    // Use a transaction for atomic read-modify-write
    return await this.db.transaction().execute(async (trx) => {
      // Fetch current character
      const current = await trx
        .selectFrom('characters')
        .selectAll()
        .where('id', '=', characterId)
        .executeTakeFirst();

      if (!current) {
        throw new Error(`Character not found: ${characterId}`);
      }

      // Merge attributes
      const existingAttrs = JSON.parse(current.attributes) as Record<
        string,
        AttributeValue
      >;
      const mergedAttrs = { ...existingAttrs, ...patch };
      const timestamp = now();

      // Update
      await trx
        .updateTable('characters')
        .set({
          attributes: JSON.stringify(mergedAttrs),
          updated_at: timestamp,
        })
        .where('id', '=', characterId)
        .execute();

      return toCharacter({
        ...current,
        attributes: JSON.stringify(mergedAttrs),
        updated_at: timestamp,
      });
    });
  }

  async unsetAttributes(params: UnsetAttributesParams): Promise<Character> {
    const { characterId, keys } = params;

    // Use a transaction for atomic read-modify-write
    return await this.db.transaction().execute(async (trx) => {
      // Fetch current character
      const current = await trx
        .selectFrom('characters')
        .selectAll()
        .where('id', '=', characterId)
        .executeTakeFirst();

      if (!current) {
        throw new Error(`Character not found: ${characterId}`);
      }

      // Remove specified keys
      const existingAttrs = JSON.parse(current.attributes) as Record<
        string,
        AttributeValue
      >;
      for (const key of keys) {
        delete existingAttrs[key];
      }
      const timestamp = now();

      // Update
      await trx
        .updateTable('characters')
        .set({
          attributes: JSON.stringify(existingAttrs),
          updated_at: timestamp,
        })
        .where('id', '=', characterId)
        .execute();

      return toCharacter({
        ...current,
        attributes: JSON.stringify(existingAttrs),
        updated_at: timestamp,
      });
    });
  }

  async setActiveCharacter(params: SetActiveCharacterParams): Promise<void> {
    const { userId, guildId, characterId } = params;

    // Use a transaction to validate and set atomically
    await this.db.transaction().execute(async (trx) => {
      // Verify character exists and belongs to user+guild
      const character = await trx
        .selectFrom('characters')
        .select(['id', 'user_id', 'guild_id'])
        .where('id', '=', characterId)
        .executeTakeFirst();

      if (!character) {
        throw new Error(`Character not found: ${characterId}`);
      }

      if (character.user_id !== userId || character.guild_id !== guildId) {
        throw new Error(
          'Character does not belong to this user in this guild'
        );
      }

      // Upsert active character (SQLite INSERT OR REPLACE)
      // First delete any existing, then insert
      await trx
        .deleteFrom('active_characters')
        .where('user_id', '=', userId)
        .where('guild_id', '=', guildId)
        .execute();

      await trx
        .insertInto('active_characters')
        .values({
          user_id: userId,
          guild_id: guildId,
          character_id: characterId,
        })
        .execute();
    });
  }

  async getActiveCharacter(
    params: GetActiveCharacterParams
  ): Promise<Character | null> {
    const { userId, guildId } = params;

    // Join active_characters with characters to get the full character
    const row = await this.db
      .selectFrom('active_characters')
      .innerJoin('characters', 'characters.id', 'active_characters.character_id')
      .selectAll('characters')
      .where('active_characters.user_id', '=', userId)
      .where('active_characters.guild_id', '=', guildId)
      .executeTakeFirst();

    return row ? toCharacter(row) : null;
  }
}
