/**
 * Interactive Discord components for equipment management.
 *
 * Provides buttons and select menus for swapping equipped items.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import type { InventoryItem, EquipSlot } from './types.js';
import { SLOT_DISPLAY_NAMES } from './types.js';
import { formatItem } from './service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Component ID Prefixes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prefix for equipment swap button IDs.
 */
export const EQUIP_SWAP_PREFIX = 'equip_swap_';

/**
 * Prefix for equipment select menu IDs.
 */
export const EQUIP_SELECT_PREFIX = 'equip_select_';

/**
 * Prefix for unequip button IDs.
 */
export const UNEQUIP_PREFIX = 'equip_unequip_';

// ─────────────────────────────────────────────────────────────────────────────
// Component Builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create swap buttons for equipment slots.
 */
export function createSwapButtons(
  slots: EquipSlot[],
  characterId: string
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
  let currentRow = new ActionRowBuilder<MessageActionRowComponentBuilder>();
  let buttonCount = 0;

  for (const slot of slots) {
    const button = new ButtonBuilder()
      .setCustomId(`${EQUIP_SWAP_PREFIX}${slot}_${characterId}`)
      .setLabel(`Swap ${SLOT_DISPLAY_NAMES[slot]}`)
      .setStyle(ButtonStyle.Secondary);

    currentRow.addComponents(button);
    buttonCount++;

    // Discord allows max 5 buttons per row
    if (buttonCount >= 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<MessageActionRowComponentBuilder>();
      buttonCount = 0;
    }
  }

  if (buttonCount > 0) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Create a select menu for choosing an item to equip.
 */
export function createEquipSelectMenu(
  slot: EquipSlot,
  items: InventoryItem[],
  characterId: string,
  currentItemId?: string
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  const options: StringSelectMenuOptionBuilder[] = [];

  // Add "None" option to unequip
  options.push(
    new StringSelectMenuOptionBuilder()
      .setLabel('(None - Unequip)')
      .setValue('__none__')
      .setDescription('Remove equipped item')
      .setDefault(!currentItemId)
  );

  // Add compatible items
  for (const item of items) {
    const option = new StringSelectMenuOptionBuilder()
      .setLabel(item.name)
      .setValue(item.id)
      .setDescription(formatItem(item, { showId: false }).substring(0, 100))
      .setDefault(item.id === currentItemId);

    options.push(option);
  }

  // Limit to 25 options (Discord limit)
  const limitedOptions = options.slice(0, 25);

  const select = new StringSelectMenuBuilder()
    .setCustomId(`${EQUIP_SELECT_PREFIX}${slot}_${characterId}`)
    .setPlaceholder(`Select item for ${SLOT_DISPLAY_NAMES[slot]}`)
    .addOptions(limitedOptions);

  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(select);
}

/**
 * Create quick action buttons (view inventory, etc).
 */
export function createQuickActionRow(
  characterId: string
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  const viewInventoryBtn = new ButtonBuilder()
    .setCustomId(`equip_view_inventory_${characterId}`)
    .setLabel('View Inventory')
    .setStyle(ButtonStyle.Primary);

  const viewWornBtn = new ButtonBuilder()
    .setCustomId(`equip_view_worn_${characterId}`)
    .setLabel('View Equipped')
    .setStyle(ButtonStyle.Primary);

  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    viewInventoryBtn,
    viewWornBtn
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component ID Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a swap button custom ID.
 */
export function parseSwapButtonId(
  customId: string
): { slot: EquipSlot; characterId: string } | null {
  if (!customId.startsWith(EQUIP_SWAP_PREFIX)) {
    return null;
  }

  const rest = customId.slice(EQUIP_SWAP_PREFIX.length);
  const lastUnderscoreIndex = rest.lastIndexOf('_');
  if (lastUnderscoreIndex === -1) return null;

  const slot = rest.slice(0, lastUnderscoreIndex) as EquipSlot;
  const characterId = rest.slice(lastUnderscoreIndex + 1);

  return { slot, characterId };
}

/**
 * Parse a select menu custom ID.
 */
export function parseSelectMenuId(
  customId: string
): { slot: EquipSlot; characterId: string } | null {
  if (!customId.startsWith(EQUIP_SELECT_PREFIX)) {
    return null;
  }

  const rest = customId.slice(EQUIP_SELECT_PREFIX.length);
  const lastUnderscoreIndex = rest.lastIndexOf('_');
  if (lastUnderscoreIndex === -1) return null;

  const slot = rest.slice(0, lastUnderscoreIndex) as EquipSlot;
  const characterId = rest.slice(lastUnderscoreIndex + 1);

  return { slot, characterId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Interaction Type Guards
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if an interaction is an equipment-related button.
 */
export function isEquipmentButton(customId: string): boolean {
  return (
    customId.startsWith(EQUIP_SWAP_PREFIX) ||
    customId.startsWith(UNEQUIP_PREFIX) ||
    customId.startsWith('equip_view_')
  );
}

/**
 * Check if an interaction is an equipment select menu.
 */
export function isEquipmentSelectMenu(customId: string): boolean {
  return customId.startsWith(EQUIP_SELECT_PREFIX);
}
