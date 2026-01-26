import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { diceRollSchema } from './schema.js';
import { rollDice, formatRollResult } from './service.js';
import type { DiceRollParams } from './types.js';

/**
 * Slash command definition for /roll
 */
export const rollCommand = new SlashCommandBuilder()
  .setName('roll')
  .setDescription('Roll dice with customizable options')
  .addIntegerOption((option) =>
    option
      .setName('sides')
      .setDescription('Number of sides on the die (default: 20)')
      .setMinValue(2)
      .setMaxValue(1000)
      .setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName('count')
      .setDescription('Number of dice to roll (default: 1)')
      .setMinValue(1)
      .setMaxValue(50)
      .setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName('modifier')
      .setDescription('Modifier to add to the roll (default: 0)')
      .setMinValue(-1000)
      .setMaxValue(1000)
      .setRequired(false)
  )
  .addStringOption((option) =>
    option
      .setName('label')
      .setDescription('Optional label for the roll (e.g., "Attack Roll")')
      .setMaxLength(50)
      .setRequired(false)
  );

/**
 * Handler for the /roll command
 *
 * Extracts options from the Discord interaction, validates them,
 * executes the dice roll, and sends the result back to the user.
 */
export async function handleRollCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  // Extract options from the interaction
  const rawInput = {
    sides: interaction.options.getInteger('sides') ?? undefined,
    count: interaction.options.getInteger('count') ?? undefined,
    modifier: interaction.options.getInteger('modifier') ?? undefined,
    label: interaction.options.getString('label') ?? undefined,
  };

  // Validate and parse input with zod schema
  const parseResult = diceRollSchema.safeParse(rawInput);

  if (!parseResult.success) {
    // Send validation errors back to the user
    const errors = parseResult.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join('\n');

    await interaction.reply({
      content: `Invalid input:\n${errors}`,
      ephemeral: true,
    });
    return;
  }

  const validatedInput = parseResult.data;

  // Build dice roll parameters
  const params: DiceRollParams = {
    sides: validatedInput.sides,
    count: validatedInput.count,
    modifier: validatedInput.modifier,
    label: validatedInput.label,
  };

  // Execute the dice roll (pure domain logic)
  const result = rollDice(params);

  // Format the result for display
  const formattedResult = formatRollResult(params, result);

  // Send the result back to Discord
  await interaction.reply(formattedResult);
}
