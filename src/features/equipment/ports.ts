/**
 * Repository ports for the equipment feature.
 *
 * This module re-exports the persistence interfaces needed by this feature.
 * The feature should only import from here, not directly from the persistence package.
 */

export type {
  UserRepo,
  CharacterRepo,
  User,
  Character,
  AttributeValue,
} from '@discord-bot/persistence';

// Note: CharacterRepo.getById must be implemented in the persistence layer

export { AttrValue } from '@discord-bot/persistence';

/**
 * Combined dependencies interface for equipment feature handlers.
 */
export interface EquipmentFeatureDeps {
  userRepo: import('@discord-bot/persistence').UserRepo;
  characterRepo: import('@discord-bot/persistence').CharacterRepo;
}
