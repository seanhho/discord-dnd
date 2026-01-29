import type {
  ChatInputCommandInteraction,
  Interaction,
  ButtonInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import { ABILITIES } from '@discord-bot/dnd5e-types';
import type { CharacterFeatureDeps } from '../repo/ports.js';
import type { EditableStep, WizardEvent } from './types.js';
import { WizardRuntime } from './runtime.js';

const INSTANCE_PREFIX = 'char-setup';
const CUSTOM_ID_PREFIX = 'charsetup';

let runtime: WizardRuntime | null = null;

export function initWizardRuntime(deps: CharacterFeatureDeps): void {
  runtime = new WizardRuntime(deps);
}

function getRuntime(): WizardRuntime {
  if (!runtime) {
    throw new Error('Wizard runtime not initialized.');
  }
  return runtime;
}

function getInstanceId(discordUserId: string): string {
  return `${INSTANCE_PREFIX}:${discordUserId}`;
}

function resolveGuildId(interaction: ChatInputCommandInteraction | Interaction): string {
  return interaction.guildId ?? 'dm';
}

export async function handleSetupStart(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const instanceId = getInstanceId(interaction.user.id);
  const runtime = getRuntime();
  const existing = await runtime.getState(instanceId);

  if (existing && existing.expiresAt > Date.now()) {
    await interaction.reply({
      content:
        'You already have a character setup in progress. Use `/char setup resume` to continue or `/char setup cancel` to stop.',
      ephemeral: true,
    });
    return;
  }

  if (existing) {
    await runtime.delete(instanceId);
  }

  await runtime.dispatch(
    instanceId,
    {
      type: 'START',
      source: 'command',
      discordUserId: interaction.user.id,
      channelId: interaction.channelId,
      guildId: resolveGuildId(interaction),
    },
    interaction
  );
}

export async function handleSetupResume(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const instanceId = getInstanceId(interaction.user.id);
  const runtime = getRuntime();
  const state = await runtime.getState(instanceId);

  if (!state) {
    await interaction.reply({
      content: 'No active character setup found. Use `/char setup start` to begin.',
      ephemeral: true,
    });
    return;
  }

  if (state.expiresAt <= Date.now()) {
    await runtime.delete(instanceId);
    await interaction.reply({
      content: 'Your previous setup expired. Use `/char setup start` to begin again.',
      ephemeral: true,
    });
    return;
  }

  await runtime.dispatch(
    instanceId,
    {
      type: 'RESUME',
      source: 'command',
    },
    interaction
  );
}

export async function handleSetupCancel(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const instanceId = getInstanceId(interaction.user.id);
  const runtime = getRuntime();
  const state = await runtime.getState(instanceId);

  if (!state) {
    await interaction.reply({
      content: 'No active character setup found.',
      ephemeral: true,
    });
    return;
  }

  await runtime.dispatch(
    instanceId,
    {
      type: 'CANCEL',
      source: 'command',
    },
    interaction
  );
}

export async function handleSetupInteraction(
  interaction: Interaction
): Promise<boolean> {
  if (interaction.isButton()) {
    return handleButton(interaction);
  }
  if (interaction.isModalSubmit()) {
    return handleModal(interaction);
  }
  return false;
}

async function handleButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith(`${CUSTOM_ID_PREFIX}:`)) {
    return false;
  }

  const parts = interaction.customId.split(':');
  const [, userId, action, step] = parts;

  if (userId !== interaction.user.id) {
    await interaction.reply({
      content: 'This setup belongs to another user.',
      ephemeral: true,
    });
    return true;
  }

  const instanceId = getInstanceId(userId);
  const runtime = getRuntime();
  const state = await runtime.getState(instanceId);
  if (!state) {
    await interaction.reply({
      content: 'No active character setup found. Use `/char setup start` to begin.',
      ephemeral: true,
    });
    return true;
  }

  if (action === 'edit') {
    await runtime.dispatch(
      instanceId,
      {
        type: 'EDIT_STEP',
        source: 'button',
        step: step as EditableStep,
      },
      interaction
    );
    return true;
  }

  if (action === 'next') {
    await runtime.dispatch(instanceId, { type: 'NEXT', source: 'button' }, interaction);
    return true;
  }

  if (action === 'back') {
    await runtime.dispatch(instanceId, { type: 'BACK', source: 'button' }, interaction);
    return true;
  }

  if (action === 'cancel') {
    await runtime.dispatch(instanceId, { type: 'CANCEL', source: 'button' }, interaction);
    return true;
  }

  if (action === 'submit') {
    await runtime.dispatch(instanceId, { type: 'SUBMIT', source: 'button' }, interaction);
    return true;
  }

  return false;
}

async function handleModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith(`${CUSTOM_ID_PREFIX}:`)) {
    return false;
  }

  const parts = interaction.customId.split(':');
  const [, userId, mode, step, messageId] = parts;

  if (mode !== 'modal') {
    return false;
  }

  if (userId !== interaction.user.id) {
    await interaction.reply({
      content: 'This setup belongs to another user.',
      ephemeral: true,
    });
    return true;
  }

  const instanceId = getInstanceId(userId);
  const runtime = getRuntime();
  const state = await runtime.getState(instanceId);
  if (!state) {
    await interaction.reply({
      content: 'No active character setup found. Use `/char setup start` to begin.',
      ephemeral: true,
    });
    return true;
  }

  if (step === 'identity') {
    const event: WizardEvent = {
      type: 'SET_IDENTITY',
      source: 'modal',
      name: interaction.fields.getTextInputValue('name'),
      class: interaction.fields.getTextInputValue('class'),
      level: Number(interaction.fields.getTextInputValue('level')),
      messageId,
    };
    await runtime.dispatch(instanceId, event, interaction);
    return true;
  }

  if (step === 'abilities_primary' || step === 'abilities_secondary') {
    const abilities = step === 'abilities_primary' ? ABILITIES.slice(0, 3) : ABILITIES.slice(3, 6);
    const scores: Record<string, number> = {};
    for (const ability of abilities) {
      scores[ability] = Number(interaction.fields.getTextInputValue(ability));
    }
    const event: WizardEvent = {
      type: 'SET_ABILITIES',
      source: 'modal',
      abilitySet: step === 'abilities_primary' ? 'primary' : 'secondary',
      scores,
      messageId,
    };
    await runtime.dispatch(instanceId, event, interaction);
    return true;
  }

  if (step === 'optional') {
    const event: WizardEvent = {
      type: 'SET_OPTIONAL',
      source: 'modal',
      race: interaction.fields.getTextInputValue('race'),
      background: interaction.fields.getTextInputValue('background'),
      messageId,
    };
    await runtime.dispatch(instanceId, event, interaction);
    return true;
  }

  return false;
}
