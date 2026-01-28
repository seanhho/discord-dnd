/**
 * Types for the equipment management feature.
 */

import type { Character, AttributeValue } from '@discord-bot/persistence';

// ─────────────────────────────────────────────────────────────────────────────
// Item Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valid item types in the inventory system.
 */
export type ItemType = 'armor' | 'weapon' | 'consumable' | 'misc' | 'item';

/**
 * All valid item types as an array for validation.
 */
export const ITEM_TYPES: readonly ItemType[] = [
  'armor',
  'weapon',
  'consumable',
  'misc',
  'item',
] as const;

/**
 * Inventory item extracted from character attributes.
 */
export interface InventoryItem {
  /** Unique item ID (slug-based) */
  id: string;
  /** Item display name */
  name: string;
  /** Item type */
  type: ItemType;
  /** Quantity (default 1) */
  qty: number;
  /** Optional notes */
  notes?: string;
  /** Optional AC value (for armor) */
  ac?: number;
  /** Optional damage string (for weapons) */
  damage?: string;
  /** Optional tags (comma-separated) */
  tags?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Equipment Slots
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valid equipment slot identifiers.
 */
export type EquipSlot =
  | 'armor.body'
  | 'armor.shield'
  | 'weapon.main'
  | 'weapon.off'
  | 'misc.primary'
  | 'misc.secondary';

/**
 * All valid equipment slots as an array.
 */
export const EQUIP_SLOTS: readonly EquipSlot[] = [
  'armor.body',
  'armor.shield',
  'weapon.main',
  'weapon.off',
  'misc.primary',
  'misc.secondary',
] as const;

/**
 * Human-readable slot names for display.
 */
export const SLOT_DISPLAY_NAMES: Record<EquipSlot, string> = {
  'armor.body': 'Armor (Body)',
  'armor.shield': 'Shield',
  'weapon.main': 'Main-hand',
  'weapon.off': 'Off-hand',
  'misc.primary': 'Misc',
  'misc.secondary': 'Misc (Secondary)',
};

/**
 * Slot compatibility - which item types can go in which slots.
 */
export const SLOT_COMPATIBILITY: Record<EquipSlot, readonly ItemType[]> = {
  'armor.body': ['armor'],
  'armor.shield': ['armor'],
  'weapon.main': ['weapon'],
  'weapon.off': ['weapon'],
  'misc.primary': ['misc', 'item'],
  'misc.secondary': ['misc', 'item'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Equipped State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Currently equipped items.
 */
export interface EquippedState {
  'armor.body'?: string;
  'armor.shield'?: string;
  'weapon.main'?: string;
  'weapon.off'?: string;
  'misc.primary'?: string;
  'misc.secondary'?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Result Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result of adding an item.
 */
export type AddItemResult =
  | { success: true; item: InventoryItem; character: Character }
  | { success: false; error: string };

/**
 * Result of removing an item.
 */
export type RemoveItemResult =
  | { success: true; item: InventoryItem; removed: boolean; newQty: number; character: Character }
  | { success: false; error: string };

/**
 * Result of using a consumable.
 */
export type UseItemResult =
  | { success: true; item: InventoryItem; removed: boolean; newQty: number; character: Character }
  | { success: false; error: string };

/**
 * Result of equipping an item.
 */
export type EquipResult =
  | { success: true; slot: EquipSlot; item: InventoryItem; previousItem?: InventoryItem; character: Character }
  | { success: false; error: string };

/**
 * Result of unequipping an item.
 */
export type UnequipResult =
  | { success: true; slot: EquipSlot; item?: InventoryItem; character: Character }
  | { success: false; error: string };

/**
 * Inventory grouped by type.
 */
export interface GroupedInventory {
  armor: InventoryItem[];
  weapons: InventoryItem[];
  consumables: InventoryItem[];
  misc: InventoryItem[];
}

/**
 * Result of item lookup by name.
 */
export type ItemLookupResult =
  | { found: 'single'; item: InventoryItem }
  | { found: 'multiple'; items: InventoryItem[] }
  | { found: 'none' };

// ─────────────────────────────────────────────────────────────────────────────
// View Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * View options for /equipment command.
 */
export type EquipmentView = 'worn' | 'inventory' | 'all';

/**
 * View options for /armor command.
 */
export type ArmorView = 'worn' | 'inventory';

/**
 * View options for /inventory command.
 */
export type InventoryView = 'inventory' | 'consumables' | 'equipment' | 'misc';

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports
// ─────────────────────────────────────────────────────────────────────────────

export type { Character, AttributeValue };
