/**
 * SQLite implementation of the Encounter Event repository.
 */

import type { Kysely } from 'kysely';
import { randomUUID } from 'crypto';
import type { Database } from './schema.js';
import type { EncounterEvent } from '../ports/models.js';
import type {
  EncounterEventRepo,
  AppendEventParams,
} from '../ports/encounterRepo.js';

/**
 * Convert database row to EncounterEvent domain model.
 */
function rowToEvent(row: Database['encounter_events']): EncounterEvent {
  let payload: unknown = null;
  if (row.payload_json) {
    try {
      payload = JSON.parse(row.payload_json);
    } catch {
      payload = row.payload_json;
    }
  }

  return {
    id: row.id,
    encounterId: row.encounter_id,
    createdAt: new Date(row.created_at).toISOString(),
    actorDiscordUserId: row.actor_discord_user_id,
    eventType: row.event_type,
    payload,
  };
}

/**
 * SQLite implementation of EncounterEventRepo.
 */
export class SqliteEncounterEventRepo implements EncounterEventRepo {
  constructor(private readonly db: Kysely<Database>) {}

  async appendEvent(params: AppendEventParams): Promise<void> {
    const id = randomUUID();
    const now = Date.now();

    // Verify encounter exists
    const encounter = await this.db
      .selectFrom('encounters')
      .select('id')
      .where('id', '=', params.encounterId)
      .executeTakeFirst();

    if (!encounter) {
      throw new Error(`Encounter not found: ${params.encounterId}`);
    }

    const payloadJson = params.payload !== undefined
      ? JSON.stringify(params.payload)
      : null;

    await this.db
      .insertInto('encounter_events')
      .values({
        id,
        encounter_id: params.encounterId,
        created_at: now,
        actor_discord_user_id: params.actorDiscordUserId ?? null,
        event_type: params.eventType,
        payload_json: payloadJson,
      })
      .execute();
  }

  async listEvents(encounterId: string, limit = 100): Promise<EncounterEvent[]> {
    const rows = await this.db
      .selectFrom('encounter_events')
      .selectAll()
      .where('encounter_id', '=', encounterId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute();

    return rows.map(rowToEvent);
  }
}
