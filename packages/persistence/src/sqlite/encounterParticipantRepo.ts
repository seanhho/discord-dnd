/**
 * SQLite implementation of the Encounter Participant repository.
 */

import type { Kysely } from 'kysely';
import { randomUUID } from 'crypto';
import type { Database } from './schema.js';
import type {
  EncounterParticipant,
  ParticipantKind,
} from '../ports/models.js';
import type {
  EncounterParticipantRepo,
  AddPcParticipantParams,
  AddNpcParticipantParams,
  InitiativeEntry,
} from '../ports/encounterRepo.js';

/**
 * Convert database row to EncounterParticipant domain model.
 */
function rowToParticipant(row: Database['encounter_participants']): EncounterParticipant {
  return {
    id: row.id,
    encounterId: row.encounter_id,
    kind: row.kind as ParticipantKind,
    displayName: row.display_name,
    initiative: row.initiative,
    sortOrder: row.sort_order,
    characterId: row.character_id,
    discordUserId: row.discord_user_id,
    npcRef: row.npc_ref,
    notes: row.notes,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/**
 * SQLite implementation of EncounterParticipantRepo.
 */
export class SqliteEncounterParticipantRepo implements EncounterParticipantRepo {
  constructor(private readonly db: Kysely<Database>) {}

  async addPcParticipant(params: AddPcParticipantParams): Promise<EncounterParticipant> {
    const id = randomUUID();
    const now = Date.now();

    // Get character to use name as display_name if not provided
    let displayName = params.displayName;
    if (!displayName) {
      const character = await this.db
        .selectFrom('characters')
        .select('name')
        .where('id', '=', params.characterId)
        .executeTakeFirst();

      if (!character) {
        throw new Error(`Character not found: ${params.characterId}`);
      }
      displayName = character.name;
    }

    // Get max sort_order for this encounter
    const maxOrder = await this.db
      .selectFrom('encounter_participants')
      .select(({ fn }) => fn.max('sort_order').as('max_order'))
      .where('encounter_id', '=', params.encounterId)
      .executeTakeFirst();

    const sortOrder = (maxOrder?.max_order ?? -1) + 1;

    await this.db
      .insertInto('encounter_participants')
      .values({
        id,
        encounter_id: params.encounterId,
        kind: 'pc',
        display_name: displayName,
        initiative: null,
        sort_order: sortOrder,
        character_id: params.characterId,
        discord_user_id: params.discordUserId ?? null,
        npc_ref: null,
        notes: null,
        created_at: now,
        updated_at: now,
      })
      .execute();

    // Update encounter's updated_at
    await this.db
      .updateTable('encounters')
      .set({ updated_at: now })
      .where('id', '=', params.encounterId)
      .execute();

    return {
      id,
      encounterId: params.encounterId,
      kind: 'pc',
      displayName,
      initiative: null,
      sortOrder,
      characterId: params.characterId,
      discordUserId: params.discordUserId ?? null,
      npcRef: null,
      notes: null,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    };
  }

  async addNpcParticipant(params: AddNpcParticipantParams): Promise<EncounterParticipant> {
    const id = randomUUID();
    const now = Date.now();

    // Get max sort_order for this encounter
    const maxOrder = await this.db
      .selectFrom('encounter_participants')
      .select(({ fn }) => fn.max('sort_order').as('max_order'))
      .where('encounter_id', '=', params.encounterId)
      .executeTakeFirst();

    const sortOrder = (maxOrder?.max_order ?? -1) + 1;

    await this.db
      .insertInto('encounter_participants')
      .values({
        id,
        encounter_id: params.encounterId,
        kind: 'npc',
        display_name: params.displayName,
        initiative: null,
        sort_order: sortOrder,
        character_id: null,
        discord_user_id: null,
        npc_ref: params.npcRef ?? null,
        notes: params.notes ?? null,
        created_at: now,
        updated_at: now,
      })
      .execute();

    // Update encounter's updated_at
    await this.db
      .updateTable('encounters')
      .set({ updated_at: now })
      .where('id', '=', params.encounterId)
      .execute();

    return {
      id,
      encounterId: params.encounterId,
      kind: 'npc',
      displayName: params.displayName,
      initiative: null,
      sortOrder,
      characterId: null,
      discordUserId: null,
      npcRef: params.npcRef ?? null,
      notes: params.notes ?? null,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    };
  }

  async removeParticipant(encounterId: string, participantId: string): Promise<void> {
    const now = Date.now();

    const result = await this.db
      .deleteFrom('encounter_participants')
      .where('id', '=', participantId)
      .where('encounter_id', '=', encounterId)
      .executeTakeFirst();

    if (result.numDeletedRows === BigInt(0)) {
      throw new Error(`Participant not found: ${participantId}`);
    }

    // Update encounter's updated_at
    await this.db
      .updateTable('encounters')
      .set({ updated_at: now })
      .where('id', '=', encounterId)
      .execute();
  }

  async listParticipants(encounterId: string): Promise<EncounterParticipant[]> {
    const rows = await this.db
      .selectFrom('encounter_participants')
      .selectAll()
      .where('encounter_id', '=', encounterId)
      // Sort by initiative DESC (nulls last), then by sort_order ASC
      .orderBy('initiative', 'desc')
      .orderBy('sort_order', 'asc')
      .execute();

    return rows.map(rowToParticipant);
  }

  async getParticipant(encounterId: string, participantId: string): Promise<EncounterParticipant | null> {
    const row = await this.db
      .selectFrom('encounter_participants')
      .selectAll()
      .where('id', '=', participantId)
      .where('encounter_id', '=', encounterId)
      .executeTakeFirst();

    return row ? rowToParticipant(row) : null;
  }

  async setInitiative(encounterId: string, participantId: string, initiative: number): Promise<void> {
    const now = Date.now();

    const result = await this.db
      .updateTable('encounter_participants')
      .set({
        initiative,
        updated_at: now,
      })
      .where('id', '=', participantId)
      .where('encounter_id', '=', encounterId)
      .executeTakeFirst();

    if (result.numUpdatedRows === BigInt(0)) {
      throw new Error(`Participant not found: ${participantId}`);
    }

    // Update encounter's updated_at
    await this.db
      .updateTable('encounters')
      .set({ updated_at: now })
      .where('id', '=', encounterId)
      .execute();
  }

  async bulkSetInitiative(encounterId: string, entries: InitiativeEntry[]): Promise<void> {
    if (entries.length === 0) return;

    const now = Date.now();

    // Use a transaction for atomicity
    await this.db.transaction().execute(async (trx) => {
      for (const entry of entries) {
        const result = await trx
          .updateTable('encounter_participants')
          .set({
            initiative: entry.initiative,
            updated_at: now,
          })
          .where('id', '=', entry.participantId)
          .where('encounter_id', '=', encounterId)
          .executeTakeFirst();

        if (result.numUpdatedRows === BigInt(0)) {
          throw new Error(`Participant not found: ${entry.participantId}`);
        }
      }

      // Update encounter's updated_at
      await trx
        .updateTable('encounters')
        .set({ updated_at: now })
        .where('id', '=', encounterId)
        .execute();
    });
  }

  async reorderParticipants(encounterId: string, orderedParticipantIds: string[]): Promise<void> {
    if (orderedParticipantIds.length === 0) return;

    const now = Date.now();

    // Use a transaction for atomicity
    await this.db.transaction().execute(async (trx) => {
      for (let i = 0; i < orderedParticipantIds.length; i++) {
        const participantId = orderedParticipantIds[i]!;
        const result = await trx
          .updateTable('encounter_participants')
          .set({
            sort_order: i,
            updated_at: now,
          })
          .where('id', '=', participantId)
          .where('encounter_id', '=', encounterId)
          .executeTakeFirst();

        if (result.numUpdatedRows === BigInt(0)) {
          throw new Error(`Participant not found: ${participantId}`);
        }
      }

      // Update encounter's updated_at
      await trx
        .updateTable('encounters')
        .set({ updated_at: now })
        .where('id', '=', encounterId)
        .execute();
    });
  }
}
