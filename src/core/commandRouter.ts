import type { Interaction } from 'discord.js';
import type { Logger } from '@discord-bot/logger';
import type { FeatureRegistry } from './types.js';

/**
 * Command router configuration
 */
export interface CommandRouterConfig {
  registry: FeatureRegistry;
  logger: Logger;
}

/**
 * Create a command router that dispatches Discord interactions to feature handlers
 *
 * This is the central routing layer that:
 * 1. Receives all Discord interactions
 * 2. Filters for slash commands
 * 3. Looks up the appropriate feature handler
 * 4. Executes the handler with error handling
 */
export function createCommandRouter(config: CommandRouterConfig) {
  const { registry, logger } = config;

  return async function routeCommand(interaction: Interaction): Promise<void> {
    // Only handle chat input commands (slash commands)
    if (!interaction.isChatInputCommand()) {
      const handlers = registry
        .getAll()
        .map((feature) => feature.interactionHandler)
        .filter((handler): handler is NonNullable<typeof handler> => Boolean(handler));

      if (handlers.length === 0) {
        return;
      }

      for (const handler of handlers) {
        try {
          const handled = await handler(interaction);
          if (handled) {
            return;
          }
        } catch (error) {
          logger.error('Error handling interaction', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          return;
        }
      }

      return;
    }

    const commandName = interaction.commandName;
    const feature = registry.getByName(commandName);

    if (!feature) {
      logger.warn(`No handler found for command: ${commandName}`);

      // Inform the user that the command is not recognized
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'This command is not recognized.',
          ephemeral: true,
        });
      }
      return;
    }

    logger.debug(`Routing command to handler`, {
      command: commandName,
      user: interaction.user.tag,
      guild: interaction.guild?.name ?? 'DM',
    });

    try {
      await feature.handler(interaction);
    } catch (error) {
      logger.error(`Error executing command: ${commandName}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Attempt to inform the user of the error
      const errorMessage = 'An error occurred while executing this command.';

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: errorMessage,
            ephemeral: true,
          });
        } else {
          await interaction.followUp({
            content: errorMessage,
            ephemeral: true,
          });
        }
      } catch (replyError) {
        // If we can't send an error message, just log it
        logger.error('Failed to send error message to user', {
          error: replyError instanceof Error ? replyError.message : String(replyError),
        });
      }
    }
  };
}
