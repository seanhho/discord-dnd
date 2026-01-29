/**
 * Discord command definitions and handlers for character management.
 *
 * Commands:
 * - /char set - Set character attributes
 * - /char active - Set active character
 * - /char show - Show character information
 * - /char get - Get specific attributes
 * - /char unset - Remove attributes
 * - /char setup start - Start character creation wizard
 * - /char setup resume - Resume an active wizard
 * - /char setup cancel - Cancel an active wizard
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CharacterFeatureDeps, Character } from './repo/ports.js';
import { applyPatch, unsetKeys, getAttributeValues, formatDiffEntry } from './kv/service.js';
import { deriveComputed, formatComputed, hasComputedValues } from './computed/derive.js';
import {
  KV_CONFIG,
  GROUP_ORDER,
  GROUP_NAMES,
  getKeysByGroup,
} from './kv/kv.config.js';
import type { ShowView } from './types.js';
import {
  handleSetupStart,
  handleSetupResume,
  handleSetupCancel,
} from './setup/index.js';

/**
 * Build the /char command with all subcommands.
 */
export const charCommand = new SlashCommandBuilder()
  .setName('char')
  .setDescription('Manage your characters')

  // /char set
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Set attributes on a character')
      .addStringOption((opt) =>
        opt
          .setName('name')
          .setDescription('Character name')
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

  // /char active
  .addSubcommand((sub) =>
    sub
      .setName('active')
      .setDescription('Set your active character')
      .addStringOption((opt) =>
        opt
          .setName('name')
          .setDescription('Character name to set as active')
          .setRequired(true)
          .setMaxLength(100)
      )
  )

  // /char show
  .addSubcommand((sub) =>
    sub
      .setName('show')
      .setDescription('Show character information')
      .addStringOption((opt) =>
        opt
          .setName('name')
          .setDescription('Character name (defaults to active)')
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
            { name: 'Stats', value: 'stats' },
            { name: 'HP', value: 'hp' },
            { name: 'Equipment', value: 'equipment' },
            { name: 'Attacks', value: 'attacks' },
            { name: 'All', value: 'all' },
            { name: 'Help (key reference)', value: 'help' },
            { name: 'Template (copy-paste examples)', value: 'template' },
            { name: 'Characters (list all)', value: 'characters' },
            { name: 'Active (show active name)', value: 'active' }
          )
      )
  )

  // /char get
  .addSubcommand((sub) =>
    sub
      .setName('get')
      .setDescription('Get specific attribute values')
      .addStringOption((opt) =>
        opt
          .setName('name')
          .setDescription('Character name (defaults to active)')
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
          .setDescription('Key prefix to filter (e.g., "weapon")')
          .setRequired(false)
          .setMaxLength(100)
      )
      .addBooleanOption((opt) =>
        opt
          .setName('computed')
          .setDescription('Include computed values (mods, proficiency)')
          .setRequired(false)
      )
  )

  // /char unset
  .addSubcommand((sub) =>
    sub
      .setName('unset')
      .setDescription('Remove attributes from a character')
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
          .setDescription('Character name (defaults to active)')
          .setRequired(false)
          .setMaxLength(100)
      )
  )

  // /char setup - subcommand group for character creation wizard
  .addSubcommandGroup((group) =>
    group
      .setName('setup')
      .setDescription('Character creation wizard')
      .addSubcommand((sub) =>
        sub
          .setName('start')
          .setDescription('Start the character creation wizard')
          .addStringOption((opt) =>
            opt
              .setName('name')
              .setDescription('Character name')
              .setRequired(true)
              .setMaxLength(100)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName('resume')
          .setDescription('Resume an active character creation wizard')
      )
      .addSubcommand((sub) =>
        sub
          .setName('cancel')
          .setDescription('Cancel an active character creation wizard')
      )
  );

/**
 * Dependencies required by the char command handler.
 */
let deps: CharacterFeatureDeps | null = null;

/**
 * Set the dependencies for the character feature.
 * Must be called during app initialization before handling commands.
 */
export function setCharacterDeps(dependencies: CharacterFeatureDeps): void {
  deps = dependencies;
}

/**
 * Get dependencies, throwing if not initialized.
 */
function getDeps(): CharacterFeatureDeps {
  if (!deps) {
    throw new Error(
      'Character feature dependencies not initialized. Call setCharacterDeps() during app startup.'
    );
  }
  return deps;
}

/**
 * Main command handler - routes to subcommand handlers.
 */
export async function handleCharCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const subcommandGroup = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();

  // Handle /char setup subcommand group
  if (subcommandGroup === 'setup') {
    switch (subcommand) {
      case 'start':
        await handleSetupStart(interaction);
        break;
      case 'resume':
        await handleSetupResume(interaction);
        break;
      case 'cancel':
        await handleSetupCancel(interaction);
        break;
      default:
        await interaction.reply({
          content: `Unknown setup subcommand: ${subcommand}`,
          ephemeral: true,
        });
    }
    return;
  }

  // Handle regular subcommands
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
    default:
      await interaction.reply({
        content: `Unknown subcommand: ${subcommand}`,
        ephemeral: true,
      });
  }
}

/**
 * Resolve a character by name, or return error message.
 */
async function resolveCharacter(
  interaction: ChatInputCommandInteraction,
  nameOpt: string | null
): Promise<{ character: Character } | { error: string }> {
  const { userRepo, characterRepo } = getDeps();

  if (!interaction.guildId) {
    return { error: 'This command can only be used in a server.' };
  }

  const user = await userRepo.getOrCreateByDiscordUserId(interaction.user.id);
  const guildId = interaction.guildId;

  if (nameOpt) {
    const character = await characterRepo.getByName({
      userId: user.id,
      guildId,
      name: nameOpt.trim(),
    });
    if (!character) {
      return {
        error: `Character "${nameOpt}" not found. Use \`/char show view:characters\` to see your characters.`,
      };
    }
    return { character };
  }

  // Default to active character
  const active = await characterRepo.getActiveCharacter({
    userId: user.id,
    guildId,
  });
  if (!active) {
    return {
      error:
        'No active character set. Use `/char active name:<name>` to set one, or specify a name.',
    };
  }
  return { character: active };
}

// ============ Subcommand Handlers ============

async function handleSet(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const { userRepo, characterRepo } = getDeps();

  if (!interaction.guildId) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  const nameOpt = interaction.options.getString('name', true).trim();
  const attributesOpt = interaction.options.getString('attributes', true);

  // Resolve user
  const user = await userRepo.getOrCreateByDiscordUserId(interaction.user.id);
  const guildId = interaction.guildId;

  // Get or create character
  let character = await characterRepo.getByName({
    userId: user.id,
    guildId,
    name: nameOpt,
  });

  if (!character) {
    character = await characterRepo.createCharacter({
      userId: user.id,
      guildId,
      name: nameOpt,
    });
  }

  // Apply patch
  const result = await applyPatch(character, attributesOpt, characterRepo);

  if (!result.success) {
    await interaction.reply({
      content: `Failed to update "${nameOpt}":\n${result.error}`,
      ephemeral: true,
    });
    return;
  }

  // Build response
  const lines: string[] = [`Updated "${nameOpt}"`];
  lines.push('');
  lines.push('**Changes:**');
  for (const entry of result.diff) {
    lines.push(formatDiffEntry(entry));
  }

  // Show computed values if any affectsComputed changed
  if (hasComputedValues(result.computed)) {
    lines.push('');
    lines.push('**Computed:**');
    for (const line of formatComputed(result.computed)) {
      lines.push(`  ${line}`);
    }
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
  const { userRepo, characterRepo } = getDeps();

  if (!interaction.guildId) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  const nameOpt = interaction.options.getString('name', true).trim();

  const user = await userRepo.getOrCreateByDiscordUserId(interaction.user.id);
  const guildId = interaction.guildId;

  const character = await characterRepo.getByName({
    userId: user.id,
    guildId,
    name: nameOpt,
  });

  if (!character) {
    await interaction.reply({
      content: `Character "${nameOpt}" not found. Use \`/char show view:characters\` to see your characters.`,
      ephemeral: true,
    });
    return;
  }

  await characterRepo.setActiveCharacter({
    userId: user.id,
    guildId,
    characterId: character.id,
  });

  await interaction.reply({
    content: `Active character set to "${character.name}"`,
    ephemeral: true,
  });
}

async function handleShow(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const { userRepo, characterRepo } = getDeps();

  if (!interaction.guildId) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  const nameOpt = interaction.options.getString('name');
  const view = (interaction.options.getString('view') ?? 'summary') as ShowView;

  const user = await userRepo.getOrCreateByDiscordUserId(interaction.user.id);
  const guildId = interaction.guildId;

  // Special views that don't need a specific character
  if (view === 'help') {
    await interaction.reply({
      content: generateHelpView(),
      ephemeral: true,
    });
    return;
  }

  if (view === 'template') {
    await interaction.reply({
      content: generateTemplateView(),
      ephemeral: true,
    });
    return;
  }

  if (view === 'characters') {
    const characters = await characterRepo.listByUser({
      userId: user.id,
      guildId,
    });
    const active = await characterRepo.getActiveCharacter({
      userId: user.id,
      guildId,
    });

    if (characters.length === 0) {
      await interaction.reply({
        content:
          'You have no characters in this server. Use `/char set name:<name> attributes:{...}` to create one.',
        ephemeral: true,
      });
      return;
    }

    const lines = ['**Your Characters:**'];
    for (const char of characters) {
      const isActive = active?.id === char.id;
      const marker = isActive ? ' (active)' : '';
      lines.push(`  - ${char.name}${marker}`);
    }

    await interaction.reply({
      content: lines.join('\n'),
      ephemeral: true,
    });
    return;
  }

  if (view === 'active') {
    const active = await characterRepo.getActiveCharacter({
      userId: user.id,
      guildId,
    });

    if (!active) {
      await interaction.reply({
        content:
          'No active character set. Use `/char active name:<name>` to set one.',
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: `Active character: **${active.name}**`,
      ephemeral: true,
    });
    return;
  }

  // Views that need a character
  const resolved = await resolveCharacter(interaction, nameOpt);
  if ('error' in resolved) {
    await interaction.reply({ content: resolved.error, ephemeral: true });
    return;
  }

  const { character } = resolved;
  const content = generateCharacterView(character, view);

  await interaction.reply({
    content,
    ephemeral: true,
  });
}

async function handleGet(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  const nameOpt = interaction.options.getString('name');
  const keysOpt = interaction.options.getString('keys');
  const prefixOpt = interaction.options.getString('prefix');
  const includeComputed = interaction.options.getBoolean('computed') ?? false;

  if (!keysOpt && !prefixOpt) {
    await interaction.reply({
      content:
        'Please provide either `keys` or `prefix`. Use `/char show view:help` to see available keys.',
      ephemeral: true,
    });
    return;
  }

  const resolved = await resolveCharacter(interaction, nameOpt);
  if ('error' in resolved) {
    await interaction.reply({ content: resolved.error, ephemeral: true });
    return;
  }

  const { character } = resolved;
  const keys = keysOpt
    ? keysOpt
        .split(/\s+/)
        .map((k) => k.trim())
        .filter((k) => k.length > 0)
    : undefined;

  const { values, hiddenKeyCount } = getAttributeValues(character.attributes, {
    keys,
    prefix: prefixOpt ?? undefined,
    includeComputed,
  });

  if (Object.keys(values).length === 0) {
    await interaction.reply({
      content: `No matching attributes found for "${character.name}".`,
      ephemeral: true,
    });
    return;
  }

  const lines = [`**${character.name}** - Attributes:`];
  for (const [key, { value, isComputed }] of Object.entries(values)) {
    const computed = isComputed ? ' (computed)' : '';
    lines.push(`  ${key}: ${value}${computed}`);
  }

  // Warn about hidden legacy keys
  if (hiddenKeyCount > 0) {
    lines.push('');
    lines.push(`*${hiddenKeyCount} legacy key(s) hidden. Use \`/char unset\` to clean up.*`);
  }

  await interaction.reply({
    content: lines.join('\n'),
    ephemeral: true,
  });
}

async function handleUnset(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const { characterRepo } = getDeps();

  if (!interaction.guildId) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  const keysOpt = interaction.options.getString('keys', true);
  const nameOpt = interaction.options.getString('name');

  const resolved = await resolveCharacter(interaction, nameOpt);
  if ('error' in resolved) {
    await interaction.reply({ content: resolved.error, ephemeral: true });
    return;
  }

  const { character } = resolved;
  const result = await unsetKeys(character, keysOpt, characterRepo);

  if (!result.success) {
    await interaction.reply({
      content: `Failed to unset attributes: ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const lines: string[] = [`**${character.name}** - Attributes removed`];

  if (result.removed.length > 0) {
    lines.push(`Removed: ${result.removed.join(', ')}`);
  }
  if (result.notFound.length > 0) {
    lines.push(`Not found: ${result.notFound.join(', ')}`);
  }

  const remaining = Object.keys(result.character.attributes).length;
  lines.push(`Remaining attributes: ${remaining}`);

  await interaction.reply({
    content: lines.join('\n'),
    ephemeral: true,
  });
}

// ============ View Generators ============

function generateHelpView(): string {
  const lines = ['**Character Attributes Reference**', ''];

  for (const group of GROUP_ORDER) {
    const groupName = GROUP_NAMES[group] ?? group;
    const keys = getKeysByGroup(group);

    lines.push(`**${groupName}**`);
    for (const key of keys) {
      const config = KV_CONFIG[key]!;
      const typeStr = config.type;
      let constraints = '';
      if (config.min !== undefined && config.max !== undefined) {
        constraints = ` (${config.min}-${config.max})`;
      } else if (config.min !== undefined) {
        constraints = ` (>= ${config.min})`;
      } else if (config.max !== undefined) {
        constraints = ` (<= ${config.max})`;
      }
      const computed = config.affectsComputed ? ' *' : '';
      lines.push(`  \`${key}\` [${typeStr}${constraints}]${computed} - ${config.description}`);
    }
    lines.push('');
  }

  lines.push('*Keys marked with * affect computed values (mods, proficiency)*');
  lines.push('');
  lines.push('**Inventory Items (dynamic):**');
  lines.push('  `inv.<item_id>.<property>` - Inventory item properties');
  lines.push('  Example: `inv.longsword.name`, `inv.longsword.damage`');
  lines.push('');
  lines.push('Only predefined keys are allowed. Unknown keys will be rejected.');

  return lines.join('\n');
}

function generateTemplateView(): string {
  const lines = [
    '**Copy-Paste Templates for /char set**',
    '',
    '**Basic Stats:**',
    '```',
    '{level:5, str:16, dex:14, con:12, int:10, wis:13, cha:8}',
    '```',
    '',
    '**Hit Points:**',
    '```',
    '{hp.max:45, hp.current:45, ac:16, speed:30}',
    '```',
    '',
    '**Primary Weapon:**',
    '```',
    '{weapon.primary.name:"Longsword", weapon.primary.damage:"1d8+3", weapon.primary.proficient:true}',
    '```',
    '',
    '**Full Character:**',
    '```',
    '{name:"Gandalf", class:"Wizard", level:20, str:10, dex:14, con:14, int:20, wis:18, cha:16, hp.max:102, hp.current:102, ac:12, speed:30}',
    '```',
  ];

  return lines.join('\n');
}

function generateCharacterView(character: Character, view: ShowView): string {
  const attrs = character.attributes;
  const computed = deriveComputed(attrs);
  const lines: string[] = [`**${character.name}**`];

  const getValue = (key: string): string => {
    const attr = attrs[key];
    if (!attr) return '—';
    return typeof attr.v === 'string' ? attr.v : String(attr.v);
  };

  const getNum = (key: string): number | undefined => {
    const attr = attrs[key];
    if (!attr || attr.t !== 'n') return undefined;
    return attr.v;
  };

  const formatMod = (mod: number | undefined): string => {
    if (mod === undefined) return '';
    return mod >= 0 ? ` (+${mod})` : ` (${mod})`;
  };

  // Identity section
  const showIdentity = view === 'summary' || view === 'all';
  if (showIdentity) {
    const cls = getValue('class');
    const level = getValue('level');
    if (cls !== '—' || level !== '—') {
      lines.push(`Level ${level} ${cls}`);
    }
  }

  // Stats section
  const showStats = view === 'stats' || view === 'summary' || view === 'all';
  if (showStats) {
    lines.push('');
    lines.push('**Abilities:**');
    const abilities = [
      { key: 'str', name: 'STR', mod: computed.strMod },
      { key: 'dex', name: 'DEX', mod: computed.dexMod },
      { key: 'con', name: 'CON', mod: computed.conMod },
      { key: 'int', name: 'INT', mod: computed.intMod },
      { key: 'wis', name: 'WIS', mod: computed.wisMod },
      { key: 'cha', name: 'CHA', mod: computed.chaMod },
    ];
    const abilityStrs = abilities
      .map((a) => `${a.name}: ${getValue(a.key)}${formatMod(a.mod)}`)
      .join(' | ');
    lines.push(abilityStrs);

    if (computed.proficiencyBonus !== undefined) {
      lines.push(`Proficiency: +${computed.proficiencyBonus}`);
    }
  }

  // HP section
  const showHp = view === 'hp' || view === 'summary' || view === 'all';
  if (showHp) {
    const hpCurrent = getNum('hp.current');
    const hpMax = getNum('hp.max');
    if (hpCurrent !== undefined || hpMax !== undefined) {
      lines.push('');
      lines.push('**Hit Points:**');
      lines.push(`HP: ${hpCurrent ?? '—'} / ${hpMax ?? '—'}`);
    }

    const ac = getValue('ac');
    const speed = getValue('speed');
    if (ac !== '—' || speed !== '—') {
      lines.push(`AC: ${ac} | Speed: ${speed} ft`);
    }
  }

  // Equipment section
  const showEquipment = view === 'equipment' || view === 'all';
  if (showEquipment) {
    const weaponName = getValue('weapon.primary.name');
    const weaponDamage = getValue('weapon.primary.damage');
    const proficient = attrs['weapon.primary.proficient'];
    if (weaponName !== '—' || weaponDamage !== '—') {
      lines.push('');
      lines.push('**Equipment:**');
      const profStr = proficient?.t === 'b' && proficient.v ? ' (proficient)' : '';
      lines.push(`Primary Weapon: ${weaponName} [${weaponDamage}]${profStr}`);
    }
  }

  // Attacks section
  const showAttacks = view === 'attacks' || view === 'all';
  if (showAttacks) {
    const weaponName = getValue('weapon.primary.name');
    const weaponDamage = getValue('weapon.primary.damage');
    const proficient = attrs['weapon.primary.proficient'];
    if (weaponName !== '—') {
      lines.push('');
      lines.push('**Attacks:**');
      let attackBonus = '—';
      // Calculate attack bonus if we have STR/DEX and proficiency info
      const strMod = computed.strMod;
      const profBonus = computed.proficiencyBonus;
      if (strMod !== undefined) {
        let bonus = strMod;
        if (proficient?.t === 'b' && proficient.v && profBonus !== undefined) {
          bonus += profBonus;
        }
        attackBonus = bonus >= 0 ? `+${bonus}` : `${bonus}`;
      }
      lines.push(`${weaponName}: ${attackBonus} to hit, ${weaponDamage} damage`);
    }
  }

  // If nothing was shown (empty character)
  if (lines.length === 1) {
    lines.push('');
    lines.push('No attributes set. Use `/char set` to add attributes.');
    lines.push('Use `/char show view:template` for copy-paste examples.');
  }

  return lines.join('\n');
}
