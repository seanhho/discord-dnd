/**
 * Character Setup Wizard Command Handler
 *
 * Handles /char setup subcommands and interaction events.
 */

import {
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type Client,
} from 'discord.js';
import {
  createMachine,
  createEngine,
  type Engine,
} from '@discord-bot/state-machine';
import type { CharacterRepo, UserRepo, WizardStateRepo } from '@discord-bot/persistence';
import type { WizardState, WizardEvent, WizardContext, WizardEffect } from './types.js';
import { getInstanceId } from './types.js';
import { wizardCatalog } from './catalog.js';
import { wizardMachineDefinition } from './machine.js';
import { createWizardStorageAdapter } from './storage.js';
import { createWizardEffectRunner } from './effectRunner.js';
import {
  renderWizardEmbed,
  renderWizardComponents,
  parseCustomId,
  createIdentityModal,
  createAbilitiesModal,
  parseAbilitiesInput,
} from './views.js';
import { validateDraft } from './service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Engine Setup
// ─────────────────────────────────────────────────────────────────────────────

let engine: Engine<WizardState, WizardEvent, WizardContext, WizardEffect> | null = null;

/**
 * Dependencies for the wizard handler.
 */
export interface WizardHandlerDeps {
  client: Client;
  userRepo: UserRepo;
  characterRepo: CharacterRepo;
  wizardStateRepo: WizardStateRepo;
}

/**
 * Initialize the wizard engine with dependencies.
 */
export function initWizardHandler(deps: WizardHandlerDeps): void {
  const storage = createWizardStorageAdapter(deps.wizardStateRepo);

  const machine = createMachine(
    wizardMachineDefinition,
    wizardCatalog,
    { autoPersist: false, validateEvents: true }
  );

  // Create a helper to get current state
  const getState = async (instanceId: string): Promise<WizardState | null> => {
    const stored = await storage.load(instanceId);
    return stored?.state ?? null;
  };

  // Handle commit results by dispatching events
  const onCommitResult = async (
    instanceId: string,
    result: { success: true; characterId: string } | { success: false; error: string }
  ): Promise<void> => {
    if (!engine) return;

    if (result.success) {
      await engine.dispatch(instanceId, {
        type: 'COMMIT_SUCCESS',
        characterId: result.characterId,
      });
    } else {
      await engine.dispatch(instanceId, {
        type: 'COMMIT_ERROR',
        error: result.error,
      });
    }
  };

  const effectRunner = createWizardEffectRunner({
    client: deps.client,
    userRepo: deps.userRepo,
    characterRepo: deps.characterRepo,
    onCommitResult,
    getState,
  });

  engine = createEngine(machine, {
    storage,
    effectRunner,
    createContext: (instanceId: string): WizardContext => ({
      instanceId,
      timestamp: new Date().toISOString(),
    }),
  });
}

/**
 * Get the engine, throwing if not initialized.
 */
function getEngine(): Engine<WizardState, WizardEvent, WizardContext, WizardEffect> {
  if (!engine) {
    throw new Error('Wizard handler not initialized. Call initWizardHandler() first.');
  }
  return engine;
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle /char setup start
 */
export async function handleSetupStart(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const discordUserId = interaction.user.id;
  const channelId = interaction.channelId;
  const guildId = interaction.guildId;
  const characterName = interaction.options.getString('name', true).trim();

  const instanceId = getInstanceId(discordUserId);
  const eng = getEngine();

  // Check if there's an existing wizard
  const existingState = await eng.getState(instanceId);
  if (existingState && existingState.type !== 'Idle') {
    // There's an active wizard - ask to resume or restart
    await interaction.reply({
      content: `You have an active character setup wizard in progress. Use \`/char setup resume\` to continue or \`/char setup cancel\` to start over.`,
      ephemeral: true,
    });
    return;
  }

  // Start new wizard
  const result = await eng.dispatch(instanceId, {
    type: 'START',
    discordUserId,
    channelId,
    guildId,
    characterName,
  });

  if (!result.success) {
    await interaction.reply({
      content: `Failed to start wizard: ${result.errors?.join(', ') || 'Unknown error'}`,
      ephemeral: true,
    });
    return;
  }

  // Render the first step
  const state = result.state;
  if (state.type !== 'Identity') {
    await interaction.reply({
      content: 'Unexpected state after starting wizard.',
      ephemeral: true,
    });
    return;
  }

  const embed = renderWizardEmbed(state);
  const components = renderWizardComponents(state, instanceId);

  const reply = await interaction.reply({
    embeds: [embed],
    components,
    ephemeral: true,
    fetchReply: true,
  });

  // Store the message ID for future edits
  await eng.dispatch(instanceId, {
    type: 'SET_MESSAGE_ID',
    messageId: reply.id,
  });
}

/**
 * Handle /char setup resume
 */
export async function handleSetupResume(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const discordUserId = interaction.user.id;
  const instanceId = getInstanceId(discordUserId);
  const eng = getEngine();

  const state = await eng.getState(instanceId);
  if (!state || state.type === 'Idle') {
    await interaction.reply({
      content: 'No active character setup wizard found. Use `/char setup start` to begin.',
      ephemeral: true,
    });
    return;
  }

  // Check if state is in an active step
  if (
    state.type !== 'Identity' &&
    state.type !== 'Abilities' &&
    state.type !== 'Review'
  ) {
    await interaction.reply({
      content: 'Your previous wizard session has ended. Use `/char setup start` to begin a new one.',
      ephemeral: true,
    });
    return;
  }

  // Re-render the current step
  const embed = renderWizardEmbed(state);
  const components = renderWizardComponents(state, instanceId);

  const reply = await interaction.reply({
    embeds: [embed],
    components,
    ephemeral: true,
    fetchReply: true,
  });

  // Update the message ID
  await eng.dispatch(instanceId, {
    type: 'SET_MESSAGE_ID',
    messageId: reply.id,
  });
}

/**
 * Handle /char setup cancel
 */
export async function handleSetupCancel(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const discordUserId = interaction.user.id;
  const instanceId = getInstanceId(discordUserId);
  const eng = getEngine();

  const state = await eng.getState(instanceId);
  if (!state || state.type === 'Idle') {
    await interaction.reply({
      content: 'No active character setup wizard to cancel.',
      ephemeral: true,
    });
    return;
  }

  await eng.dispatch(instanceId, { type: 'CANCEL' });
  await eng.delete(instanceId);

  await interaction.reply({
    content: 'Character setup wizard cancelled.',
    ephemeral: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Button Handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle button interactions for the wizard.
 */
export async function handleWizardButton(
  interaction: ButtonInteraction
): Promise<void> {
  const parsed = parseCustomId(interaction.customId);
  if (!parsed || parsed.type !== 'btn') {
    return;
  }

  const { instanceId, action } = parsed;
  const eng = getEngine();

  // Verify the interaction is from the correct user
  const expectedUserId = instanceId.replace('char-setup:', '');
  if (interaction.user.id !== expectedUserId) {
    await interaction.reply({
      content: 'This wizard belongs to another user.',
      ephemeral: true,
    });
    return;
  }

  const state = await eng.getState(instanceId);
  if (!state || state.type === 'Idle') {
    await interaction.reply({
      content: 'This wizard session has expired. Use `/char setup start` to begin a new one.',
      ephemeral: true,
    });
    return;
  }

  switch (action) {
    case 'edit_identity':
      await handleEditIdentity(interaction, instanceId, state);
      break;

    case 'edit_abilities':
      await handleEditAbilities(interaction, instanceId, state);
      break;

    case 'next':
      await handleNext(interaction, instanceId, state);
      break;

    case 'back':
      await handleBack(interaction, instanceId);
      break;

    case 'confirm':
      await handleConfirm(interaction, instanceId, state);
      break;

    case 'cancel':
      await handleButtonCancel(interaction, instanceId);
      break;

    default:
      await interaction.reply({
        content: 'Unknown action.',
        ephemeral: true,
      });
  }
}

async function handleEditIdentity(
  interaction: ButtonInteraction,
  instanceId: string,
  state: WizardState
): Promise<void> {
  if (state.type !== 'Identity') {
    await interaction.reply({
      content: 'Cannot edit identity in current step.',
      ephemeral: true,
    });
    return;
  }

  const modal = createIdentityModal(instanceId, state.draft);
  await interaction.showModal(modal);
}

async function handleEditAbilities(
  interaction: ButtonInteraction,
  instanceId: string,
  state: WizardState
): Promise<void> {
  if (state.type !== 'Abilities') {
    await interaction.reply({
      content: 'Cannot edit abilities in current step.',
      ephemeral: true,
    });
    return;
  }

  const modal = createAbilitiesModal(instanceId, state.draft.abilities);
  await interaction.showModal(modal);
}

async function handleNext(
  interaction: ButtonInteraction,
  instanceId: string,
  state: WizardState
): Promise<void> {
  const eng = getEngine();

  // Validate before moving to next step
  if (state.type === 'Identity') {
    if (!state.draft.name || !state.draft.class || state.draft.level === undefined) {
      await interaction.reply({
        content: 'Please fill in all required fields (Name, Class, Level) before continuing.',
        ephemeral: true,
      });
      return;
    }

    // Validate level range
    if (state.draft.level < 1 || state.draft.level > 20) {
      await interaction.reply({
        content: 'Level must be between 1 and 20.',
        ephemeral: true,
      });
      return;
    }
  }

  const result = await eng.dispatch(instanceId, { type: 'NEXT' });

  if (!result.success) {
    await interaction.reply({
      content: `Error: ${result.errors?.join(', ') || 'Unknown error'}`,
      ephemeral: true,
    });
    return;
  }

  // Update the message
  const newState = result.state;
  if (
    newState.type === 'Identity' ||
    newState.type === 'Abilities' ||
    newState.type === 'Review'
  ) {
    const embed = renderWizardEmbed(newState);
    const components = renderWizardComponents(newState, instanceId);
    await interaction.update({ embeds: [embed], components });
  }
}

async function handleBack(
  interaction: ButtonInteraction,
  instanceId: string
): Promise<void> {
  const eng = getEngine();
  const result = await eng.dispatch(instanceId, { type: 'BACK' });

  if (!result.success) {
    await interaction.reply({
      content: `Error: ${result.errors?.join(', ') || 'Unknown error'}`,
      ephemeral: true,
    });
    return;
  }

  const newState = result.state;
  if (
    newState.type === 'Identity' ||
    newState.type === 'Abilities' ||
    newState.type === 'Review'
  ) {
    const embed = renderWizardEmbed(newState);
    const components = renderWizardComponents(newState, instanceId);
    await interaction.update({ embeds: [embed], components });
  }
}

async function handleConfirm(
  interaction: ButtonInteraction,
  instanceId: string,
  state: WizardState
): Promise<void> {
  if (state.type !== 'Review') {
    await interaction.reply({
      content: 'Can only confirm from the review step.',
      ephemeral: true,
    });
    return;
  }

  // Final validation
  const validationError = validateDraft(state.draft);
  if (validationError) {
    await interaction.reply({
      content: validationError,
      ephemeral: true,
    });
    return;
  }

  const eng = getEngine();

  // Show loading state
  await interaction.update({
    embeds: [{
      title: 'Creating Character...',
      description: 'Please wait while your character is being created.',
      color: 0xFFFF00,
    }],
    components: [],
  });

  // Dispatch confirm - this triggers ApplyCharacter effect
  await eng.dispatch(instanceId, { type: 'CONFIRM' });

  // The commit result will be handled asynchronously by the effect runner
  // We need to wait a bit for the commit to complete
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Get the final state
  const finalState = await eng.getState(instanceId);
  if (finalState?.type === 'Done') {
    const embed = renderWizardEmbed(finalState);
    await interaction.editReply({ embeds: [embed], components: [] });
  } else if (finalState?.type === 'Error') {
    await interaction.editReply({
      embeds: [{
        title: 'Error',
        description: `Failed to create character: ${finalState.error}`,
        color: 0xFF0000,
      }],
      components: [],
    });
  }
}

async function handleButtonCancel(
  interaction: ButtonInteraction,
  instanceId: string
): Promise<void> {
  const eng = getEngine();
  await eng.dispatch(instanceId, { type: 'CANCEL' });
  await eng.delete(instanceId);

  await interaction.update({
    embeds: [{
      title: 'Cancelled',
      description: 'Character setup wizard cancelled.',
      color: 0xFF0000,
    }],
    components: [],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal Handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle modal submissions for the wizard.
 */
export async function handleWizardModal(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const parsed = parseCustomId(interaction.customId);
  if (!parsed || parsed.type !== 'modal') {
    return;
  }

  const { instanceId, action } = parsed;

  // Verify the interaction is from the correct user
  const expectedUserId = instanceId.replace('char-setup:', '');
  if (interaction.user.id !== expectedUserId) {
    await interaction.reply({
      content: 'This wizard belongs to another user.',
      ephemeral: true,
    });
    return;
  }

  switch (action) {
    case 'identity':
      await handleIdentityModal(interaction, instanceId);
      break;

    case 'abilities':
      await handleAbilitiesModal(interaction, instanceId);
      break;

    default:
      await interaction.reply({
        content: 'Unknown modal.',
        ephemeral: true,
      });
  }
}

async function handleIdentityModal(
  interaction: ModalSubmitInteraction,
  instanceId: string
): Promise<void> {
  const eng = getEngine();

  const name = interaction.fields.getTextInputValue('name').trim();
  const charClass = interaction.fields.getTextInputValue('class').trim();
  const levelStr = interaction.fields.getTextInputValue('level').trim();
  const race = interaction.fields.getTextInputValue('race').trim() || undefined;
  const background = interaction.fields.getTextInputValue('background').trim() || undefined;

  // Validate level
  const level = parseInt(levelStr, 10);
  if (isNaN(level) || level < 1 || level > 20) {
    await interaction.reply({
      content: 'Level must be a number between 1 and 20.',
      ephemeral: true,
    });
    return;
  }

  // Dispatch the update
  const result = await eng.dispatch(instanceId, {
    type: 'SET_IDENTITY',
    name: name || undefined,
    class: charClass || undefined,
    level,
    race,
    background,
  });

  if (!result.success) {
    await interaction.reply({
      content: `Error: ${result.errors?.join(', ') || 'Unknown error'}`,
      ephemeral: true,
    });
    return;
  }

  // Update the message
  const state = result.state;
  if (state.type === 'Identity') {
    const embed = renderWizardEmbed(state);
    const components = renderWizardComponents(state, instanceId);
    await interaction.deferUpdate();
    await interaction.editReply({ embeds: [embed], components });
  }
}

async function handleAbilitiesModal(
  interaction: ModalSubmitInteraction,
  instanceId: string
): Promise<void> {
  const eng = getEngine();

  const abilitiesText = interaction.fields.getTextInputValue('abilities');
  const abilities = parseAbilitiesInput(abilitiesText);

  // Dispatch the update
  const result = await eng.dispatch(instanceId, {
    type: 'SET_ABILITIES',
    abilities,
  });

  if (!result.success) {
    await interaction.reply({
      content: `Error: ${result.errors?.join(', ') || 'Unknown error'}`,
      ephemeral: true,
    });
    return;
  }

  // Update the message
  const state = result.state;
  if (state.type === 'Abilities') {
    const embed = renderWizardEmbed(state);
    const components = renderWizardComponents(state, instanceId);
    await interaction.deferUpdate();
    await interaction.editReply({ embeds: [embed], components });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Interaction Check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if an interaction belongs to the wizard.
 */
export function isWizardInteraction(customId: string): boolean {
  return customId.startsWith('charsetup:');
}
