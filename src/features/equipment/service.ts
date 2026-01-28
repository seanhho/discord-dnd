/**
 * Equipment service - business logic for inventory and equipment management.
 *
 * This service operates on the flat KV storage:
 * - inv.<itemId>.name : string
 * - inv.<itemId>.type : string
 * - inv.<itemId>.qty  : number (optional, default 1)
 * - inv.<itemId>.notes : string (optional)
 * - inv.<itemId>.ac : number (optional)
 * - inv.<itemId>.damage : string (optional)
 * - inv.<itemId>.tags : string (optional)
 * - equip.<slot> : string (itemId reference)
 */

import type { Character, AttributeValue, CharacterRepo } from './ports.js';
import { AttrValue } from './ports.js';
import type {
  ItemType,
  InventoryItem,
  EquipSlot,
  EquippedState,
  GroupedInventory,
  AddItemResult,
  RemoveItemResult,
  UseItemResult,
  EquipResult,
  UnequipResult,
  ItemLookupResult,
} from './types.js';
import { ITEM_TYPES, EQUIP_SLOTS, SLOT_COMPATIBILITY } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Item ID Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a slug-based item ID from a name.
 * Handles collisions by appending numeric suffixes.
 */
export function generateItemId(name: string, existingIds: Set<string>): string {
  // Slugify: lowercase, replace non-alphanumeric with underscore, collapse multiple
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 32);

  if (!existingIds.has(base)) {
    return base;
  }

  // Find next available suffix
  let suffix = 2;
  while (existingIds.has(`${base}_${suffix}`)) {
    suffix++;
  }
  return `${base}_${suffix}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Attribute Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract string value from attribute.
 */
function getString(attr: AttributeValue | undefined): string | undefined {
  if (!attr) return undefined;
  return String(attr.v);
}

/**
 * Extract number value from attribute.
 */
function getNumber(attr: AttributeValue | undefined): number | undefined {
  if (!attr) return undefined;
  if (attr.t === 'n') return attr.v;
  const parsed = Number(attr.v);
  return isNaN(parsed) ? undefined : parsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inventory Extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract all inventory items from character attributes.
 */
export function extractInventory(attributes: Record<string, AttributeValue>): InventoryItem[] {
  const items: InventoryItem[] = [];
  const itemIds = new Set<string>();

  // Find all inv.<id>.name entries to identify items
  for (const key of Object.keys(attributes)) {
    const match = key.match(/^inv\.([^.]+)\.name$/);
    if (match && match[1]) {
      itemIds.add(match[1]);
    }
  }

  // Build item objects
  for (const id of itemIds) {
    const name = getString(attributes[`inv.${id}.name`]);
    const typeStr = getString(attributes[`inv.${id}.type`]);

    if (!name) continue;

    const type = (ITEM_TYPES.includes(typeStr as ItemType) ? typeStr : 'item') as ItemType;
    const qty = getNumber(attributes[`inv.${id}.qty`]) ?? 1;

    const item: InventoryItem = { id, name, type, qty };

    // Optional fields
    const notes = getString(attributes[`inv.${id}.notes`]);
    if (notes) item.notes = notes;

    const ac = getNumber(attributes[`inv.${id}.ac`]);
    if (ac !== undefined) item.ac = ac;

    const damage = getString(attributes[`inv.${id}.damage`]);
    if (damage) item.damage = damage;

    const tags = getString(attributes[`inv.${id}.tags`]);
    if (tags) item.tags = tags;

    items.push(item);
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Extract equipped state from character attributes.
 */
export function extractEquipped(attributes: Record<string, AttributeValue>): EquippedState {
  const equipped: EquippedState = {};

  for (const slot of EQUIP_SLOTS) {
    const itemId = getString(attributes[`equip.${slot}`]);
    if (itemId) {
      equipped[slot] = itemId;
    }
  }

  return equipped;
}

/**
 * Group inventory items by type.
 */
export function groupInventory(items: InventoryItem[]): GroupedInventory {
  return {
    armor: items.filter((i) => i.type === 'armor'),
    weapons: items.filter((i) => i.type === 'weapon'),
    consumables: items.filter((i) => i.type === 'consumable'),
    misc: items.filter((i) => i.type === 'misc' || i.type === 'item'),
  };
}

/**
 * Look up an item by ID or name (case-insensitive).
 */
export function lookupItem(items: InventoryItem[], query: string): ItemLookupResult {
  // Try exact ID match first
  const byId = items.find((i) => i.id === query);
  if (byId) {
    return { found: 'single', item: byId };
  }

  // Try case-insensitive name match
  const queryLower = query.toLowerCase();
  const byName = items.filter((i) => i.name.toLowerCase() === queryLower);

  if (byName.length === 1) {
    return { found: 'single', item: byName[0]! };
  }
  if (byName.length > 1) {
    return { found: 'multiple', items: byName };
  }

  // Try partial name match
  const partial = items.filter((i) => i.name.toLowerCase().includes(queryLower));
  if (partial.length === 1) {
    return { found: 'single', item: partial[0]! };
  }
  if (partial.length > 1) {
    return { found: 'multiple', items: partial };
  }

  return { found: 'none' };
}

/**
 * Get item by ID from inventory.
 */
export function getItemById(items: InventoryItem[], itemId: string): InventoryItem | undefined {
  return items.find((i) => i.id === itemId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot Compatibility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if an item type is compatible with a slot.
 */
export function isSlotCompatible(slot: EquipSlot, itemType: ItemType): boolean {
  return SLOT_COMPATIBILITY[slot].includes(itemType);
}

/**
 * Get compatible items for a slot.
 */
export function getCompatibleItems(items: InventoryItem[], slot: EquipSlot): InventoryItem[] {
  const compatible = SLOT_COMPATIBILITY[slot];
  return items.filter((i) => compatible.includes(i.type));
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Item
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add an item to inventory.
 */
export async function addItem(
  character: Character,
  name: string,
  type: ItemType,
  qty: number,
  characterRepo: CharacterRepo,
  options: { notes?: string; ac?: number; damage?: string; tags?: string } = {}
): Promise<AddItemResult> {
  // Validate type
  if (!ITEM_TYPES.includes(type)) {
    return { success: false, error: `Invalid item type: ${type}. Valid types: ${ITEM_TYPES.join(', ')}` };
  }

  // Validate quantity
  if (qty < 1) {
    return { success: false, error: 'Quantity must be at least 1.' };
  }

  // Check for existing item with same name
  const inventory = extractInventory(character.attributes);
  const existing = inventory.find((i) => i.name.toLowerCase() === name.toLowerCase());

  if (existing) {
    // If same type, increment quantity
    if (existing.type === type) {
      const newQty = existing.qty + qty;
      const patch: Record<string, AttributeValue> = {
        [`inv.${existing.id}.qty`]: AttrValue.num(newQty),
      };

      const updated = await characterRepo.updateAttributes({
        characterId: character.id,
        patch,
      });

      return {
        success: true,
        item: { ...existing, qty: newQty },
        character: updated,
      };
    }

    return {
      success: false,
      error: `An item named "${name}" already exists with type "${existing.type}".`,
    };
  }

  // Generate new item ID
  const existingIds = new Set(inventory.map((i) => i.id));
  const id = generateItemId(name, existingIds);

  // Build patch
  const patch: Record<string, AttributeValue> = {
    [`inv.${id}.name`]: AttrValue.str(name),
    [`inv.${id}.type`]: AttrValue.str(type),
  };

  if (qty !== 1) {
    patch[`inv.${id}.qty`] = AttrValue.num(qty);
  }

  if (options.notes) {
    patch[`inv.${id}.notes`] = AttrValue.str(options.notes);
  }
  if (options.ac !== undefined) {
    patch[`inv.${id}.ac`] = AttrValue.num(options.ac);
  }
  if (options.damage) {
    patch[`inv.${id}.damage`] = AttrValue.str(options.damage);
  }
  if (options.tags) {
    patch[`inv.${id}.tags`] = AttrValue.str(options.tags);
  }

  const updated = await characterRepo.updateAttributes({
    characterId: character.id,
    patch,
  });

  const item: InventoryItem = {
    id,
    name,
    type,
    qty,
    ...options,
  };

  return { success: true, item, character: updated };
}

// ─────────────────────────────────────────────────────────────────────────────
// Remove Item
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove an item (or reduce quantity) from inventory.
 */
export async function removeItem(
  character: Character,
  itemQuery: string,
  qty: number,
  characterRepo: CharacterRepo
): Promise<RemoveItemResult> {
  const inventory = extractInventory(character.attributes);
  const lookup = lookupItem(inventory, itemQuery);

  if (lookup.found === 'none') {
    return { success: false, error: `Item "${itemQuery}" not found in inventory.` };
  }

  if (lookup.found === 'multiple') {
    const names = lookup.items.map((i) => `"${i.name}" (${i.id})`).join(', ');
    return {
      success: false,
      error: `Multiple items match "${itemQuery}": ${names}. Please use the item ID.`,
    };
  }

  const item = lookup.item;

  if (qty > item.qty) {
    return {
      success: false,
      error: `Cannot remove ${qty} of "${item.name}" - only ${item.qty} in inventory.`,
    };
  }

  const newQty = item.qty - qty;
  const removed = newQty === 0;

  if (removed) {
    // Remove all item attributes
    const keysToRemove = Object.keys(character.attributes).filter((k) =>
      k.startsWith(`inv.${item.id}.`)
    );

    // Also check if equipped and unequip
    const equipped = extractEquipped(character.attributes);
    for (const slot of EQUIP_SLOTS) {
      if (equipped[slot] === item.id) {
        keysToRemove.push(`equip.${slot}`);
      }
    }

    const updated = await characterRepo.unsetAttributes({
      characterId: character.id,
      keys: keysToRemove,
    });

    return { success: true, item, removed: true, newQty: 0, character: updated };
  }

  // Just reduce quantity
  const patch: Record<string, AttributeValue> = {
    [`inv.${item.id}.qty`]: AttrValue.num(newQty),
  };

  const updated = await characterRepo.updateAttributes({
    characterId: character.id,
    patch,
  });

  return { success: true, item, removed: false, newQty, character: updated };
}

// ─────────────────────────────────────────────────────────────────────────────
// Use Consumable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Use a consumable item.
 */
export async function useItem(
  character: Character,
  itemQuery: string,
  qty: number,
  characterRepo: CharacterRepo
): Promise<UseItemResult> {
  const inventory = extractInventory(character.attributes);
  const lookup = lookupItem(inventory, itemQuery);

  if (lookup.found === 'none') {
    return { success: false, error: `Item "${itemQuery}" not found in inventory.` };
  }

  if (lookup.found === 'multiple') {
    const names = lookup.items.map((i) => `"${i.name}" (${i.id})`).join(', ');
    return {
      success: false,
      error: `Multiple items match "${itemQuery}": ${names}. Please use the item ID.`,
    };
  }

  const item = lookup.item;

  // Only consumables can be "used"
  if (item.type !== 'consumable') {
    return {
      success: false,
      error: `"${item.name}" is a ${item.type}, not a consumable. Only consumables can be used.`,
    };
  }

  if (qty > item.qty) {
    return {
      success: false,
      error: `Cannot use ${qty} of "${item.name}" - only ${item.qty} in inventory.`,
    };
  }

  const newQty = item.qty - qty;
  const removed = newQty === 0;

  if (removed) {
    const keysToRemove = Object.keys(character.attributes).filter((k) =>
      k.startsWith(`inv.${item.id}.`)
    );

    const updated = await characterRepo.unsetAttributes({
      characterId: character.id,
      keys: keysToRemove,
    });

    return { success: true, item, removed: true, newQty: 0, character: updated };
  }

  const patch: Record<string, AttributeValue> = {
    [`inv.${item.id}.qty`]: AttrValue.num(newQty),
  };

  const updated = await characterRepo.updateAttributes({
    characterId: character.id,
    patch,
  });

  return { success: true, item, removed: false, newQty, character: updated };
}

// ─────────────────────────────────────────────────────────────────────────────
// Equip Item
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Equip an item to a slot.
 */
export async function equipItem(
  character: Character,
  slot: EquipSlot,
  itemQuery: string,
  characterRepo: CharacterRepo
): Promise<EquipResult> {
  if (!EQUIP_SLOTS.includes(slot)) {
    return {
      success: false,
      error: `Invalid slot: ${slot}. Valid slots: ${EQUIP_SLOTS.join(', ')}`,
    };
  }

  const inventory = extractInventory(character.attributes);
  const lookup = lookupItem(inventory, itemQuery);

  if (lookup.found === 'none') {
    return { success: false, error: `Item "${itemQuery}" not found in inventory.` };
  }

  if (lookup.found === 'multiple') {
    const names = lookup.items.map((i) => `"${i.name}" (${i.id})`).join(', ');
    return {
      success: false,
      error: `Multiple items match "${itemQuery}": ${names}. Please use the item ID.`,
    };
  }

  const item = lookup.item;

  // Check slot compatibility
  if (!isSlotCompatible(slot, item.type)) {
    const compatibleTypes = SLOT_COMPATIBILITY[slot].join(' or ');
    return {
      success: false,
      error: `Cannot equip "${item.name}" (${item.type}) to ${slot}. This slot requires: ${compatibleTypes}.`,
    };
  }

  // Get previous item
  const equipped = extractEquipped(character.attributes);
  const previousId = equipped[slot];
  const previousItem = previousId ? getItemById(inventory, previousId) : undefined;

  // Update equipment slot
  const patch: Record<string, AttributeValue> = {
    [`equip.${slot}`]: AttrValue.str(item.id),
  };

  const updated = await characterRepo.updateAttributes({
    characterId: character.id,
    patch,
  });

  return { success: true, slot, item, previousItem, character: updated };
}

// ─────────────────────────────────────────────────────────────────────────────
// Unequip Item
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unequip an item from a slot.
 */
export async function unequipItem(
  character: Character,
  slot: EquipSlot,
  characterRepo: CharacterRepo
): Promise<UnequipResult> {
  if (!EQUIP_SLOTS.includes(slot)) {
    return {
      success: false,
      error: `Invalid slot: ${slot}. Valid slots: ${EQUIP_SLOTS.join(', ')}`,
    };
  }

  const equipped = extractEquipped(character.attributes);
  const itemId = equipped[slot];

  if (!itemId) {
    return { success: true, slot, item: undefined, character };
  }

  const inventory = extractInventory(character.attributes);
  const item = getItemById(inventory, itemId);

  const updated = await characterRepo.unsetAttributes({
    characterId: character.id,
    keys: [`equip.${slot}`],
  });

  return { success: true, slot, item, character: updated };
}

// ─────────────────────────────────────────────────────────────────────────────
// Display Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format an item for display.
 */
export function formatItem(item: InventoryItem, options: { showId?: boolean } = {}): string {
  const parts: string[] = [];

  // Name and quantity
  if (item.qty > 1) {
    parts.push(`${item.name} (x${item.qty})`);
  } else {
    parts.push(item.name);
  }

  // Type indicator for non-misc items
  if (item.type !== 'misc' && item.type !== 'item') {
    parts.push(`[${item.type}]`);
  }

  // Stats
  if (item.ac !== undefined) {
    parts.push(`AC: ${item.ac}`);
  }
  if (item.damage) {
    parts.push(`Damage: ${item.damage}`);
  }

  // Optional ID
  if (options.showId) {
    parts.push(`(id: ${item.id})`);
  }

  return parts.join(' ');
}

/**
 * Format item with notes on separate line.
 */
export function formatItemWithNotes(item: InventoryItem): string[] {
  const lines: string[] = [formatItem(item)];
  if (item.notes) {
    lines.push(`  *${item.notes}*`);
  }
  return lines;
}
