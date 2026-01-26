import { createApp } from './app.js';
import { env } from './core/env.js';

/**
 * Main entry point for the Discord bot
 *
 * This file:
 * 1. Creates the application context
 * 2. Logs in to Discord
 * 3. Handles graceful shutdown
 */
async function main(): Promise<void> {
  try {
    // Create and configure the app
    const { client, logger } = await createApp();

    // Login to Discord
    logger.info('Logging in to Discord...');
    await client.login(env.DISCORD_TOKEN);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      client.destroy();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      client.destroy();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Run the bot
main();
