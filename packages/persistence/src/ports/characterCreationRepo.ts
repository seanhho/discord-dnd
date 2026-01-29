/**
 * Repository interface for character creation sessions.
 *
 * Stores state machine state for the /char create wizard.
 */

export interface CharacterCreationStateRecord {
  readonly instanceId: string;
  readonly userId: string;
  readonly guildId: string;
  readonly state: unknown;
  readonly meta: unknown;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface UpsertCharacterCreationStateParams {
  instanceId: string;
  userId: string;
  guildId: string;
  state: unknown;
  meta: unknown;
}

export interface CharacterCreationRepo {
  getByInstanceId(instanceId: string): Promise<CharacterCreationStateRecord | null>;
  upsertState(params: UpsertCharacterCreationStateParams): Promise<void>;
  deleteByInstanceId(instanceId: string): Promise<void>;
}
