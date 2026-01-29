import {
  type EffectRunner,
  type Effect,
} from '@discord-bot/state-machine';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Interaction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
  type TextBasedChannel,
} from 'discord.js';
import type { Client } from 'discord.js';
import type { CharacterRepo, UserRepo, WizardStateRepo } from '../repo/ports.js';
import type {
  WizardContext,
  WizardEvent,
  WizardEffect,
  WizardModal,
  WizardView,
  RenderTarget,
} from './types.js';
import { applyWizardPatch } from './apply.js';

const CUSTOM_ID_PREFIX = 'charsetup';

interface EffectRunnerDeps {
  client: Client;
  userRepo: UserRepo;
  characterRepo: CharacterRepo;
  wizardStateRepo: WizardStateRepo;
}

type EngineDispatch = (instanceId: string, event: WizardEvent) => Promise<void>;

export class WizardEffectRunner
  implements EffectRunner<WizardEvent, WizardContext, WizardEffect>
{
  private readonly timeouts = new Map<string, NodeJS.Timeout>();
  private engineDispatch: EngineDispatch | null = null;

  constructor(private readonly deps: EffectRunnerDeps) {}

  setEngineDispatch(dispatch: EngineDispatch): void {
    this.engineDispatch = dispatch;
  }

  async run(
    instanceId: string,
    effects: Effect<WizardEvent, WizardEffect>[],
    ctx: WizardContext
  ): Promise<void> {
    const interaction = ctx.interaction as Interaction | undefined;
    const isModal = interaction?.isModalSubmit() ?? false;

    if (isModal && interaction && !interaction.replied && !interaction.deferred) {
      await (interaction as ModalSubmitInteraction).deferReply({ ephemeral: true });
    }

    for (const effect of effects) {
      if (effect.type === 'ScheduleTimeout') {
        this.scheduleTimeout(instanceId, effect.timeoutId, effect.seconds, effect.event);
        continue;
      }

      if (effect.type === 'CancelTimeout') {
        this.clearTimeout(instanceId, effect.timeoutId);
        continue;
      }

      if (effect.type === 'RenderStep') {
        await this.renderStep(effect, interaction);
        continue;
      }

      if (effect.type === 'ShowModal') {
        await this.showModal(effect.modal, interaction);
        continue;
      }

      if (effect.type === 'Notify') {
        await this.notify(effect.message, effect.level, effect.target, interaction);
        continue;
      }

      if (effect.type === 'ApplyCharacterPatch') {
        await this.applyPatch(effect, instanceId);
        continue;
      }

      if (effect.type === 'ClearState') {
        await this.deps.wizardStateRepo.deleteWizardState(effect.instanceId);
        continue;
      }
    }

    if (isModal && interaction && interaction.deferred && !interaction.replied) {
      await (interaction as ModalSubmitInteraction).editReply({
        content: 'Updated character setup.',
      });
    }
  }

  private scheduleTimeout(
    instanceId: string,
    timeoutId: string,
    seconds: number,
    event: WizardEvent
  ): void {
    this.clearTimeout(instanceId, timeoutId);
    if (!this.engineDispatch) {
      return;
    }
    const key = `${instanceId}:${timeoutId}`;
    const handle = setTimeout(() => {
      void this.engineDispatch?.(instanceId, event);
    }, seconds * 1000);
    this.timeouts.set(key, handle);
  }

  private clearTimeout(instanceId: string, timeoutId: string): void {
    const key = `${instanceId}:${timeoutId}`;
    const handle = this.timeouts.get(key);
    if (handle) {
      clearTimeout(handle);
      this.timeouts.delete(key);
    }
  }

  private async renderStep(
    effect: Extract<WizardEffect, { type: 'RenderStep' }>,
    interaction?: Interaction
  ): Promise<void> {
    const embed = buildEmbed(effect.view);
    const components = buildComponents(effect.view, effect.discordUserId);

    if (effect.target.mode === 'reply') {
      await replyWith(interaction, { embeds: [embed], components });
      return;
    }

    if (effect.target.mode === 'update' && interaction?.isButton()) {
      await (interaction as ButtonInteraction).update({ embeds: [embed], components });
      return;
    }

    if (effect.target.mode === 'edit') {
      const channel = await this.fetchChannel(effect.target.channelId);
      if (channel && channel.isTextBased()) {
        const message = await channel.messages.fetch(effect.target.messageId);
        await message.edit({ embeds: [embed], components });
      }
      return;
    }

    if (effect.target.mode === 'channel') {
      const channel = await this.fetchChannel(effect.target.channelId);
      if (channel && channel.isTextBased()) {
        await channel.send({ embeds: [embed], components });
      }
    }
  }

  private async showModal(modal: WizardModal, interaction?: Interaction): Promise<void> {
    if (!interaction || !interaction.isButton()) {
      return;
    }

    const modalBuilder = new ModalBuilder()
      .setTitle(modal.title)
      .setCustomId(
        `${CUSTOM_ID_PREFIX}:${interaction.user.id}:modal:${modal.step}:${interaction.message.id}`
      );

    const rows = modal.fields.map((field) => {
      const input = new TextInputBuilder()
        .setCustomId(field.id)
        .setLabel(field.label)
        .setStyle(TextInputStyle.Short)
        .setRequired(field.required ?? false);

      if (field.value) {
        input.setValue(field.value);
      }
      if (field.placeholder) {
        input.setPlaceholder(field.placeholder);
      }

      return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    });

    modalBuilder.addComponents(...rows);
    await interaction.showModal(modalBuilder);
  }

  private async notify(
    message: string,
    level: 'info' | 'error' | 'success',
    target: RenderTarget,
    interaction?: Interaction
  ): Promise<void> {
    const content = `${levelEmoji(level)} ${message}`;
    if (target.mode === 'reply') {
      await replyWith(interaction, { content, ephemeral: true });
      return;
    }

    if (target.mode === 'update') {
      if (interaction?.isButton()) {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content, ephemeral: true });
        } else {
          await interaction.reply({ content, ephemeral: true });
        }
      }
      return;
    }

    if (target.mode === 'edit') {
      if (interaction?.isModalSubmit()) {
        await interaction.editReply({ content });
      }
      return;
    }

    if (target.mode === 'channel') {
      const channel = await this.fetchChannel(target.channelId);
      if (channel && channel.isTextBased()) {
        await channel.send({ content });
      }
    }
  }

  private async applyPatch(
    effect: Extract<WizardEffect, { type: 'ApplyCharacterPatch' }>,
    instanceId: string
  ): Promise<void> {
    const { payload } = effect;
    const result = await applyWizardPatch({
      discordUserId: payload.discordUserId,
      guildId: payload.guildId,
      draft: payload.draft,
      userRepo: this.deps.userRepo,
      characterRepo: this.deps.characterRepo,
    });

    if (!this.engineDispatch) {
      return;
    }

    const nextEvent: WizardEvent = result.success
      ? {
          type: 'APPLY_SUCCESS',
          source: 'system',
          summary: {
            characterName: result.characterName,
            appliedKeys: result.appliedKeys,
          },
        }
      : {
          type: 'APPLY_FAILED',
          source: 'system',
          error: result.error,
        };

    setTimeout(() => {
      void this.engineDispatch?.(instanceId, nextEvent);
    }, 0);
  }

  private async fetchChannel(channelId: string): Promise<TextBasedChannel | null> {
    const channel = await this.deps.client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      return null;
    }
    return channel;
  }
}

function buildEmbed(view: WizardView): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(view.title)
    .setDescription(`${view.progress}\n${view.description}`);

  if (view.fields.length > 0) {
    embed.addFields(
      view.fields.map((field) => ({
        name: field.name,
        value: field.value,
        inline: field.inline,
      }))
    );
  }

  if (view.errors && view.errors.length > 0) {
    embed.addFields({
      name: 'Errors',
      value: view.errors.map((error) => `• ${error}`).join('\n'),
    });
  }

  if (view.footer) {
    embed.setFooter({ text: view.footer });
  }

  return embed;
}

function buildComponents(
  view: WizardView,
  discordUserId: string
): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>();

  if (
    view.step === 'identity' ||
    view.step === 'abilities_primary' ||
    view.step === 'abilities_secondary' ||
    view.step === 'optional' ||
    view.step === 'review'
  ) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `${CUSTOM_ID_PREFIX}:${discordUserId}:edit:${view.step}`
        )
        .setLabel('Edit')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  if (
    view.step === 'abilities_primary' ||
    view.step === 'abilities_secondary' ||
    view.step === 'optional' ||
    view.step === 'review'
  ) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}:${discordUserId}:back:${view.step}`)
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  if (
    view.step === 'identity' ||
    view.step === 'abilities_primary' ||
    view.step === 'abilities_secondary' ||
    view.step === 'optional'
  ) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}:${discordUserId}:next:${view.step}`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
    );
  }

  if (view.step === 'review') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}:${discordUserId}:submit:${view.step}`)
        .setLabel('Confirm & Save')
        .setStyle(ButtonStyle.Success)
    );
  }

  if (view.step !== 'committing') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}:${discordUserId}:cancel:${view.step}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
    );
  }

  return row.components.length > 0 ? [row] : [];
}

async function replyWith(
  interaction: Interaction | undefined,
  payload: { content?: string; embeds?: EmbedBuilder[]; components?: ActionRowBuilder<ButtonBuilder>[]; ephemeral?: boolean }
): Promise<void> {
  if (!interaction || !interaction.isChatInputCommand()) {
    return;
  }
  const commandInteraction = interaction as ChatInputCommandInteraction;
  if (commandInteraction.replied || commandInteraction.deferred) {
    await commandInteraction.followUp({ ...payload, ephemeral: payload.ephemeral ?? false });
    return;
  }
  await commandInteraction.reply({ ...payload, ephemeral: payload.ephemeral ?? false });
}

function levelEmoji(level: 'info' | 'error' | 'success'): string {
  switch (level) {
    case 'success':
      return '✅';
    case 'error':
      return '⚠️';
    default:
      return 'ℹ️';
  }
}
