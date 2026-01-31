/**
 * SQLite implementation of the Encounter repository.
 */

import type { Kysely } from 'kysely';
import { randomUUID } from 'crypto';
import type { Database } from './schema.js';
import type {
  Encounter,
  EncounterStatus,
} from '../ports/models.js';
import type {
  EncounterRepo,
  CreateEncounterParams,
  EncounterContextParams,
  UpdateEncounterParams,
} from '../ports/encounterRepo.js';

/**
 * Convert database row to Encounter domain model.
 */
function rowToEncounter(row: Database['encounters']): Encounter {
  return {
    id: row.id,
    name: row.name,
    status: row.status as EncounterStatus,
    guildId: row.guild_id,
    channelId: row.channel_id,
    threadId: row.thread_id,
    createdByDiscordUserId: row.created_by_discord_user_id,
    round: row.round,
    turnIndex: row.turn_index,
    initiativeLocked: row.initiative_locked === 1,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/**
 * SQLite implementation of EncounterRepo.
 */
export class SqliteEncounterRepo implements EncounterRepo {
  constructor(private readonly db: Kysely<Database>) {}

  async createEncounter(params: CreateEncounterParams): Promise<Encounter> {
    const id = randomUUID();
    const now = Date.now();

    const guildId = params.guildId ?? null;
    const threadId = params.threadId ?? null;

    await this.db
      .insertInto('encounters')
      .values({
        id,
        name: params.name,
        status: 'setup',
        guild_id: guildId,
        channel_id: params.channelId,
        thread_id: threadId,
        created_by_discord_user_id: params.createdByDiscordUserId,
        round: 1,
        turn_index: 0,
        initiative_locked: 0,
        created_at: now,
        updated_at: now,
      })
      .execute();

    return {
      id,
      name: params.name,
      status: 'setup',
      guildId,
      channelId: params.channelId,
      threadId,
      createdByDiscordUserId: params.createdByDiscordUserId,
      round: 1,
      turnIndex: 0,
      initiativeLocked: false,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    };
  }

  async getEncounter(encounterId: string): Promise<Encounter | null> {
    const row = await this.db
      .selectFrom('encounters')
      .selectAll()
      .where('id', '=', encounterId)
      .executeTakeFirst();

    return row ? rowToEncounter(row) : null;
  }

  async getActiveEncounterByContext(params: EncounterContextParams): Promise<Encounter | null> {
    const guildId = params.guildId ?? null;
    const threadId = params.threadId ?? null;

    let query = this.db
      .selectFrom('encounters')
      .selectAll()
      .where('channel_id', '=', params.channelId)
      .where('status', '!=', 'ended');

    // Handle nullable guild_id
    if (guildId === null) {
      query = query.where('guild_id', 'is', null);
    } else {
      query = query.where('guild_id', '=', guildId);
    }

    // Handle nullable thread_id
    if (threadId === null) {
      query = query.where('thread_id', 'is', null);
    } else {
      query = query.where('thread_id', '=', threadId);
    }

    const row = await query.executeTakeFirst();
    return row ? rowToEncounter(row) : null;
  }

  async updateEncounter(encounterId: string, patch: UpdateEncounterParams): Promise<Encounter> {
    const now = Date.now();

    const updateValues: Partial<Database['encounters']> = {
      updated_at: now,
    };

    if (patch.status !== undefined) {
      updateValues.status = patch.status;
    }
    if (patch.name !== undefined) {
      updateValues.name = patch.name;
    }
    if (patch.round !== undefined) {
      updateValues.round = patch.round;
    }
    if (patch.turnIndex !== undefined) {
      updateValues.turn_index = patch.turnIndex;
    }
    if (patch.initiativeLocked !== undefined) {
      updateValues.initiative_locked = patch.initiativeLocked ? 1 : 0;
    }

    const result = await this.db
      .updateTable('encounters')
      .set(updateValues)
      .where('id', '=', encounterId)
      .executeTakeFirst();

    if (result.numUpdatedRows === BigInt(0)) {
      throw new Error(`Encounter not found: ${encounterId}`);
    }

    const encounter = await this.getEncounter(encounterId);
    if (!encounter) {
      throw new Error(`Encounter not found after update: ${encounterId}`);
    }

    return encounter;
  }

  async endEncounter(encounterId: string): Promise<void> {
    const now = Date.now();

    const result = await this.db
      .updateTable('encounters')
      .set({
        status: 'ended',
        updated_at: now,
      })
      .where('id', '=', encounterId)
      .executeTakeFirst();

    if (result.numUpdatedRows === BigInt(0)) {
      throw new Error(`Encounter not found: ${encounterId}`);
    }
  }

  async listEncountersByContext(params: EncounterContextParams): Promise<Encounter[]> {
    const guildId = params.guildId ?? null;
    const threadId = params.threadId ?? null;

    let query = this.db
      .selectFrom('encounters')
      .selectAll()
      .where('channel_id', '=', params.channelId)
      .orderBy('created_at', 'desc');

    // Handle nullable guild_id
    if (guildId === null) {
      query = query.where('guild_id', 'is', null);
    } else {
      query = query.where('guild_id', '=', guildId);
    }

    // Handle nullable thread_id
    if (threadId === null) {
      query = query.where('thread_id', 'is', null);
    } else {
      query = query.where('thread_id', '=', threadId);
    }

    const rows = await query.execute();
    return rows.map(rowToEncounter);
  }
}
