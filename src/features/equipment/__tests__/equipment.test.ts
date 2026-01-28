/**
 * Tests for equipment management service.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AttrValue, type AttributeValue, type Character } from '../ports.js';
import type { ItemType, EquipSlot, InventoryItem } from '../types.js';
import { EQUIP_SLOTS, SLOT_COMPATIBILITY } from '../types.js';
import {
  generateItemId,
  extractInventory,
  extractEquipped,
  groupInventory,
  lookupItem,
  getItemById,
  isSlotCompatible,
  getCompatibleItems,
  formatItem,
} from '../service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createTestCharacter(
  attributes: Record<string, AttributeValue> = {}
): Character {
  return {
    id: 'char-123',
    userId: 'user-456',
    guildId: 'guild-789',
    name: 'TestCharacter',
    attributes,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

function createInventoryAttributes(): Record<string, AttributeValue> {
  return {
    // Armor items
    'inv.plate_armor.name': AttrValue.str('Plate Armor'),
    'inv.plate_armor.type': AttrValue.str('armor'),
    'inv.plate_armor.ac': AttrValue.num(18),

    'inv.shield.name': AttrValue.str('Shield'),
    'inv.shield.type': AttrValue.str('armor'),
    'inv.shield.ac': AttrValue.num(2),

    // Weapon items
    'inv.longsword.name': AttrValue.str('Longsword'),
    'inv.longsword.type': AttrValue.str('weapon'),
    'inv.longsword.damage': AttrValue.str('1d8+3'),

    'inv.dagger.name': AttrValue.str('Dagger'),
    'inv.dagger.type': AttrValue.str('weapon'),
    'inv.dagger.damage': AttrValue.str('1d4+2'),
    'inv.dagger.qty': AttrValue.num(3),

    // Consumables
    'inv.health_potion.name': AttrValue.str('Health Potion'),
    'inv.health_potion.type': AttrValue.str('consumable'),
    'inv.health_potion.qty': AttrValue.num(5),
    'inv.health_potion.notes': AttrValue.str('Heals 2d4+2 HP'),

    // Misc items
    'inv.ancient_amulet.name': AttrValue.str('Ancient Amulet'),
    'inv.ancient_amulet.type': AttrValue.str('misc'),
    'inv.ancient_amulet.notes': AttrValue.str('Glows faintly in the dark'),

    'inv.strange_key.name': AttrValue.str('Strange Key'),
    'inv.strange_key.type': AttrValue.str('item'),

    // Equipped state
    'equip.armor.body': AttrValue.str('plate_armor'),
    'equip.weapon.main': AttrValue.str('longsword'),
    'equip.misc.primary': AttrValue.str('ancient_amulet'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Item ID Generation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('generateItemId', () => {
  it('should generate slug from name', () => {
    const id = generateItemId('Plate Armor', new Set());
    expect(id).toBe('plate_armor');
  });

  it('should handle special characters', () => {
    const id = generateItemId("Dragon's Breath Potion!", new Set());
    expect(id).toBe('dragon_s_breath_potion');
  });

  it('should handle collision by appending suffix', () => {
    const existing = new Set(['longsword']);
    const id = generateItemId('Longsword', existing);
    expect(id).toBe('longsword_2');
  });

  it('should handle multiple collisions', () => {
    const existing = new Set(['potion', 'potion_2', 'potion_3']);
    const id = generateItemId('Potion', existing);
    expect(id).toBe('potion_4');
  });

  it('should truncate long names', () => {
    const longName = 'A'.repeat(100);
    const id = generateItemId(longName, new Set());
    expect(id.length).toBeLessThanOrEqual(32);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Inventory Extraction Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('extractInventory', () => {
  it('should extract all items from attributes', () => {
    const attrs = createInventoryAttributes();
    const items = extractInventory(attrs);

    expect(items).toHaveLength(7);
  });

  it('should extract item properties correctly', () => {
    const attrs = createInventoryAttributes();
    const items = extractInventory(attrs);

    const plate = items.find((i) => i.id === 'plate_armor');
    expect(plate).toEqual({
      id: 'plate_armor',
      name: 'Plate Armor',
      type: 'armor',
      qty: 1,
      ac: 18,
    });
  });

  it('should handle quantity', () => {
    const attrs = createInventoryAttributes();
    const items = extractInventory(attrs);

    const daggers = items.find((i) => i.id === 'dagger');
    expect(daggers?.qty).toBe(3);
  });

  it('should handle notes', () => {
    const attrs = createInventoryAttributes();
    const items = extractInventory(attrs);

    const potion = items.find((i) => i.id === 'health_potion');
    expect(potion?.notes).toBe('Heals 2d4+2 HP');
  });

  it('should return empty array for no items', () => {
    const items = extractInventory({});
    expect(items).toHaveLength(0);
  });

  it('should sort items by name', () => {
    const attrs = createInventoryAttributes();
    const items = extractInventory(attrs);
    const names = items.map((i) => i.name);

    expect(names).toEqual([...names].sort());
  });
});

describe('extractEquipped', () => {
  it('should extract equipped state', () => {
    const attrs = createInventoryAttributes();
    const equipped = extractEquipped(attrs);

    expect(equipped['armor.body']).toBe('plate_armor');
    expect(equipped['weapon.main']).toBe('longsword');
    expect(equipped['misc.primary']).toBe('ancient_amulet');
  });

  it('should return empty slots as undefined', () => {
    const attrs = createInventoryAttributes();
    const equipped = extractEquipped(attrs);

    expect(equipped['armor.shield']).toBeUndefined();
    expect(equipped['weapon.off']).toBeUndefined();
  });
});

describe('groupInventory', () => {
  it('should group items by type', () => {
    const attrs = createInventoryAttributes();
    const items = extractInventory(attrs);
    const grouped = groupInventory(items);

    expect(grouped.armor).toHaveLength(2);
    expect(grouped.weapons).toHaveLength(2);
    expect(grouped.consumables).toHaveLength(1);
    expect(grouped.misc).toHaveLength(2); // misc + item types
  });

  it('should include "item" type in misc group', () => {
    const attrs = createInventoryAttributes();
    const items = extractInventory(attrs);
    const grouped = groupInventory(items);

    const miscIds = grouped.misc.map((i) => i.id);
    expect(miscIds).toContain('strange_key');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item Lookup Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('lookupItem', () => {
  let items: InventoryItem[];

  beforeEach(() => {
    const attrs = createInventoryAttributes();
    items = extractInventory(attrs);
  });

  it('should find item by exact ID', () => {
    const result = lookupItem(items, 'plate_armor');
    expect(result.found).toBe('single');
    if (result.found === 'single') {
      expect(result.item.name).toBe('Plate Armor');
    }
  });

  it('should find item by exact name (case-insensitive)', () => {
    const result = lookupItem(items, 'LONGSWORD');
    expect(result.found).toBe('single');
    if (result.found === 'single') {
      expect(result.item.id).toBe('longsword');
    }
  });

  it('should find item by partial name match', () => {
    const result = lookupItem(items, 'potion');
    expect(result.found).toBe('single');
    if (result.found === 'single') {
      expect(result.item.name).toBe('Health Potion');
    }
  });

  it('should return multiple for ambiguous query', () => {
    // Add items with similar partial names (no exact match for "magic")
    items.push({
      id: 'magic_sword',
      name: 'Magic Sword',
      type: 'weapon',
      qty: 1,
    });
    items.push({
      id: 'magic_staff',
      name: 'Magic Staff',
      type: 'weapon',
      qty: 1,
    });

    const result = lookupItem(items, 'magic');
    expect(result.found).toBe('multiple');
    if (result.found === 'multiple') {
      expect(result.items).toHaveLength(2);
    }
  });

  it('should prefer exact name match over partial matches', () => {
    // "Dagger" exactly matches item named "Dagger", even though "Dagger +1" also contains "dagger"
    items.push({
      id: 'dagger_2',
      name: 'Dagger +1',
      type: 'weapon',
      qty: 1,
    });

    const result = lookupItem(items, 'Dagger');
    expect(result.found).toBe('single');
    if (result.found === 'single') {
      expect(result.item.id).toBe('dagger');
    }
  });

  it('should return none for non-existent item', () => {
    const result = lookupItem(items, 'nonexistent');
    expect(result.found).toBe('none');
  });
});

describe('getItemById', () => {
  it('should return item by ID', () => {
    const attrs = createInventoryAttributes();
    const items = extractInventory(attrs);

    const item = getItemById(items, 'longsword');
    expect(item?.name).toBe('Longsword');
  });

  it('should return undefined for non-existent ID', () => {
    const attrs = createInventoryAttributes();
    const items = extractInventory(attrs);

    const item = getItemById(items, 'nonexistent');
    expect(item).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Slot Compatibility Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('isSlotCompatible', () => {
  it('should allow armor in armor.body slot', () => {
    expect(isSlotCompatible('armor.body', 'armor')).toBe(true);
  });

  it('should allow armor in armor.shield slot', () => {
    expect(isSlotCompatible('armor.shield', 'armor')).toBe(true);
  });

  it('should allow weapon in weapon.main slot', () => {
    expect(isSlotCompatible('weapon.main', 'weapon')).toBe(true);
  });

  it('should allow weapon in weapon.off slot', () => {
    expect(isSlotCompatible('weapon.off', 'weapon')).toBe(true);
  });

  it('should allow misc in misc.primary slot', () => {
    expect(isSlotCompatible('misc.primary', 'misc')).toBe(true);
  });

  it('should allow item in misc.primary slot', () => {
    expect(isSlotCompatible('misc.primary', 'item')).toBe(true);
  });

  it('should NOT allow weapon in armor.body slot', () => {
    expect(isSlotCompatible('armor.body', 'weapon')).toBe(false);
  });

  it('should NOT allow armor in weapon.main slot', () => {
    expect(isSlotCompatible('weapon.main', 'armor')).toBe(false);
  });

  it('should NOT allow consumable in any slot', () => {
    for (const slot of EQUIP_SLOTS) {
      expect(isSlotCompatible(slot, 'consumable')).toBe(false);
    }
  });

  it('should NOT allow armor in misc slot', () => {
    expect(isSlotCompatible('misc.primary', 'armor')).toBe(false);
  });
});

describe('getCompatibleItems', () => {
  it('should return only armor for armor.body slot', () => {
    const attrs = createInventoryAttributes();
    const items = extractInventory(attrs);
    const compatible = getCompatibleItems(items, 'armor.body');

    expect(compatible).toHaveLength(2);
    expect(compatible.every((i) => i.type === 'armor')).toBe(true);
  });

  it('should return only weapons for weapon.main slot', () => {
    const attrs = createInventoryAttributes();
    const items = extractInventory(attrs);
    const compatible = getCompatibleItems(items, 'weapon.main');

    expect(compatible).toHaveLength(2);
    expect(compatible.every((i) => i.type === 'weapon')).toBe(true);
  });

  it('should return misc and item for misc.primary slot', () => {
    const attrs = createInventoryAttributes();
    const items = extractInventory(attrs);
    const compatible = getCompatibleItems(items, 'misc.primary');

    expect(compatible).toHaveLength(2);
    expect(compatible.every((i) => i.type === 'misc' || i.type === 'item')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Misc Item Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Misc items', () => {
  it('should extract misc items correctly', () => {
    const attrs = createInventoryAttributes();
    const items = extractInventory(attrs);
    const amulet = items.find((i) => i.id === 'ancient_amulet');

    expect(amulet).toBeDefined();
    expect(amulet?.type).toBe('misc');
    expect(amulet?.notes).toBe('Glows faintly in the dark');
  });

  it('should treat "item" type as misc for compatibility', () => {
    const attrs = createInventoryAttributes();
    const items = extractInventory(attrs);
    const key = items.find((i) => i.id === 'strange_key');

    expect(key).toBeDefined();
    expect(key?.type).toBe('item');

    // Should be compatible with misc slots
    expect(isSlotCompatible('misc.primary', 'item')).toBe(true);
    expect(isSlotCompatible('misc.secondary', 'item')).toBe(true);
  });

  it('should allow equipping misc to misc.primary slot', () => {
    const equipped = extractEquipped(createInventoryAttributes());
    expect(equipped['misc.primary']).toBe('ancient_amulet');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Display Formatting Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('formatItem', () => {
  it('should format basic item', () => {
    const item: InventoryItem = {
      id: 'longsword',
      name: 'Longsword',
      type: 'weapon',
      qty: 1,
      damage: '1d8+3',
    };

    const formatted = formatItem(item);
    expect(formatted).toContain('Longsword');
    expect(formatted).toContain('[weapon]');
    expect(formatted).toContain('Damage: 1d8+3');
  });

  it('should show quantity for qty > 1', () => {
    const item: InventoryItem = {
      id: 'potion',
      name: 'Health Potion',
      type: 'consumable',
      qty: 5,
    };

    const formatted = formatItem(item);
    expect(formatted).toContain('(x5)');
  });

  it('should not show type for misc items', () => {
    const item: InventoryItem = {
      id: 'amulet',
      name: 'Ancient Amulet',
      type: 'misc',
      qty: 1,
    };

    const formatted = formatItem(item);
    expect(formatted).not.toContain('[misc]');
  });

  it('should show AC for armor', () => {
    const item: InventoryItem = {
      id: 'plate',
      name: 'Plate Armor',
      type: 'armor',
      qty: 1,
      ac: 18,
    };

    const formatted = formatItem(item);
    expect(formatted).toContain('AC: 18');
  });

  it('should show ID when requested', () => {
    const item: InventoryItem = {
      id: 'plate_armor',
      name: 'Plate Armor',
      type: 'armor',
      qty: 1,
    };

    const formatted = formatItem(item, { showId: true });
    expect(formatted).toContain('(id: plate_armor)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Inventory Rendering Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Inventory rendering', () => {
  it('should group misc items separately', () => {
    const attrs = createInventoryAttributes();
    const items = extractInventory(attrs);
    const grouped = groupInventory(items);

    // Misc items should be in their own group, not mixed with equipment
    expect(grouped.misc.length).toBeGreaterThan(0);
    expect(grouped.misc.some((i) => i.id === 'ancient_amulet')).toBe(true);
  });

  it('should include item type in misc group', () => {
    const attrs = createInventoryAttributes();
    const items = extractInventory(attrs);
    const grouped = groupInventory(items);

    // Items with type 'item' should also be in misc group
    expect(grouped.misc.some((i) => i.id === 'strange_key')).toBe(true);
  });
});
