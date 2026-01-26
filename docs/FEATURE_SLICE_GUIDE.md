# Feature Slice Quick Reference

## Feature Slice Structure

Every feature must follow this exact structure:

```
src/features/<featureName>/
├── index.ts           # FeatureSlice export (REQUIRED)
├── types.ts           # Domain types (REQUIRED)
├── schema.ts          # Zod validation (REQUIRED)
├── service.ts         # Pure logic (REQUIRED, NO discord.js)
├── command.ts         # Discord handler (REQUIRED)
└── __tests__/         # Tests (REQUIRED)
    └── service.test.ts
```

## File Templates

### `types.ts`

```typescript
/**
 * Input parameters for <feature>
 */
export interface MyFeatureParams {
  // Define your input parameters
}

/**
 * Result of <feature> operation
 */
export interface MyFeatureResult {
  // Define your output structure
}
```

### `schema.ts`

```typescript
import { z } from 'zod';

export const myFeatureSchema = z.object({
  requiredField: z.string().min(1),
  optionalField: z.number().optional(),
  // Add validation rules
});

export type MyFeatureInput = z.infer<typeof myFeatureSchema>;
```

### `service.ts`

```typescript
import type { MyFeatureParams, MyFeatureResult } from './types.js';

// NO discord.js imports allowed!

/**
 * Core business logic for <feature>
 * Pure function with no side effects
 */
export function executeFeature(params: MyFeatureParams): MyFeatureResult {
  // Implement pure domain logic
  return {
    // Return result
  };
}
```

### `command.ts`

```typescript
import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { myFeatureSchema } from './schema.js';
import { executeFeature } from './service.js';
import type { MyFeatureParams } from './types.js';

export const myCommand = new SlashCommandBuilder()
  .setName('mycommand')
  .setDescription('Description of what this command does')
  .addStringOption((option) =>
    option
      .setName('param1')
      .setDescription('Description')
      .setRequired(true)
  );

export async function handleMyCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  // 1. Extract options
  const rawInput = {
    param1: interaction.options.getString('param1'),
  };

  // 2. Validate
  const parseResult = myFeatureSchema.safeParse(rawInput);
  if (!parseResult.success) {
    await interaction.reply({
      content: 'Invalid input: ' + parseResult.error.message,
      ephemeral: true,
    });
    return;
  }

  // 3. Build params
  const params: MyFeatureParams = {
    // Map validated input to params
  };

  // 4. Execute service
  const result = executeFeature(params);

  // 5. Reply
  await interaction.reply(`Result: ${result}`);
}
```

### `index.ts`

```typescript
import type { FeatureSlice } from '../../core/types.js';
import { myCommand, handleMyCommand } from './command.js';

export const myFeature: FeatureSlice = {
  name: 'mycommand', // Must match command name
  command: myCommand,
  handler: handleMyCommand,
};
```

### `__tests__/service.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { executeFeature } from '../service.js';
import type { MyFeatureParams } from '../types.js';

describe('executeFeature', () => {
  it('should handle basic case', () => {
    const params: MyFeatureParams = {
      // Test input
    };

    const result = executeFeature(params);

    expect(result).toEqual({
      // Expected output
    });
  });

  it('should handle edge cases', () => {
    // More test cases
  });
});
```

## Registration Steps

1. **Create feature files** following the structure above
2. **Import in `src/app.ts`**:
   ```typescript
   import { myFeature } from './features/myFeature/index.js';
   ```
3. **Register in `createApp()` function**:
   ```typescript
   registry.register(myFeature);
   ```
4. **Test**:
   ```bash
   npm test
   npm run typecheck
   npm run lint
   ```

## Common Patterns

### Optional Parameters

```typescript
// schema.ts
export const schema = z.object({
  required: z.string(),
  optional: z.string().optional(),
  withDefault: z.number().default(10),
});

// command.ts
const rawInput = {
  required: interaction.options.getString('required', true),
  optional: interaction.options.getString('optional') ?? undefined,
  withDefault: interaction.options.getInteger('withDefault') ?? undefined,
};
```

### Dependency Injection (for testing)

```typescript
// types.ts
export type DataFetcher = (id: string) => Promise<Data>;

// service.ts
export async function myLogic(
  id: string,
  fetcher: DataFetcher = defaultFetcher
): Promise<Result> {
  const data = await fetcher(id);
  // Process data
}

// __tests__/service.test.ts
it('should fetch and process data', async () => {
  const mockFetcher: DataFetcher = async (id) => ({ id, value: 'mock' });
  const result = await myLogic('123', mockFetcher);
  expect(result).toEqual(/* expected */);
});
```

### Error Handling

```typescript
// service.ts
export function myLogic(params: Params): Result | null {
  if (invalidCondition) {
    return null; // Return null for recoverable errors
  }
  // Process
  return result;
}

// command.ts
const result = myLogic(params);
if (!result) {
  await interaction.reply({
    content: 'Could not process your request.',
    ephemeral: true,
  });
  return;
}
await interaction.reply(`Success: ${result}`);
```

## Rules to Remember

1. ✅ **DO**: Keep `service.ts` pure and testable
2. ✅ **DO**: Validate all inputs with Zod
3. ✅ **DO**: Write tests for service logic
4. ✅ **DO**: Use dependency injection for external dependencies
5. ❌ **DON'T**: Import discord.js in `service.ts`
6. ❌ **DON'T**: Import from other features directly
7. ❌ **DON'T**: Put business logic in `command.ts`
8. ❌ **DON'T**: Skip validation

## Checklist

Before committing a new feature:

- [ ] All required files created
- [ ] `service.ts` has NO discord.js imports
- [ ] Zod schema validates all inputs
- [ ] Unit tests written and passing
- [ ] Feature registered in `src/app.ts`
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] Tested in Discord (guild or global)
