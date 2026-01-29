/**
 * Effect Runner for Character Setup Wizard
 *
 * Executes wizard effects by interacting with Discord and persistence.
 */

import type { EffectRunner, Effect, CoreEffect } from '@discord-bot/state-machine';
import type { WizardEvent, WizardEffect, WizardContext, WizardState } from './types.js';
import type { CharacterRepo, UserRepo } from '@discord-bot/persistence';
import type { Client, TextChannel, DMChannel } from 'discord.js';
import { applyPatchFromDraft } from './service.js';
import { renderWizardEmbed, renderWizardComponents } from './views.js';

/**
 * Dependencies for the effect runner.
 */
export interface EffectRunnerDeps {
  client: Client;
  userRepo: UserRepo;
  characterRepo: CharacterRepo;
  onCommitResult: (
    instanceId: string,
    result: { success: true; characterId: string } | { success: false; error: string }
  ) => Promise<void>;
  getState: (instanceId: string) => Promise<WizardState | null>;
}

/**
 * Pending timeout handles.
 */
const timeoutHandles = new Map<string, NodeJS.Timeout>();

/**
 * Creates the effect runner for the wizard.
 */
export function createWizardEffectRunner(
  deps: EffectRunnerDeps
): EffectRunner<WizardEvent, WizardContext, WizardEffect> {
  const { client, userRepo, characterRepo, onCommitResult, getState } = deps;

  return {
    async run(
      instanceId: string,
      effects: Effect<WizardEvent, WizardEffect>[],
      ctx: WizardContext
    ): Promise<void> {
      for (const effect of effects) {
        try {
          await runEffect(instanceId, effect, ctx);
        } catch (error) {
          console.error(`Effect ${effect.type} failed:`, error);
        }
      }
    },
  };

  async function runEffect(
    instanceId: string,
    effect: Effect<WizardEvent, WizardEffect>,
    _ctx: WizardContext
  ): Promise<void> {
    switch (effect.type) {
      // Core effects
      case 'Log':
        handleLog(effect);
        break;

      case 'ScheduleTimeout':
        handleScheduleTimeout(instanceId, effect);
        break;

      case 'CancelTimeout':
        handleCancelTimeout(instanceId, effect);
        break;

      case 'PersistNow':
        // Handled by engine
        break;

      case 'EmitEvent':
        // Handled by engine
        break;

      // Custom effects
      case 'RenderWizard':
        await handleRenderWizard(instanceId, effect);
        break;

      case 'ApplyCharacter':
        await handleApplyCharacter(instanceId);
        break;

      case 'Notify':
        // Notifications are handled at interaction level
        break;

      case 'ClearState':
        // Handled by engine via storage.delete
        break;
    }
  }

  function handleLog(effect: CoreEffect & { type: 'Log' }): void {
    const msg = `[WizardMachine] ${effect.message}`;
    switch (effect.level) {
      case 'debug':
        console.debug(msg, effect.data);
        break;
      case 'info':
        console.info(msg, effect.data);
        break;
      case 'warn':
        console.warn(msg, effect.data);
        break;
      case 'error':
        console.error(msg, effect.data);
        break;
    }
  }

  function handleScheduleTimeout(
    instanceId: string,
    effect: CoreEffect<WizardEvent> & { type: 'ScheduleTimeout' }
  ): void {
    const key = `${instanceId}:${effect.timeoutId}`;

    // Clear existing timeout if any
    const existing = timeoutHandles.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    // Schedule new timeout
    const handle = setTimeout(async () => {
      timeoutHandles.delete(key);
      // Dispatch timeout event through the engine
      // This will be handled by the command handler's dispatch mechanism
      console.info(`Wizard timeout triggered for ${instanceId}`);
    }, effect.seconds * 1000);

    timeoutHandles.set(key, handle);
  }

  function handleCancelTimeout(
    instanceId: string,
    effect: CoreEffect & { type: 'CancelTimeout' }
  ): void {
    const key = `${instanceId}:${effect.timeoutId}`;
    const handle = timeoutHandles.get(key);
    if (handle) {
      clearTimeout(handle);
      timeoutHandles.delete(key);
    }
  }

  async function handleRenderWizard(
    instanceId: string,
    effect: WizardEffect & { type: 'RenderWizard' }
  ): Promise<void> {
    const state = await getState(instanceId);
    if (!state) return;

    // Only render for active or done states
    if (
      state.type !== 'Identity' &&
      state.type !== 'Abilities' &&
      state.type !== 'Review' &&
      state.type !== 'Done'
    ) {
      return;
    }

    const embed = renderWizardEmbed(state);
    const components = renderWizardComponents(state, instanceId);

    const channel = await getChannel(state.channelId);
    if (!channel) return;

    if (effect.mode === 'create') {
      // This is handled by the command handler directly
      // since we need to reply to the interaction
    } else if (effect.mode === 'edit' && state.messageId) {
      try {
        const message = await channel.messages.fetch(state.messageId);
        await message.edit({ embeds: [embed], components });
      } catch {
        // Message may have been deleted
      }
    }
  }

  async function getChannel(
    channelId: string
  ): Promise<TextChannel | DMChannel | null> {
    try {
      const channel = await client.channels.fetch(channelId);
      if (channel?.isTextBased() && 'messages' in channel) {
        return channel as TextChannel | DMChannel;
      }
    } catch {
      // Channel not accessible
    }
    return null;
  }

  async function handleApplyCharacter(instanceId: string): Promise<void> {
    const state = await getState(instanceId);
    if (!state || state.type !== 'Committing') return;

    const result = await applyPatchFromDraft(
      state.discordUserId,
      state.guildId,
      state.characterName,
      state.draft,
      userRepo,
      characterRepo
    );

    await onCommitResult(instanceId, result);
  }
}
