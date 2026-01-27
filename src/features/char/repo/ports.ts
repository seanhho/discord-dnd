/**
 * Repository ports for the character feature.
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

export { AttrValue } from '@discord-bot/persistence';

/**
 * Combined dependencies interface for character feature handlers.
 */
export interface CharacterFeatureDeps {
  userRepo: import('@discord-bot/persistence').UserRepo;
  characterRepo: import('@discord-bot/persistence').CharacterRepo;
}
