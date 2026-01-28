/**
 * /inventory command - Bag management.
 *
 * Add, remove, and use items in the inventory.
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { EquipmentFeatureDeps, Character } from '../ports.js';
import type { ItemType, InventoryView } from '../types.js';
import {
  extractInventory,
  groupInventory,
  addItem,
  removeItem,
  useItem,
  formatItem,
} from '../service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Command Builder
// ─────────────────────────────────────────────────────────────────────────────

export const inventoryCommand = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('Manage your inventory')
  .addStringOption((opt) =>
    opt
      .setName('view')
      .setDescription('What to display')
      .setRequired(false)
      .addChoices(
        { name: 'Full inventory (default)', value: 'inventory' },
        { name: 'Consumables only', value: 'consumables' },
        { name: 'Equipment only', value: 'equipment' },
        { name: 'Misc items only', value: 'misc' }
      )
  )
  .addStringOption((opt) =>
    opt
      .setName('add_type')
      .setDescription('Type of item to add')
      .setRequired(false)
      .addChoices(
        { name: 'Armor', value: 'armor' },
        { name: 'Weapon', value: 'weapon' },
        { name: 'Consumable', value: 'consumable' },
        { name: 'Misc', value: 'misc' },
        { name: 'Item (generic)', value: 'item' }
      )
  )
  .addStringOption((opt) =>
    opt
      .setName('add_name')
      .setDescription('Name of item to add')
      .setRequired(false)
      .setMaxLength(100)
  )
  .addIntegerOption((opt) =>
    opt
      .setName('add_qty')
      .setDescription('Quantity to add (default 1)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(999)
  )
  .addStringOption((opt) =>
    opt
      .setName('remove_item')
      .setDescription('Item name or ID to remove')
      .setRequired(false)
      .setMaxLength(100)
  )
  .addIntegerOption((opt) =>
    opt
      .setName('remove_qty')
      .setDescription('Quantity to remove (default 1)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(999)
  )
  .addStringOption((opt) =>
    opt
      .setName('use_item')
      .setDescription('Consumable name or ID to use')
      .setRequired(false)
      .setMaxLength(100)
  )
  .addIntegerOption((opt) =>
    opt
      .setName('use_qty')
      .setDescription('Quantity to use (default 1)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(999)
  );

// ─────────────────────────────────────────────────────────────────────────────
// Dependencies
// ─────────────────────────────────────────────────────────────────────────────

let deps: EquipmentFeatureDeps | null = null;

export function setInventoryDeps(dependencies: EquipmentFeatureDeps): void {
  deps = dependencies;
}

function getDeps(): EquipmentFeatureDeps {
  if (!deps) {
    throw new Error('Inventory feature dependencies not initialized.');
  }
  return deps;
}

// ─────────────────────────────────────────────────────────────────────────────
// Character Resolution
// ─────────────────────────────────────────────────────────────────────────────

async function resolveActiveCharacter(
  interaction: ChatInputCommandInteraction
): Promise<{ character: Character } | { error: string }> {
  const { userRepo, characterRepo } = getDeps();

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

export async function handleInventoryCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const resolved = await resolveActiveCharacter(interaction);
  if ('error' in resolved) {
    await interaction.reply({ content: resolved.error, ephemeral: true });
    return;
  }

  const { character } = resolved;
  const { characterRepo } = getDeps();

  // Get options
  const view = (interaction.options.getString('view') ?? 'inventory') as InventoryView;
  const addType = interaction.options.getString('add_type') as ItemType | null;
  const addName = interaction.options.getString('add_name');
  const addQty = interaction.options.getInteger('add_qty') ?? 1;
  const removeItemQuery = interaction.options.getString('remove_item');
  const removeQty = interaction.options.getInteger('remove_qty') ?? 1;
  const useItemQuery = interaction.options.getString('use_item');
  const useQty = interaction.options.getInteger('use_qty') ?? 1;

  // Handle add
  if (addType && addName) {
    const result = await addItem(character, addName, addType, addQty, characterRepo);
    if (!result.success) {
      await interaction.reply({ content: result.error, ephemeral: true });
      return;
    }

    const qtyStr = addQty > 1 ? ` (x${addQty})` : '';
    await interaction.reply({
      content: `**${character.name}** - Added "${result.item.name}"${qtyStr} to inventory.`,
      ephemeral: true,
    });
    return;
  }

  // Handle add_type without add_name (show error)
  if (addType && !addName) {
    await interaction.reply({
      content: 'Please provide `add_name` when using `add_type`.',
      ephemeral: true,
    });
    return;
  }

  // Handle add_name without add_type (show error)
  if (addName && !addType) {
    await interaction.reply({
      content: 'Please provide `add_type` when using `add_name`. Valid types: armor, weapon, consumable, misc, item.',
      ephemeral: true,
    });
    return;
  }

  // Handle remove
  if (removeItemQuery) {
    const result = await removeItem(character, removeItemQuery, removeQty, characterRepo);
    if (!result.success) {
      await interaction.reply({ content: result.error, ephemeral: true });
      return;
    }

    if (result.removed) {
      await interaction.reply({
        content: `**${character.name}** - Removed "${result.item.name}" from inventory.`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: `**${character.name}** - Removed ${removeQty} of "${result.item.name}". ${result.newQty} remaining.`,
        ephemeral: true,
      });
    }
    return;
  }

  // Handle use
  if (useItemQuery) {
    const result = await useItem(character, useItemQuery, useQty, characterRepo);
    if (!result.success) {
      await interaction.reply({ content: result.error, ephemeral: true });
      return;
    }

    if (result.removed) {
      await interaction.reply({
        content: `**${character.name}** - Used "${result.item.name}". (none remaining)`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: `**${character.name}** - Used ${useQty} "${result.item.name}". ${result.newQty} remaining.`,
        ephemeral: true,
      });
    }
    return;
  }

  // Default: show view
  const content = generateInventoryView(character, view);
  await interaction.reply({ content, ephemeral: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// View Generators
// ─────────────────────────────────────────────────────────────────────────────

function generateInventoryView(character: Character, view: InventoryView): string {
  const inventory = extractInventory(character.attributes);
  const grouped = groupInventory(inventory);
  const lines: string[] = [`**${character.name}** - Inventory`];

  const showConsumables = view === 'inventory' || view === 'consumables';
  const showEquipment = view === 'inventory' || view === 'equipment';
  const showMisc = view === 'inventory' || view === 'misc';

  if (inventory.length === 0) {
    lines.push('');
    lines.push('*(empty)*');
    lines.push('');
    lines.push('**Add items:**');
    lines.push('```');
    lines.push('/inventory add_type:consumable add_name:"Health Potion" add_qty:3');
    lines.push('/inventory add_type:armor add_name:"Chain Mail"');
    lines.push('/inventory add_type:weapon add_name:"Longsword"');
    lines.push('/inventory add_type:misc add_name:"Ancient Amulet"');
    lines.push('```');
    return lines.join('\n');
  }

  // Consumables
  if (showConsumables) {
    lines.push('');
    lines.push('**Consumables:**');
    if (grouped.consumables.length === 0) {
      lines.push('  *(none)*');
    } else {
      for (const item of grouped.consumables) {
        lines.push(`  - ${formatItem(item)}`);
        if (item.notes) {
          lines.push(`    *${item.notes}*`);
        }
      }
    }
  }

  // Equipment (armor + weapons)
  if (showEquipment) {
    lines.push('');
    lines.push('**Equipment:**');

    const equipment = [...grouped.armor, ...grouped.weapons];
    if (equipment.length === 0) {
      lines.push('  *(none)*');
    } else {
      if (grouped.armor.length > 0) {
        lines.push('  *Armor:*');
        for (const item of grouped.armor) {
          lines.push(`    - ${formatItem(item)}`);
        }
      }
      if (grouped.weapons.length > 0) {
        lines.push('  *Weapons:*');
        for (const item of grouped.weapons) {
          lines.push(`    - ${formatItem(item)}`);
        }
      }
    }
  }

  // Misc items
  if (showMisc) {
    lines.push('');
    lines.push('**Misc Items:**');
    if (grouped.misc.length === 0) {
      lines.push('  *(none)*');
    } else {
      for (const item of grouped.misc) {
        lines.push(`  - ${formatItem(item)}`);
        if (item.notes) {
          lines.push(`    *${item.notes}*`);
        }
      }
    }

    // Misc item note
    if (grouped.misc.length > 0) {
      lines.push('');
      lines.push('*Misc items have no automatic game effects. Equip them to misc slots for narrative clarity.*');
    }
  }

  return lines.join('\n');
}
