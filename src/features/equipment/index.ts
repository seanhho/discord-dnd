/**
 * Equipment management feature slice.
 *
 * Provides three top-level commands:
 * - /equipment - View and manage equipped items
 * - /armor - Armor-focused view and management
 * - /inventory - Bag management (add/remove/use items)
 */

import type { FeatureSlice } from '../../core/types.js';
import type { EquipmentFeatureDeps } from './ports.js';

// Commands
import {
  equipmentCommand,
  handleEquipmentCommand,
  setEquipmentDeps,
  handleEquipmentButton,
  handleEquipmentSelectMenu,
} from './commands/equipment.js';
import { armorCommand, handleArmorCommand, setArmorDeps } from './commands/armor.js';
import {
  inventoryCommand,
  handleInventoryCommand,
  setInventoryDeps,
} from './commands/inventory.js';

// Component utils
export {
  isEquipmentButton,
  isEquipmentSelectMenu,
} from './components.js';

// ─────────────────────────────────────────────────────────────────────────────
// Feature Slices
// ─────────────────────────────────────────────────────────────────────────────

/**
 * /equipment feature slice
 */
export const equipmentFeature: FeatureSlice = {
  name: 'equipment',
  command: equipmentCommand,
  handler: handleEquipmentCommand,
};

/**
 * /armor feature slice
 */
export const armorFeature: FeatureSlice = {
  name: 'armor',
  command: armorCommand,
  handler: handleArmorCommand,
};

/**
 * /inventory feature slice
 */
export const inventoryFeature: FeatureSlice = {
  name: 'inventory',
  command: inventoryCommand,
  handler: handleInventoryCommand,
};

// ─────────────────────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize all equipment features with dependencies.
 * Must be called during app startup before handling commands.
 */
export function initEquipmentFeature(deps: EquipmentFeatureDeps): void {
  setEquipmentDeps(deps);
  setArmorDeps(deps);
  setInventoryDeps(deps);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component Handlers Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle equipment-related button interactions.
 */
export { handleEquipmentButton, handleEquipmentSelectMenu };

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports
// ─────────────────────────────────────────────────────────────────────────────

export type { EquipmentFeatureDeps } from './ports.js';
export type {
  ItemType,
  InventoryItem,
  EquipSlot,
  EquippedState,
} from './types.js';
