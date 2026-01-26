import { env as configEnv } from '@discord-bot/config';

/**
 * Re-export validated environment configuration for use in the main app
 * This provides a single source of truth for environment variables
 */
export const env = configEnv;
