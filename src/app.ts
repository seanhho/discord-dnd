import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { createLogger } from '@discord-bot/logger';
import {
  SqliteClient,
  SqliteUserRepo,
  SqliteCharacterRepo,
  SqliteWizardStateRepo,
} from '@discord-bot/persistence';
import { createFeatureRegistry } from './core/featureRegistry.js';
import { createCommandRouter } from './core/commandRouter.js';
import { env } from './core/env.js';

// Import all feature slices
import { diceFeature } from './features/dice/index.js';
import {
  charFeature,
  initCharFeature,
  initCharWizard,
  handleWizardButton,
  handleWizardModal,
  isWizardInteraction,
} from './features/char/index.js';

/**
 * Application context holding all wired dependencies
 */
export interface AppContext {
  client: Client;
  logger: ReturnType<typeof createLogger>;
  registry: ReturnType<typeof createFeatureRegistry>;
  dbClient: SqliteClient;
}

/**
 * Create and configure the Discord bot application
 *
 * This function:
 * 1. Creates the Discord client
 * 2. Initializes the logger
 * 3. Creates the feature registry
 * 4. Registers all feature slices
 * 5. Sets up the command router
 * 6. Registers slash commands with Discord
 */
export async function createApp(): Promise<AppContext> {
  // Create logger
  const logger = createLogger({
    level: env.LOG_LEVEL,
    prefix: 'bot',
  });

  logger.info('Initializing Discord bot');

  // Initialize persistence layer
  logger.info('Initializing database');
  const dbClient = await SqliteClient.create({
    dbPath: env.DB_PATH,
  });

  // Create repository instances
  const userRepo = new SqliteUserRepo(dbClient.kysely);
  const characterRepo = new SqliteCharacterRepo(dbClient.kysely);
  const wizardStateRepo = new SqliteWizardStateRepo(dbClient.kysely);

  // Create Discord client with required intents
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      // Add more intents as needed for future features
    ],
  });

  // Create feature registry
  const registry = createFeatureRegistry();

  // Initialize character feature with dependencies
  initCharFeature({ userRepo, characterRepo });

  // Initialize character wizard (must be called after client is created)
  initCharWizard({
    client,
    userRepo,
    characterRepo,
    wizardStateRepo,
  });

  // Register all feature slices
  logger.info('Registering feature slices');
  registry.register(diceFeature);
  registry.register(charFeature);

  logger.info(`Registered ${registry.getAll().length} feature(s)`);

  // Create command router
  const router = createCommandRouter({ registry, logger });

  // Set up interaction handler
  client.on('interactionCreate', async (interaction) => {
    // Handle button interactions for wizard
    if (interaction.isButton() && isWizardInteraction(interaction.customId)) {
      try {
        await handleWizardButton(interaction);
      } catch (error) {
        logger.error('Wizard button error', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'An error occurred while processing your request.',
            ephemeral: true,
          });
        }
      }
      return;
    }

    // Handle modal submissions for wizard
    if (interaction.isModalSubmit() && isWizardInteraction(interaction.customId)) {
      try {
        await handleWizardModal(interaction);
      } catch (error) {
        logger.error('Wizard modal error', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'An error occurred while processing your request.',
            ephemeral: true,
          });
        }
      }
      return;
    }

    // Handle slash commands
    await router(interaction);
  });

  // Set up ready event
  client.once('ready', () => {
    logger.info(`Logged in as ${client.user?.tag}`);
  });

  // Register slash commands with Discord
  await registerCommands(logger, registry);

  return {
    client,
    logger,
    registry,
    dbClient,
  };
}

/**
 * Register slash commands with Discord API
 *
 * Commands can be registered globally or per-guild:
 * - Global: Takes up to 1 hour to propagate, works everywhere
 * - Guild: Instant registration, only works in that specific guild
 *
 * For development, use DISCORD_GUILD_ID to register commands per-guild.
 * For production, leave DISCORD_GUILD_ID empty to register globally.
 */
async function registerCommands(
  logger: ReturnType<typeof createLogger>,
  registry: ReturnType<typeof createFeatureRegistry>
): Promise<void> {
  const commands = registry
    .getAll()
    .map((feature) => feature.command.toJSON());

  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

  try {
    if (env.DISCORD_GUILD_ID) {
      // Register commands for a specific guild (instant, for development)
      logger.info(
        `Registering ${commands.length} command(s) to guild ${env.DISCORD_GUILD_ID}`
      );

      await rest.put(
        Routes.applicationGuildCommands(env.DISCORD_APP_ID, env.DISCORD_GUILD_ID),
        { body: commands }
      );

      logger.info('Guild commands registered successfully');
    } else {
      // Register commands globally (takes up to 1 hour, for production)
      logger.info(
        `Registering ${commands.length} command(s) globally (may take up to 1 hour)`
      );

      await rest.put(Routes.applicationCommands(env.DISCORD_APP_ID), {
        body: commands,
      });

      logger.info('Global commands registered successfully');
    }
  } catch (error) {
    logger.error('Failed to register commands', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
