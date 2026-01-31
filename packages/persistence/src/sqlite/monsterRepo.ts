/**
 * SQLite implementation of the Monster repository.
 */

import type { Kysely } from 'kysely';
import { randomUUID } from 'crypto';
import type { Database } from './schema.js';
import type { Monster, AttributeValue } from '../ports/models.js';
import type {
  MonsterRepo,
  CreateMonsterParams,
  GetMonsterByNameParams,
  ListMonstersParams,
  UpdateMonsterAttributesParams,
  UnsetMonsterAttributesParams,
  SetActiveMonsterParams,
  GetActiveMonsterParams,
} from '../ports/monsterRepo.js';

/**
 * Convert database row to Monster domain model.
 */
function rowToMonster(row: Database['monsters']): Monster {
  return {
    id: row.id,
    guildId: row.guild_id,
    name: row.name,
    attributes: JSON.parse(row.attributes) as Record<string, AttributeValue>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * SQLite implementation of MonsterRepo.
 */
export class SqliteMonsterRepo implements MonsterRepo {
  constructor(private readonly db: Kysely<Database>) {}

  async createMonster(params: CreateMonsterParams): Promise<Monster> {
    const id = randomUUID();
    const now = new Date().toISOString();

    try {
      await this.db
        .insertInto('monsters')
        .values({
          id,
          guild_id: params.guildId,
          name: params.name,
          name_lower: params.name.toLowerCase(),
          attributes: '{}',
          created_at: now,
          updated_at: now,
        })
        .execute();
    } catch (error) {
      // Handle unique constraint violation
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new Error(`Monster "${params.name}" already exists in this guild`);
      }
      throw error;
    }

    return {
      id,
      guildId: params.guildId,
      name: params.name,
      attributes: {},
      createdAt: now,
      updatedAt: now,
    };
  }

  async getMonsterByName(params: GetMonsterByNameParams): Promise<Monster | null> {
    const row = await this.db
      .selectFrom('monsters')
      .selectAll()
      .where('guild_id', '=', params.guildId)
      .where('name_lower', '=', params.name.toLowerCase())
      .executeTakeFirst();

    return row ? rowToMonster(row) : null;
  }

  async getMonsterById(monsterId: string): Promise<Monster | null> {
    const row = await this.db
      .selectFrom('monsters')
      .selectAll()
      .where('id', '=', monsterId)
      .executeTakeFirst();

    return row ? rowToMonster(row) : null;
  }

  async listMonsters(params: ListMonstersParams): Promise<Monster[]> {
    const rows = await this.db
      .selectFrom('monsters')
      .selectAll()
      .where('guild_id', '=', params.guildId)
      .orderBy('name', 'asc')
      .execute();

    return rows.map(rowToMonster);
  }

  async updateMonsterAttributes(params: UpdateMonsterAttributesParams): Promise<Monster> {
    // Get existing monster
    const existing = await this.db
      .selectFrom('monsters')
      .selectAll()
      .where('id', '=', params.monsterId)
      .executeTakeFirst();

    if (!existing) {
      throw new Error(`Monster not found: ${params.monsterId}`);
    }

    // Merge attributes
    const existingAttrs = JSON.parse(existing.attributes) as Record<string, AttributeValue>;
    const merged = { ...existingAttrs, ...params.patch };

    const now = new Date().toISOString();

    await this.db
      .updateTable('monsters')
      .set({
        attributes: JSON.stringify(merged),
        updated_at: now,
      })
      .where('id', '=', params.monsterId)
      .execute();

    return {
      id: existing.id,
      guildId: existing.guild_id,
      name: existing.name,
      attributes: merged,
      createdAt: existing.created_at,
      updatedAt: now,
    };
  }

  async unsetMonsterAttributes(params: UnsetMonsterAttributesParams): Promise<Monster> {
    // Get existing monster
    const existing = await this.db
      .selectFrom('monsters')
      .selectAll()
      .where('id', '=', params.monsterId)
      .executeTakeFirst();

    if (!existing) {
      throw new Error(`Monster not found: ${params.monsterId}`);
    }

    // Remove keys
    const existingAttrs = JSON.parse(existing.attributes) as Record<string, AttributeValue>;
    const updated = { ...existingAttrs };
    for (const key of params.keys) {
      delete updated[key];
    }

    const now = new Date().toISOString();

    await this.db
      .updateTable('monsters')
      .set({
        attributes: JSON.stringify(updated),
        updated_at: now,
      })
      .where('id', '=', params.monsterId)
      .execute();

    return {
      id: existing.id,
      guildId: existing.guild_id,
      name: existing.name,
      attributes: updated,
      createdAt: existing.created_at,
      updatedAt: now,
    };
  }

  async setActiveMonster(params: SetActiveMonsterParams): Promise<void> {
    // Verify monster exists and belongs to guild
    const monster = await this.db
      .selectFrom('monsters')
      .select(['id', 'guild_id'])
      .where('id', '=', params.monsterId)
      .executeTakeFirst();

    if (!monster) {
      throw new Error(`Monster not found: ${params.monsterId}`);
    }

    if (monster.guild_id !== params.guildId) {
      throw new Error(`Monster ${params.monsterId} does not belong to guild ${params.guildId}`);
    }

    // Upsert active monster
    // SQLite doesn't have UPSERT in all versions, so we delete and insert
    await this.db
      .deleteFrom('active_monsters')
      .where('guild_id', '=', params.guildId)
      .execute();

    await this.db
      .insertInto('active_monsters')
      .values({
        guild_id: params.guildId,
        monster_id: params.monsterId,
      })
      .execute();
  }

  async getActiveMonster(params: GetActiveMonsterParams): Promise<Monster | null> {
    const active = await this.db
      .selectFrom('active_monsters')
      .select('monster_id')
      .where('guild_id', '=', params.guildId)
      .executeTakeFirst();

    if (!active) {
      return null;
    }

    return this.getMonsterById(active.monster_id);
  }
}
