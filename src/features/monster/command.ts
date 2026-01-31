/**
 * Discord command definitions and handlers for monster management.
 *
 * Commands:
 * - /monster set - Set monster attributes (DM only)
 * - /monster active - Set active monster (DM only)
 * - /monster show - Show monster information
 * - /monster get - Get specific attributes
 * - /monster unset - Remove attributes (DM only)
 * - /monster list - List all monsters
 *
 * Access Control:
 * - Write operations (set, active, unset) require DM capability
 * - Read operations (show, get, list) are available to all users
 *
 * Design Choice: Active monster is per guild (not per channel)
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { MonsterFeatureDeps, Monster, ShowView } from './types.js';
import { applyPatch, unsetKeys, getAttributeValues, formatDiffEntry } from './service.js';

/**
 * Build the /monster command with all subcommands.
 */
export const monsterCommand = new SlashCommandBuilder()
  .setName('monster')
  .setDescription('Manage monsters and NPCs')

  // /monster set
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Set attributes on a monster (DM only)')
      .addStringOption((opt) =>
        opt
          .setName('name')
          .setDescription('Monster name')
          .setRequired(true)
          .setMaxLength(100)
      )
      .addStringOption((opt) =>
        opt
          .setName('attributes')
          .setDescription('Attributes in {key:value, ...} format')
          .setRequired(true)
          .setMaxLength(1000)
      )
  )

  // /monster active
  .addSubcommand((sub) =>
    sub
      .setName('active')
      .setDescription('Set the active monster for this guild (DM only)')
      .addStringOption((opt) =>
        opt
          .setName('name')
          .setDescription('Monster name to set as active')
          .setRequired(true)
          .setMaxLength(100)
      )
  )

  // /monster show
  .addSubcommand((sub) =>
    sub
      .setName('show')
      .setDescription('Show monster information')
      .addStringOption((opt) =>
        opt
          .setName('name')
          .setDescription('Monster name (defaults to active)')
          .setRequired(false)
          .setMaxLength(100)
      )
      .addStringOption((opt) =>
        opt
          .setName('view')
          .setDescription('What to display')
          .setRequired(false)
          .addChoices(
            { name: 'Summary (default)', value: 'summary' },
            { name: 'All attributes', value: 'all' },
            { name: 'Help (suggested keys)', value: 'help' }
          )
      )
  )

  // /monster get
  .addSubcommand((sub) =>
    sub
      .setName('get')
      .setDescription('Get specific attribute values')
      .addStringOption((opt) =>
        opt
          .setName('name')
          .setDescription('Monster name (defaults to active)')
          .setRequired(false)
          .setMaxLength(100)
      )
      .addStringOption((opt) =>
        opt
          .setName('keys')
          .setDescription('Space-separated list of keys')
          .setRequired(false)
          .setMaxLength(500)
      )
      .addStringOption((opt) =>
        opt
          .setName('prefix')
          .setDescription('Key prefix to filter (e.g., "attack")')
          .setRequired(false)
          .setMaxLength(100)
      )
  )

  // /monster unset
  .addSubcommand((sub) =>
    sub
      .setName('unset')
      .setDescription('Remove attributes from a monster (DM only)')
      .addStringOption((opt) =>
        opt
          .setName('keys')
          .setDescription('Space-separated list of keys to remove')
          .setRequired(true)
          .setMaxLength(500)
      )
      .addStringOption((opt) =>
        opt
          .setName('name')
          .setDescription('Monster name (defaults to active)')
          .setRequired(false)
          .setMaxLength(100)
      )
  )

  // /monster list
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('List all monsters in this guild')
  );

/**
 * Dependencies required by the monster command handler.
 */
let deps: MonsterFeatureDeps | null = null;

/**
 * Set the dependencies for the monster feature.
 * Must be called during app initialization before handling commands.
 */
export function setMonsterDeps(dependencies: MonsterFeatureDeps): void {
  deps = dependencies;
}

/**
 * Get dependencies, throwing if not initialized.
 */
function getDeps(): MonsterFeatureDeps {
  if (!deps) {
    throw new Error(
      'Monster feature dependencies not initialized. Call setMonsterDeps() during app startup.'
    );
  }
  return deps;
}

/**
 * Main command handler - routes to subcommand handlers.
 */
export async function handleMonsterCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'set':
      await handleSet(interaction);
      break;
    case 'active':
      await handleActive(interaction);
      break;
    case 'show':
      await handleShow(interaction);
      break;
    case 'get':
      await handleGet(interaction);
      break;
    case 'unset':
      await handleUnset(interaction);
      break;
    case 'list':
      await handleList(interaction);
      break;
    default:
      await interaction.reply({
        content: `Unknown subcommand: ${subcommand}`,
        ephemeral: true,
      });
  }
}

/**
 * Check if the user has DM capability.
 */
async function checkDmPermission(
  interaction: ChatInputCommandInteraction
): Promise<boolean> {
  const { userRepo } = getDeps();
  return userRepo.isDmByDiscordUserId(interaction.user.id);
}

/**
 * Resolve a monster by name, or return error message.
 */
async function resolveMonster(
  interaction: ChatInputCommandInteraction,
  nameOpt: string | null
): Promise<{ monster: Monster } | { error: string }> {
  const { monsterRepo } = getDeps();

  if (!interaction.guildId) {
    return { error: 'This command can only be used in a server. Monsters are not available in DMs.' };
  }

  const guildId = interaction.guildId;

  if (nameOpt) {
    const monster = await monsterRepo.getMonsterByName({
      guildId,
      name: nameOpt.trim(),
    });
    if (!monster) {
      return {
        error: `Monster "${nameOpt}" not found. Use \`/monster list\` to see all monsters.`,
      };
    }
    return { monster };
  }

  // Default to active monster
  const active = await monsterRepo.getActiveMonster({ guildId });
  if (!active) {
    return {
      error:
        'No active monster set. Use `/monster active name:<name>` to set one, or specify a name.',
    };
  }
  return { monster: active };
}

// ============ Subcommand Handlers ============

async function handleSet(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const { monsterRepo } = getDeps();

  // Check guild context
  if (!interaction.guildId) {
    await interaction.reply({
      content: 'This command can only be used in a server. Monsters are not available in DMs.',
      ephemeral: true,
    });
    return;
  }

  // Check DM permission
  const isDm = await checkDmPermission(interaction);
  if (!isDm) {
    await interaction.reply({
      content: 'Only users with DM capability can create or modify monsters.',
      ephemeral: true,
    });
    return;
  }

  const nameOpt = interaction.options.getString('name', true).trim();
  const attributesOpt = interaction.options.getString('attributes', true);
  const guildId = interaction.guildId;

  // Get or create monster
  let monster = await monsterRepo.getMonsterByName({
    guildId,
    name: nameOpt,
  });

  if (!monster) {
    monster = await monsterRepo.createMonster({
      guildId,
      name: nameOpt,
    });
  }

  // Apply patch
  const result = await applyPatch(monster, attributesOpt, monsterRepo);

  if (!result.success) {
    await interaction.reply({
      content: `Failed to update "${nameOpt}":\n${result.error}`,
      ephemeral: true,
    });
    return;
  }

  // Build response
  const lines: string[] = [`Updated monster "${nameOpt}"`];
  lines.push('');
  lines.push('**Changes:**');
  for (const entry of result.diff) {
    lines.push(formatDiffEntry(entry));
  }

  // Show warnings
  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('**Warnings:**');
    for (const warning of result.warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  await interaction.reply({
    content: lines.join('\n'),
    ephemeral: true,
  });
}

async function handleActive(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const { monsterRepo } = getDeps();

  // Check guild context
  if (!interaction.guildId) {
    await interaction.reply({
      content: 'This command can only be used in a server. Monsters are not available in DMs.',
      ephemeral: true,
    });
    return;
  }

  // Check DM permission
  const isDm = await checkDmPermission(interaction);
  if (!isDm) {
    await interaction.reply({
      content: 'Only users with DM capability can set the active monster.',
      ephemeral: true,
    });
    return;
  }

  const nameOpt = interaction.options.getString('name', true).trim();
  const guildId = interaction.guildId;

  const monster = await monsterRepo.getMonsterByName({
    guildId,
    name: nameOpt,
  });

  if (!monster) {
    await interaction.reply({
      content: `Monster "${nameOpt}" not found. Use \`/monster list\` to see all monsters.`,
      ephemeral: true,
    });
    return;
  }

  await monsterRepo.setActiveMonster({
    guildId,
    monsterId: monster.id,
  });

  await interaction.reply({
    content: `Active monster set to "${monster.name}"`,
    ephemeral: true,
  });
}

async function handleShow(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  // Check guild context
  if (!interaction.guildId) {
    await interaction.reply({
      content: 'This command can only be used in a server. Monsters are not available in DMs.',
      ephemeral: true,
    });
    return;
  }

  const nameOpt = interaction.options.getString('name');
  const view = (interaction.options.getString('view') ?? 'summary') as ShowView;

  // Special view: help
  if (view === 'help') {
    await interaction.reply({
      content: generateHelpView(),
      ephemeral: true,
    });
    return;
  }

  // Views that need a monster
  const resolved = await resolveMonster(interaction, nameOpt);
  if ('error' in resolved) {
    await interaction.reply({ content: resolved.error, ephemeral: true });
    return;
  }

  const { monster } = resolved;
  const content = generateMonsterView(monster, view);

  await interaction.reply({
    content,
    ephemeral: true,
  });
}

async function handleGet(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  // Check guild context
  if (!interaction.guildId) {
    await interaction.reply({
      content: 'This command can only be used in a server. Monsters are not available in DMs.',
      ephemeral: true,
    });
    return;
  }

  const nameOpt = interaction.options.getString('name');
  const keysOpt = interaction.options.getString('keys');
  const prefixOpt = interaction.options.getString('prefix');

  if (!keysOpt && !prefixOpt) {
    await interaction.reply({
      content:
        'Please provide either `keys` or `prefix`. Use `/monster show view:help` to see suggested keys.',
      ephemeral: true,
    });
    return;
  }

  const resolved = await resolveMonster(interaction, nameOpt);
  if ('error' in resolved) {
    await interaction.reply({ content: resolved.error, ephemeral: true });
    return;
  }

  const { monster } = resolved;
  const keys = keysOpt
    ? keysOpt
        .split(/\s+/)
        .map((k) => k.trim())
        .filter((k) => k.length > 0)
    : undefined;

  const { values } = getAttributeValues(monster.attributes, {
    keys,
    prefix: prefixOpt ?? undefined,
  });

  if (Object.keys(values).length === 0) {
    await interaction.reply({
      content: `No matching attributes found for "${monster.name}".`,
      ephemeral: true,
    });
    return;
  }

  const lines = [`**${monster.name}** - Attributes:`];
  for (const [key, { value }] of Object.entries(values)) {
    lines.push(`  ${key}: ${value}`);
  }

  await interaction.reply({
    content: lines.join('\n'),
    ephemeral: true,
  });
}

async function handleUnset(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const { monsterRepo } = getDeps();

  // Check guild context
  if (!interaction.guildId) {
    await interaction.reply({
      content: 'This command can only be used in a server. Monsters are not available in DMs.',
      ephemeral: true,
    });
    return;
  }

  // Check DM permission
  const isDm = await checkDmPermission(interaction);
  if (!isDm) {
    await interaction.reply({
      content: 'Only users with DM capability can modify monsters.',
      ephemeral: true,
    });
    return;
  }

  const keysOpt = interaction.options.getString('keys', true);
  const nameOpt = interaction.options.getString('name');

  const resolved = await resolveMonster(interaction, nameOpt);
  if ('error' in resolved) {
    await interaction.reply({ content: resolved.error, ephemeral: true });
    return;
  }

  const { monster } = resolved;
  const result = await unsetKeys(monster, keysOpt, monsterRepo);

  if (!result.success) {
    await interaction.reply({
      content: `Failed to unset attributes: ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const lines: string[] = [`**${monster.name}** - Attributes removed`];

  if (result.removed.length > 0) {
    lines.push(`Removed: ${result.removed.join(', ')}`);
  }
  if (result.notFound.length > 0) {
    lines.push(`Not found: ${result.notFound.join(', ')}`);
  }

  const remaining = Object.keys(result.monster.attributes).length;
  lines.push(`Remaining attributes: ${remaining}`);

  await interaction.reply({
    content: lines.join('\n'),
    ephemeral: true,
  });
}

async function handleList(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const { monsterRepo } = getDeps();

  // Check guild context
  if (!interaction.guildId) {
    await interaction.reply({
      content: 'This command can only be used in a server. Monsters are not available in DMs.',
      ephemeral: true,
    });
    return;
  }

  const guildId = interaction.guildId;

  const monsters = await monsterRepo.listMonsters({ guildId });
  const active = await monsterRepo.getActiveMonster({ guildId });

  if (monsters.length === 0) {
    await interaction.reply({
      content:
        'No monsters in this server. DMs can use `/monster set name:<name> attributes:{...}` to create one.',
      ephemeral: true,
    });
    return;
  }

  const lines = ['**Monsters in this server:**'];
  for (const mon of monsters) {
    const isActive = active?.id === mon.id;
    const marker = isActive ? ' ⭐' : '';
    const attrCount = Object.keys(mon.attributes).length;
    lines.push(`  - ${mon.name}${marker} (${attrCount} attributes)`);
  }

  lines.push('');
  lines.push(`Total: ${monsters.length} monster(s)`);
  if (active) {
    lines.push(`Active: ${active.name}`);
  } else {
    lines.push('No active monster set. Use `/monster active` to set one.');
  }

  await interaction.reply({
    content: lines.join('\n'),
    ephemeral: true,
  });
}

// ============ View Generators ============

function generateHelpView(): string {
  const lines = [
    '**Monster Attributes - Suggested Keys**',
    '',
    'Monsters support any key you want! Here are common ones:',
    '',
    '**Core Stats:**',
    '  `ac` - Armor Class',
    '  `hp.max` - Maximum HP',
    '  `hp.current` - Current HP',
    '  `speed` - Movement speed',
    '  `cr` - Challenge Rating',
    '',
    '**Abilities:**',
    '  `str`, `dex`, `con`, `int`, `wis`, `cha` - Ability scores (1-30)',
    '',
    '**Attacks (use any naming scheme):**',
    '  `attack.bite.name` - Attack name',
    '  `attack.bite.bonus` - Attack bonus',
    '  `attack.bite.damage` - Damage dice',
    '  `attack.claw.name`, etc.',
    '',
    '**Template - Quick Start:**',
    '```',
    '{ac:13, hp.max:22, hp.current:22, str:15, dex:14, con:13, int:7, wis:11, cha:8}',
    '```',
    '',
    '**Template - With Attacks:**',
    '```',
    '{ac:13, hp.max:22, attack.bite.name:"Bite", attack.bite.bonus:4, attack.bite.damage:"1d6+2"}',
    '```',
    '',
    '**Note:** Unlike /char, monster keys are NOT restricted. Use any keys you need!',
  ];

  return lines.join('\n');
}

function generateMonsterView(monster: Monster, view: ShowView): string {
  const attrs = monster.attributes;
  const lines: string[] = [`**${monster.name}**`];

  const getValue = (key: string): string => {
    const attr = attrs[key];
    if (!attr) return '—';
    return typeof attr.v === 'string' ? attr.v : String(attr.v);
  };

  // Core stats section
  const showCore = view === 'summary' || view === 'all';
  if (showCore) {
    const ac = getValue('ac');
    const hpCurrent = getValue('hp.current');
    const hpMax = getValue('hp.max');
    const speed = getValue('speed');
    const cr = getValue('cr');

    if (ac !== '—' || hpMax !== '—') {
      lines.push('');
      lines.push('**Combat Stats:**');
      if (ac !== '—') lines.push(`AC: ${ac}`);
      if (hpMax !== '—') {
        const hpStr = hpCurrent !== '—' ? `${hpCurrent}/${hpMax}` : hpMax;
        lines.push(`HP: ${hpStr}`);
      }
      if (speed !== '—') lines.push(`Speed: ${speed} ft`);
      if (cr !== '—') lines.push(`CR: ${cr}`);
    }

    // Abilities
    const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const hasAbilities = abilities.some((a) => attrs[a] !== undefined);
    if (hasAbilities) {
      lines.push('');
      lines.push('**Abilities:**');
      const abilityStrs = abilities
        .map((a) => `${a.toUpperCase()}: ${getValue(a)}`)
        .join(' | ');
      lines.push(abilityStrs);
    }
  }

  // All attributes view
  if (view === 'all') {
    const allKeys = Object.keys(attrs).sort();
    const coreKeys = ['ac', 'hp.max', 'hp.current', 'speed', 'cr', 'str', 'dex', 'con', 'int', 'wis', 'cha'];
    const otherKeys = allKeys.filter((k) => !coreKeys.includes(k));

    if (otherKeys.length > 0) {
      lines.push('');
      lines.push('**Other Attributes:**');
      for (const key of otherKeys) {
        lines.push(`  ${key}: ${getValue(key)}`);
      }
    }
  }

  // Summary view - show a few extra keys
  if (view === 'summary') {
    const allKeys = Object.keys(attrs).sort();
    const coreKeys = ['ac', 'hp.max', 'hp.current', 'speed', 'cr', 'str', 'dex', 'con', 'int', 'wis', 'cha'];
    const otherKeys = allKeys.filter((k) => !coreKeys.includes(k));

    if (otherKeys.length > 0) {
      lines.push('');
      lines.push('**Other Attributes:**');
      const shown = otherKeys.slice(0, 5);
      for (const key of shown) {
        lines.push(`  ${key}: ${getValue(key)}`);
      }
      if (otherKeys.length > 5) {
        lines.push(`  ... and ${otherKeys.length - 5} more (use \`view:all\` to see all)`);
      }
    }
  }

  // If nothing was shown (empty monster)
  if (lines.length === 1) {
    lines.push('');
    lines.push('No attributes set. Use `/monster set` to add attributes.');
    lines.push('Use `/monster show view:help` for suggested keys.');
  }

  return lines.join('\n');
}
