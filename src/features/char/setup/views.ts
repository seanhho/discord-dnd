/**
 * Character Setup Wizard Views
 *
 * Discord embeds and components for the wizard UI.
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type APIEmbed,
  type APIActionRowComponent,
  type APIButtonComponent,
} from 'discord.js';
import { ABILITIES, ABILITY_NAMES } from '@discord-bot/dnd5e-types';
import type { WizardState, StateIdentity, StateAbilities, StateReview, StateDone } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Custom IDs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a button custom ID.
 */
export function buttonId(instanceId: string, action: string): string {
  return `charsetup:${instanceId}:btn:${action}`;
}

/**
 * Generate a modal custom ID.
 */
export function modalId(instanceId: string, modalType: string): string {
  return `charsetup:${instanceId}:modal:${modalType}`;
}

/**
 * Parse a custom ID.
 */
export function parseCustomId(
  customId: string
): { instanceId: string; type: 'btn' | 'modal'; action: string } | null {
  const match = customId.match(/^charsetup:([^:]+):(btn|modal):(.+)$/);
  if (!match || !match[1] || !match[2] || !match[3]) return null;
  return {
    instanceId: match[1],
    type: match[2] as 'btn' | 'modal',
    action: match[3],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Embeds
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render the wizard embed for the current state.
 */
export function renderWizardEmbed(state: WizardState): APIEmbed {
  switch (state.type) {
    case 'Identity':
      return renderIdentityEmbed(state);
    case 'Abilities':
      return renderAbilitiesEmbed(state);
    case 'Review':
      return renderReviewEmbed(state);
    case 'Done':
      return renderDoneEmbed(state);
    default:
      return new EmbedBuilder()
        .setTitle('Character Setup')
        .setDescription('Unknown state')
        .setColor(0x808080)
        .toJSON();
  }
}

function renderIdentityEmbed(state: StateIdentity): APIEmbed {
  const { draft } = state;

  const fields = [
    { name: 'Name', value: draft.name || '_Not set_', inline: true },
    { name: 'Class', value: draft.class || '_Not set_', inline: true },
    { name: 'Level', value: draft.level?.toString() || '_Not set_', inline: true },
  ];

  if (draft.race || draft.background) {
    fields.push(
      { name: 'Race', value: draft.race || '_Not set_', inline: true },
      { name: 'Background', value: draft.background || '_Not set_', inline: true },
      { name: '\u200B', value: '\u200B', inline: true } // Spacer
    );
  }

  return new EmbedBuilder()
    .setTitle('Character Setup - Step 1 of 3')
    .setDescription('**Character Identity**\n\nEnter your character\'s basic information. Name, class, and level are required.')
    .setColor(0x5865F2)
    .addFields(fields)
    .setFooter({ text: 'Click "Edit" to set values, then "Next" to continue' })
    .toJSON();
}

function renderAbilitiesEmbed(state: StateAbilities): APIEmbed {
  const { draft } = state;
  const abilities = draft.abilities || {};

  const fields = ABILITIES.map((ability) => ({
    name: ABILITY_NAMES[ability],
    value: abilities[ability]?.toString() || '_Not set_',
    inline: true,
  }));

  return new EmbedBuilder()
    .setTitle('Character Setup - Step 2 of 3')
    .setDescription('**Ability Scores**\n\nEnter your ability scores (1-30). These are optional but recommended.')
    .setColor(0x5865F2)
    .addFields(fields)
    .setFooter({ text: 'Click "Edit" to set values, then "Next" to continue' })
    .toJSON();
}

function renderReviewEmbed(state: StateReview): APIEmbed {
  const { draft } = state;
  const abilities = draft.abilities || {};

  const identityFields = [
    `**Name:** ${draft.name}`,
    `**Class:** ${draft.class}`,
    `**Level:** ${draft.level}`,
  ];
  if (draft.race) identityFields.push(`**Race:** ${draft.race}`);
  if (draft.background) identityFields.push(`**Background:** ${draft.background}`);

  const abilityValues = ABILITIES.map((ability) => {
    const value = abilities[ability];
    return `${ABILITY_NAMES[ability]}: ${value ?? '—'}`;
  }).join(' | ');

  return new EmbedBuilder()
    .setTitle('Character Setup - Step 3 of 3')
    .setDescription('**Review Your Character**\n\nPlease review the information below. Click "Confirm" to create your character.')
    .setColor(0x57F287)
    .addFields(
      { name: 'Identity', value: identityFields.join('\n'), inline: false },
      { name: 'Ability Scores', value: abilityValues || '_None set_', inline: false }
    )
    .setFooter({ text: 'Click "Confirm" to create your character' })
    .toJSON();
}

function renderDoneEmbed(state: StateDone): APIEmbed {
  const { draft, characterName } = state;

  return new EmbedBuilder()
    .setTitle('Character Created!')
    .setDescription(`**${characterName}** has been created and set as your active character.`)
    .setColor(0x57F287)
    .addFields(
      { name: 'Class', value: draft.class || 'Unknown', inline: true },
      { name: 'Level', value: draft.level?.toString() || '1', inline: true },
      { name: '\u200B', value: '\u200B', inline: true }
    )
    .setFooter({ text: 'Use /char show to view your character' })
    .toJSON();
}

// ─────────────────────────────────────────────────────────────────────────────
// Components (Buttons)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render the action row components for the current state.
 */
export function renderWizardComponents(
  state: WizardState,
  instanceId: string
): APIActionRowComponent<APIButtonComponent>[] {
  switch (state.type) {
    case 'Identity':
      return renderIdentityComponents(instanceId);
    case 'Abilities':
      return renderAbilitiesComponents(instanceId);
    case 'Review':
      return renderReviewComponents(instanceId);
    case 'Done':
      return []; // No buttons needed
    default:
      return [];
  }
}

function renderIdentityComponents(
  instanceId: string
): APIActionRowComponent<APIButtonComponent>[] {
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(buttonId(instanceId, 'edit_identity'))
        .setLabel('Edit')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(buttonId(instanceId, 'next'))
        .setLabel('Next')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(buttonId(instanceId, 'cancel'))
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
    );

  return [row.toJSON()];
}

function renderAbilitiesComponents(
  instanceId: string
): APIActionRowComponent<APIButtonComponent>[] {
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(buttonId(instanceId, 'edit_abilities'))
        .setLabel('Edit')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(buttonId(instanceId, 'back'))
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(buttonId(instanceId, 'next'))
        .setLabel('Next')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(buttonId(instanceId, 'cancel'))
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
    );

  return [row.toJSON()];
}

function renderReviewComponents(
  instanceId: string
): APIActionRowComponent<APIButtonComponent>[] {
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(buttonId(instanceId, 'back'))
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(buttonId(instanceId, 'confirm'))
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(buttonId(instanceId, 'cancel'))
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
    );

  return [row.toJSON()];
}

// ─────────────────────────────────────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create the identity input modal.
 */
export function createIdentityModal(
  instanceId: string,
  prefill?: { name?: string; class?: string; level?: number; race?: string; background?: string }
): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(modalId(instanceId, 'identity'))
    .setTitle('Character Identity')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel('Character Name')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., Gandalf')
          .setMaxLength(100)
          .setRequired(true)
          .setValue(prefill?.name || '')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('class')
          .setLabel('Class')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., Wizard, Fighter, Rogue')
          .setMaxLength(50)
          .setRequired(true)
          .setValue(prefill?.class || '')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('level')
          .setLabel('Level (1-20)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('1')
          .setMaxLength(2)
          .setRequired(true)
          .setValue(prefill?.level?.toString() || '')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('race')
          .setLabel('Race (optional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., Human, Elf, Dwarf')
          .setMaxLength(50)
          .setRequired(false)
          .setValue(prefill?.race || '')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('background')
          .setLabel('Background (optional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., Sage, Soldier, Criminal')
          .setMaxLength(50)
          .setRequired(false)
          .setValue(prefill?.background || '')
      )
    );
}

/**
 * Create the abilities input modal.
 * Note: Discord modals have a 5 component limit, so we use a multiline text input.
 */
export function createAbilitiesModal(
  instanceId: string,
  prefill?: Partial<Record<string, number>>
): ModalBuilder {
  const defaultText = ABILITIES.map((ability) => {
    const value = prefill?.[ability];
    return `${ability.toUpperCase()}: ${value ?? ''}`;
  }).join('\n');

  return new ModalBuilder()
    .setCustomId(modalId(instanceId, 'abilities'))
    .setTitle('Ability Scores')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('abilities')
          .setLabel('Enter ability scores (1-30)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('STR: 16\nDEX: 14\nCON: 12\nINT: 10\nWIS: 13\nCHA: 8')
          .setValue(defaultText)
          .setRequired(false)
      )
    );
}

/**
 * Parse ability scores from modal text input.
 */
export function parseAbilitiesInput(
  text: string
): Partial<Record<string, number>> {
  const result: Partial<Record<string, number>> = {};

  for (const line of text.split('\n')) {
    const match = line.match(/^\s*(str|dex|con|int|wis|cha)\s*:\s*(\d+)\s*$/i);
    if (match && match[1] && match[2]) {
      const ability = match[1].toLowerCase();
      const value = parseInt(match[2], 10);
      if (ABILITIES.includes(ability as typeof ABILITIES[number]) && value >= 1 && value <= 30) {
        result[ability] = value;
      }
    }
  }

  return result;
}
