/**
 * /equipment command - View and manage equipped items.
 *
 * Primary use cases:
 * - View currently worn/equipped items
 * - Swap items between slots (interactive or via options)
 * - Unequip items
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { EquipmentFeatureDeps, Character } from '../ports.js';
import type { EquipSlot, EquipmentView } from '../types.js';
import { EQUIP_SLOTS, SLOT_DISPLAY_NAMES, SLOT_COMPATIBILITY } from '../types.js';
import {
  extractInventory,
  extractEquipped,
  getItemById,
  equipItem,
  unequipItem,
  getCompatibleItems,
  formatItem,
} from '../service.js';
import {
  createSwapButtons,
  createEquipSelectMenu,
  parseSwapButtonId,
  parseSelectMenuId,
} from '../components.js';

// ─────────────────────────────────────────────────────────────────────────────
// Command Builder
// ─────────────────────────────────────────────────────────────────────────────

export const equipmentCommand = new SlashCommandBuilder()
  .setName('equipment')
  .setDescription('View and manage equipped items')
  .addStringOption((opt) =>
    opt
      .setName('view')
      .setDescription('What to display')
      .setRequired(false)
      .addChoices(
        { name: 'Worn items (default)', value: 'worn' },
        { name: 'Inventory', value: 'inventory' },
        { name: 'All', value: 'all' }
      )
  )
  .addStringOption((opt) =>
    opt
      .setName('equip_slot')
      .setDescription('Slot to equip an item to')
      .setRequired(false)
      .addChoices(
        { name: 'Armor (Body)', value: 'armor.body' },
        { name: 'Shield', value: 'armor.shield' },
        { name: 'Main-hand', value: 'weapon.main' },
        { name: 'Off-hand', value: 'weapon.off' },
        { name: 'Misc', value: 'misc.primary' },
        { name: 'Misc (Secondary)', value: 'misc.secondary' }
      )
  )
  .addStringOption((opt) =>
    opt
      .setName('equip_item')
      .setDescription('Item name or ID to equip')
      .setRequired(false)
      .setMaxLength(100)
  )
  .addStringOption((opt) =>
    opt
      .setName('unequip_slot')
      .setDescription('Slot to unequip')
      .setRequired(false)
      .addChoices(
        { name: 'Armor (Body)', value: 'armor.body' },
        { name: 'Shield', value: 'armor.shield' },
        { name: 'Main-hand', value: 'weapon.main' },
        { name: 'Off-hand', value: 'weapon.off' },
        { name: 'Misc', value: 'misc.primary' },
        { name: 'Misc (Secondary)', value: 'misc.secondary' }
      )
  );

// ─────────────────────────────────────────────────────────────────────────────
// Dependencies
// ─────────────────────────────────────────────────────────────────────────────

let deps: EquipmentFeatureDeps | null = null;

export function setEquipmentDeps(dependencies: EquipmentFeatureDeps): void {
  deps = dependencies;
}

function getDeps(): EquipmentFeatureDeps {
  if (!deps) {
    throw new Error('Equipment feature dependencies not initialized.');
  }
  return deps;
}

// ─────────────────────────────────────────────────────────────────────────────
// Character Resolution
// ─────────────────────────────────────────────────────────────────────────────

async function resolveActiveCharacter(
  interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction
): Promise<{ character: Character } | { error: string }> {
  const { userRepo, characterRepo } = getDeps();

  // Equipment commands work in both guild and DM contexts
  // In DM, we need a way to identify which guild's character to use
  // For now, require guild context
  if (!interaction.guildId) {
    return { error: 'This command must be used in a server.' };
  }

  const user = await userRepo.getOrCreateByDiscordUserId(interaction.user.id);
  const guildId = interaction.guildId;

  const character = await characterRepo.getActiveCharacter({
    userId: user.id,
    guildId,
  });

  if (!character) {
    return {
      error:
        'No active character. Use `/char active name:<name>` to set one first.',
    };
  }

  return { character };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function handleEquipmentCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const resolved = await resolveActiveCharacter(interaction);
  if ('error' in resolved) {
    await interaction.reply({ content: resolved.error, ephemeral: true });
    return;
  }

  const { character } = resolved;
  const { characterRepo } = getDeps();

  const view = (interaction.options.getString('view') ?? 'worn') as EquipmentView;
  const equipSlot = interaction.options.getString('equip_slot') as EquipSlot | null;
  const equipItemQuery = interaction.options.getString('equip_item');
  const unequipSlot = interaction.options.getString('unequip_slot') as EquipSlot | null;

  // Handle unequip
  if (unequipSlot) {
    const result = await unequipItem(character, unequipSlot, characterRepo);
    if (!result.success) {
      await interaction.reply({ content: result.error, ephemeral: true });
      return;
    }

    const slotName = SLOT_DISPLAY_NAMES[unequipSlot];
    if (result.item) {
      await interaction.reply({
        content: `**${character.name}** - Unequipped "${result.item.name}" from ${slotName}.`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: `**${character.name}** - ${slotName} was already empty.`,
        ephemeral: true,
      });
    }
    return;
  }

  // Handle equip
  if (equipSlot && equipItemQuery) {
    const result = await equipItem(character, equipSlot, equipItemQuery, characterRepo);
    if (!result.success) {
      await interaction.reply({ content: result.error, ephemeral: true });
      return;
    }

    const slotName = SLOT_DISPLAY_NAMES[equipSlot];
    let message = `**${character.name}** - Equipped "${result.item.name}" to ${slotName}.`;
    if (result.previousItem) {
      message += ` (replaced "${result.previousItem.name}")`;
    }

    await interaction.reply({ content: message, ephemeral: true });
    return;
  }

  // Handle equip slot without item (show compatible items)
  if (equipSlot && !equipItemQuery) {
    const inventory = extractInventory(character.attributes);
    const compatible = getCompatibleItems(inventory, equipSlot);
    const equipped = extractEquipped(character.attributes);
    const currentItemId = equipped[equipSlot];

    if (compatible.length === 0) {
      const types = SLOT_COMPATIBILITY[equipSlot].join(' or ');
      await interaction.reply({
        content: `**${character.name}** - No ${types} items in inventory. Use \`/inventory add_type:${SLOT_COMPATIBILITY[equipSlot][0]} add_name:"Item Name"\` to add one.`,
        ephemeral: true,
      });
      return;
    }

    const selectMenu = createEquipSelectMenu(equipSlot, compatible, character.id, currentItemId);
    await interaction.reply({
      content: `**${character.name}** - Select an item for ${SLOT_DISPLAY_NAMES[equipSlot]}:`,
      components: [selectMenu],
      ephemeral: true,
    });
    return;
  }

  // Default: show view
  const content = generateEquipmentView(character, view);
  const components = view === 'worn' || view === 'all'
    ? createSwapButtons(['armor.body', 'weapon.main', 'misc.primary'], character.id)
    : [];

  await interaction.reply({
    content,
    components,
    ephemeral: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Component Handlers
// ─────────────────────────────────────────────────────────────────────────────

export async function handleEquipmentButton(
  interaction: ButtonInteraction
): Promise<void> {
  const customId = interaction.customId;

  // Handle swap button
  const swapInfo = parseSwapButtonId(customId);
  if (swapInfo) {
    const { characterRepo } = getDeps();
    const character = await characterRepo.getById(swapInfo.characterId);

    if (!character) {
      await interaction.reply({ content: 'Character not found.', ephemeral: true });
      return;
    }

    // Verify user owns this character
    const { userRepo } = getDeps();
    const user = await userRepo.getOrCreateByDiscordUserId(interaction.user.id);
    if (character.userId !== user.id) {
      await interaction.reply({
        content: 'You can only manage your own characters.',
        ephemeral: true,
      });
      return;
    }

    const inventory = extractInventory(character.attributes);
    const compatible = getCompatibleItems(inventory, swapInfo.slot);
    const equipped = extractEquipped(character.attributes);
    const currentItemId = equipped[swapInfo.slot];

    if (compatible.length === 0) {
      const types = SLOT_COMPATIBILITY[swapInfo.slot].join(' or ');
      await interaction.reply({
        content: `No ${types} items in inventory.`,
        ephemeral: true,
      });
      return;
    }

    const selectMenu = createEquipSelectMenu(
      swapInfo.slot,
      compatible,
      character.id,
      currentItemId
    );
    await interaction.reply({
      content: `Select an item for ${SLOT_DISPLAY_NAMES[swapInfo.slot]}:`,
      components: [selectMenu],
      ephemeral: true,
    });
    return;
  }

  // Handle view buttons
  if (customId.startsWith('equip_view_')) {
    const resolved = await resolveActiveCharacter(interaction);
    if ('error' in resolved) {
      await interaction.reply({ content: resolved.error, ephemeral: true });
      return;
    }

    const { character } = resolved;

    if (customId.includes('inventory')) {
      const content = generateEquipmentView(character, 'inventory');
      await interaction.reply({ content, ephemeral: true });
    } else if (customId.includes('worn')) {
      const content = generateEquipmentView(character, 'worn');
      const components = createSwapButtons(
        ['armor.body', 'weapon.main', 'misc.primary'],
        character.id
      );
      await interaction.reply({ content, components, ephemeral: true });
    }
    return;
  }

  await interaction.reply({ content: 'Unknown action.', ephemeral: true });
}

export async function handleEquipmentSelectMenu(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const selectInfo = parseSelectMenuId(interaction.customId);
  if (!selectInfo) {
    await interaction.reply({ content: 'Invalid selection.', ephemeral: true });
    return;
  }

  const { characterRepo, userRepo } = getDeps();
  const character = await characterRepo.getById(selectInfo.characterId);

  if (!character) {
    await interaction.reply({ content: 'Character not found.', ephemeral: true });
    return;
  }

  // Verify user owns this character
  const user = await userRepo.getOrCreateByDiscordUserId(interaction.user.id);
  if (character.userId !== user.id) {
    await interaction.reply({
      content: 'You can only manage your own characters.',
      ephemeral: true,
    });
    return;
  }

  const selectedValue = interaction.values[0];
  if (!selectedValue) {
    await interaction.reply({ content: 'No selection made.', ephemeral: true });
    return;
  }
  const slotName = SLOT_DISPLAY_NAMES[selectInfo.slot];

  // Handle unequip
  if (selectedValue === '__none__') {
    const result = await unequipItem(character, selectInfo.slot, characterRepo);
    if (!result.success) {
      await interaction.reply({ content: result.error!, ephemeral: true });
      return;
    }

    await interaction.update({
      content: `**${character.name}** - ${slotName} unequipped.`,
      components: [],
    });
    return;
  }

  // Handle equip
  const result = await equipItem(character, selectInfo.slot, selectedValue, characterRepo);
  if (!result.success) {
    await interaction.reply({ content: result.error!, ephemeral: true });
    return;
  }

  let message = `**${character.name}** - Equipped "${result.item.name}" to ${slotName}.`;
  if (result.previousItem) {
    message += ` (replaced "${result.previousItem.name}")`;
  }

  await interaction.update({
    content: message,
    components: [],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// View Generators
// ─────────────────────────────────────────────────────────────────────────────

function generateEquipmentView(character: Character, view: EquipmentView): string {
  const inventory = extractInventory(character.attributes);
  const equipped = extractEquipped(character.attributes);
  const lines: string[] = [`**${character.name}** - Equipment`];

  const showWorn = view === 'worn' || view === 'all';
  const showInventory = view === 'inventory' || view === 'all';

  if (showWorn) {
    lines.push('');
    lines.push('**Equipped:**');

    for (const slot of EQUIP_SLOTS) {
      const itemId = equipped[slot];
      const item = itemId ? getItemById(inventory, itemId) : undefined;
      const slotName = SLOT_DISPLAY_NAMES[slot];

      if (item) {
        lines.push(`  ${slotName}: ${formatItem(item)}`);
      } else {
        lines.push(`  ${slotName}: —`);
      }
    }
  }

  if (showInventory) {
    lines.push('');
    lines.push('**Inventory:**');

    if (inventory.length === 0) {
      lines.push('  (empty)');
      lines.push('');
      lines.push('*Use `/inventory add_type:<type> add_name:"Name"` to add items.*');
    } else {
      // Group by type
      const armor = inventory.filter((i) => i.type === 'armor');
      const weapons = inventory.filter((i) => i.type === 'weapon');
      const consumables = inventory.filter((i) => i.type === 'consumable');
      const misc = inventory.filter((i) => i.type === 'misc' || i.type === 'item');

      if (armor.length > 0) {
        lines.push('  *Armor:*');
        for (const item of armor) {
          lines.push(`    - ${formatItem(item)}`);
        }
      }
      if (weapons.length > 0) {
        lines.push('  *Weapons:*');
        for (const item of weapons) {
          lines.push(`    - ${formatItem(item)}`);
        }
      }
      if (consumables.length > 0) {
        lines.push('  *Consumables:*');
        for (const item of consumables) {
          lines.push(`    - ${formatItem(item)}`);
        }
      }
      if (misc.length > 0) {
        lines.push('  *Misc Items:*');
        for (const item of misc) {
          lines.push(`    - ${formatItem(item)}`);
        }
      }
    }
  }

  return lines.join('\n');
}
