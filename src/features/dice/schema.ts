import { z } from 'zod';

/**
 * Zod schema for dice roll command options
 * Validates user input from Discord slash command
 */
export const diceRollSchema = z.object({
  sides: z
    .number()
    .int()
    .min(2, 'Die must have at least 2 sides')
    .max(1000, 'Die cannot have more than 1000 sides')
    .default(20),

  count: z
    .number()
    .int()
    .min(1, 'Must roll at least 1 die')
    .max(50, 'Cannot roll more than 50 dice at once')
    .default(1),

  modifier: z
    .number()
    .int()
    .min(-1000, 'Modifier cannot be less than -1000')
    .max(1000, 'Modifier cannot be greater than 1000')
    .default(0),

  label: z
    .string()
    .max(50, 'Label cannot exceed 50 characters')
    .optional(),
});

/**
 * TypeScript type derived from the schema
 */
export type DiceRollInput = z.infer<typeof diceRollSchema>;
