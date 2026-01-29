/**
 * Ports module - repository interfaces and domain models.
 * This is the public API that the rest of the application should depend on.
 * Implementation details (SQLite, etc.) should not leak beyond this boundary.
 */

// Domain models
export type { User, Character, AttributeValue } from './models.js';
export { AttrValue } from './models.js';

// Repository interfaces
export type { UserRepo } from './userRepo.js';
export type {
  CharacterRepo,
  CreateCharacterParams,
  GetByNameParams,
  ListByUserParams,
  UpdateAttributesParams,
  UnsetAttributesParams,
  SetActiveCharacterParams,
  GetActiveCharacterParams,
} from './characterRepo.js';
export type {
  WizardStateRepo,
  WizardState,
  SaveWizardStateParams,
} from './wizardStateRepo.js';
