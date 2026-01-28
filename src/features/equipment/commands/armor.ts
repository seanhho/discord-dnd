/**
 * /armor command - Armor-focused view and management.
 *
 * Simplified command for managing armor specifically.
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { EquipmentFeatureDeps, Character } from '../ports.js';
import type { ArmorView } from '../types.js';
import { SLOT_DISPLAY_NAMES } from '../types.js';
import {
  extractInventory,
  extractEquipped,
  getItemById,
  equipItem,
  unequipItem,
  groupInventory,
  formatItem,
} from '../service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Command Builder
// ─────────────────────────────────────────────────────────────────────────────

export const armorCommand = new SlashCommandBuilder()
  .setName('armor')
  .setDescription('View and manage armor')
  .addStringOption((opt) =>
    opt
      .setName('view')
      .setDescription('What to display')
      .setRequired(false)
      .addChoices(
        { name: 'Worn armor (default)', value: 'worn' },
        { name: 'Armor inventory', value: 'inventory' }
      )
  )
  .addStringOption((opt) =>
    opt
      .setName('equip_item')
      .setDescription('Armor name or ID to equip (to body slot)')
      .setRequired(false)
      .setMaxLength(100)
  )
  .addBooleanOption((opt) =>
    opt
      .setName('unequip')
      .setDescription('Unequip body armor')
      .setRequired(false)
  );

// ─────────────────────────────────────────────────────────────────────────────
// Dependencies
// ─────────────────────────────────────────────────────────────────────────────

let deps: EquipmentFeatureDeps | null = null;

export function setArmorDeps(dependencies: EquipmentFeatureDeps): void {
  deps = dependencies;
}

function getDeps(): EquipmentFeatureDeps {
  if (!deps) {
    throw new Error('Armor feature dependencies not initialized.');
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

export async function handleArmorCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const resolved = await resolveActiveCharacter(interaction);
  if ('error' in resolved) {
    await interaction.reply({ content: resolved.error, ephemeral: true });
    return;
  }

  const { character } = resolved;
  const { characterRepo } = getDeps();

  const view = (interaction.options.getString('view') ?? 'worn') as ArmorView;
  const equipItemQuery = interaction.options.getString('equip_item');
  const shouldUnequip = interaction.options.getBoolean('unequip') ?? false;

  // Handle unequip
  if (shouldUnequip) {
    const result = await unequipItem(character, 'armor.body', characterRepo);
    if (!result.success) {
      await interaction.reply({ content: result.error, ephemeral: true });
      return;
    }

    if (result.item) {
      await interaction.reply({
        content: `**${character.name}** - Removed "${result.item.name}" from body armor slot.`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: `**${character.name}** - No armor was equipped.`,
        ephemeral: true,
      });
    }
    return;
  }

  // Handle equip
  if (equipItemQuery) {
    const result = await equipItem(character, 'armor.body', equipItemQuery, characterRepo);
    if (!result.success) {
      await interaction.reply({ content: result.error, ephemeral: true });
      return;
    }

    let message = `**${character.name}** - Equipped "${result.item.name}" as body armor.`;
    if (result.previousItem) {
      message += ` (replaced "${result.previousItem.name}")`;
    }
    if (result.item.ac !== undefined) {
      message += `\nBase AC: ${result.item.ac}`;
    }

    await interaction.reply({ content: message, ephemeral: true });
    return;
  }

  // Default: show view
  const content = generateArmorView(character, view);
  await interaction.reply({ content, ephemeral: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// View Generators
// ─────────────────────────────────────────────────────────────────────────────

function generateArmorView(character: Character, view: ArmorView): string {
  const inventory = extractInventory(character.attributes);
  const equipped = extractEquipped(character.attributes);
  const grouped = groupInventory(inventory);
  const lines: string[] = [`**${character.name}** - Armor`];

  if (view === 'worn') {
    lines.push('');
    lines.push('**Currently Wearing:**');

    // Body armor
    const bodyId = equipped['armor.body'];
    const bodyItem = bodyId ? getItemById(inventory, bodyId) : undefined;
    if (bodyItem) {
      lines.push(`  ${SLOT_DISPLAY_NAMES['armor.body']}: ${formatItem(bodyItem)}`);
    } else {
      lines.push(`  ${SLOT_DISPLAY_NAMES['armor.body']}: —`);
    }

    // Shield
    const shieldId = equipped['armor.shield'];
    const shieldItem = shieldId ? getItemById(inventory, shieldId) : undefined;
    if (shieldItem) {
      lines.push(`  ${SLOT_DISPLAY_NAMES['armor.shield']}: ${formatItem(shieldItem)}`);
    } else {
      lines.push(`  ${SLOT_DISPLAY_NAMES['armor.shield']}: —`);
    }

    // Show total AC hint
    lines.push('');
    lines.push('*Note: Total AC is not computed automatically. Use `/char set attributes:{ac:X}` to set your AC.*');
  }

  if (view === 'inventory') {
    lines.push('');
    lines.push('**Armor Inventory:**');

    if (grouped.armor.length === 0) {
      lines.push('  (no armor items)');
      lines.push('');
      lines.push('*Add armor:*');
      lines.push('```');
      lines.push('/inventory add_type:armor add_name:"Plate Armor"');
      lines.push('```');
    } else {
      for (const item of grouped.armor) {
        const equippedIn = getArmorSlot(item.id, equipped);
        const marker = equippedIn ? ` *(${SLOT_DISPLAY_NAMES[equippedIn]})*` : '';
        lines.push(`  - ${formatItem(item)}${marker}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Check which armor slot an item is equipped in.
 */
function getArmorSlot(
  itemId: string,
  equipped: ReturnType<typeof extractEquipped>
): 'armor.body' | 'armor.shield' | null {
  if (equipped['armor.body'] === itemId) return 'armor.body';
  if (equipped['armor.shield'] === itemId) return 'armor.shield';
  return null;
}
