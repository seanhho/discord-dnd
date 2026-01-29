import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  Interaction,
} from 'discord.js';

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Command handler function signature
 */
export type CommandHandler = (
  interaction: ChatInputCommandInteraction
) => Promise<void>;

/**
 * Interaction handler for non-command interactions (buttons, modals, selects).
 * Returns true if the interaction was handled.
 */
export type InteractionHandler = (interaction: Interaction) => Promise<boolean>;

/**
 * Feature slice definition
 * Each feature must export this shape from its index.ts
 */
export interface FeatureSlice {
  /**
   * Unique command name (must match slash command name)
   */
  name: string;

  /**
   * Discord slash command builder
   */
  command:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;

  /**
   * Handler function for this command
   */
  handler: CommandHandler;

  /**
   * Optional handler for component and modal interactions.
   */
  interactionHandler?: InteractionHandler;
}

/**
 * Feature registry that holds all registered feature slices
 */
export interface FeatureRegistry {
  /**
   * Register a feature slice
   */
  register(feature: FeatureSlice): void;

  /**
   * Get all registered features
   */
  getAll(): FeatureSlice[];

  /**
   * Get a feature by command name
   */
  getByName(name: string): FeatureSlice | undefined;
}
