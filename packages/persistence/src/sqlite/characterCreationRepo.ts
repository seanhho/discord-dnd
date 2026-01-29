import type { Kysely } from 'kysely';
import type {
  CharacterCreationRepo,
  CharacterCreationStateRecord,
  UpsertCharacterCreationStateParams,
} from '../ports/characterCreationRepo.js';
import type { Database } from './schema.js';

/**
 * Get current ISO timestamp.
 */
function now(): string {
  return new Date().toISOString();
}

/**
 * SQLite implementation of CharacterCreationRepo.
 */
export class SqliteCharacterCreationRepo implements CharacterCreationRepo {
  constructor(private readonly db: Kysely<Database>) {}

  async getByInstanceId(
    instanceId: string
  ): Promise<CharacterCreationStateRecord | null> {
    const row = await this.db
      .selectFrom('character_creation_states')
      .selectAll()
      .where('instance_id', '=', instanceId)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    return {
      instanceId: row.instance_id,
      userId: row.user_id,
      guildId: row.guild_id,
      state: JSON.parse(row.state) as unknown,
      meta: JSON.parse(row.meta) as unknown,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async upsertState(params: UpsertCharacterCreationStateParams): Promise<void> {
    const timestamp = now();

    await this.db.transaction().execute(async (trx) => {
      const existing = await trx
        .selectFrom('character_creation_states')
        .select(['instance_id'])
        .where('instance_id', '=', params.instanceId)
        .executeTakeFirst();

      if (existing) {
        await trx
          .updateTable('character_creation_states')
          .set({
            user_id: params.userId,
            guild_id: params.guildId,
            state: JSON.stringify(params.state),
            meta: JSON.stringify(params.meta),
            updated_at: timestamp,
          })
          .where('instance_id', '=', params.instanceId)
          .execute();
      } else {
        await trx
          .insertInto('character_creation_states')
          .values({
            instance_id: params.instanceId,
            user_id: params.userId,
            guild_id: params.guildId,
            state: JSON.stringify(params.state),
            meta: JSON.stringify(params.meta),
            created_at: timestamp,
            updated_at: timestamp,
          })
          .execute();
      }
    });
  }

  async deleteByInstanceId(instanceId: string): Promise<void> {
    await this.db
      .deleteFrom('character_creation_states')
      .where('instance_id', '=', instanceId)
      .execute();
  }
}
