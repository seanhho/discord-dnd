# Discord Bot - Feature Slice Architecture

A production-ready Discord bot built with TypeScript and Feature Slice architecture, designed for long-term scalability and maintainability.

## Architecture Overview

This project uses **Feature Slice** architecture to organize code by domain capabilities rather than technical layers. Each feature is self-contained, testable, and follows strict dependency rules.

### Key Principles

1. **Feature Isolation**: Each feature slice is independent and cannot directly import from other features
2. **Core Coordination**: The `src/core` layer manages feature registration and routing
3. **Clean Boundaries**: Business logic (services) is separated from Discord.js adapters (commands)
4. **Testability**: Pure domain logic can be tested without Discord.js mocks

## Directory Structure

```
discord-bot/
├── src/
│   ├── main.ts                 # Application entry point
│   ├── app.ts                  # Application wiring and setup
│   ├── core/                   # Core infrastructure
│   │   ├── types.ts           # Shared type definitions
│   │   ├── env.ts             # Environment configuration
│   │   ├── featureRegistry.ts # Feature registration
│   │   └── commandRouter.ts   # Command routing logic
│   └── features/              # Feature slices
│       └── dice/              # Dice rolling feature
│           ├── index.ts       # Public exports (FeatureSlice)
│           ├── types.ts       # Feature-specific types
│           ├── schema.ts      # Zod validation schemas
│           ├── service.ts     # Pure domain logic (NO discord.js)
│           ├── command.ts     # Discord command definition + handler
│           └── __tests__/     # Unit tests
│               └── service.test.ts
├── packages/                  # Internal shared packages
│   ├── config/               # Environment validation
│   ├── logger/               # Structured logging
│   └── tsconfig/             # Shared TypeScript config
├── package.json              # Root package with workspace config
├── tsconfig.json             # Root TypeScript config
├── .env.example              # Environment variable template
└── README.md                 # This file
```

## Feature Slice Pattern

### What is a Feature Slice?

A feature slice is a self-contained module that implements a single Discord bot capability (like dice rolling, weather lookup, or moderation). Each slice follows a strict structure:

```
src/features/<featureName>/
├── index.ts        # Exports the FeatureSlice (name, command, handler)
├── types.ts        # TypeScript types for this feature
├── schema.ts       # Zod schemas for input validation
├── service.ts      # Pure domain logic (NO discord.js imports)
├── command.ts      # Discord slash command + handler
└── __tests__/      # Tests for service.ts
    └── service.test.ts
```

### Feature Slice Rules

**MANDATORY:**

1. **No cross-feature imports**: Features cannot import from other features
2. **Pure services**: `service.ts` must NOT import discord.js (for testability)
3. **Single export**: `index.ts` exports a single `FeatureSlice` object
4. **Dependency injection**: Services accept dependencies (like RNG) as parameters
5. **Validation**: Use Zod schemas to validate all user inputs

### Feature Slice Example: Dice

The dice feature demonstrates the pattern:

- **types.ts**: Defines `DiceRollParams`, `DiceRollResult`, `RandomNumberGenerator`
- **schema.ts**: Zod schema validating sides (2-1000), count (1-50), modifier (-1000 to 1000)
- **service.ts**: Pure functions `rollDice()` and `formatRollResult()` with no Discord coupling
- **command.ts**: Discord slash command builder and `handleRollCommand()` adapter
- **index.ts**: Exports `diceFeature: FeatureSlice`

## Core Responsibilities

### `src/core/types.ts`

Defines shared types:
- `FeatureSlice`: The contract every feature must implement
- `FeatureRegistry`: Interface for registering features
- `CommandHandler`: Type for Discord command handlers

### `src/core/featureRegistry.ts`

Central registry that:
- Stores all registered features in a Map
- Prevents duplicate feature names
- Provides lookup by command name

### `src/core/commandRouter.ts`

Routing layer that:
- Receives all Discord interactions
- Filters for slash commands
- Looks up the handler from the registry
- Executes handlers with error handling
- Reports errors back to users

### `src/core/env.ts`

Re-exports validated environment configuration from `@discord-bot/config`.

## Command Flow

```
Discord User
    ↓
    types "/roll sides:20 count:2"
    ↓
Discord API
    ↓
    sends Interaction event
    ↓
main.ts → app.ts → commandRouter
    ↓
    looks up "roll" in registry
    ↓
features/dice/command.ts (handleRollCommand)
    ↓
    validates input with schema.ts
    ↓
    calls service.ts (rollDice)
    ↓
    formats result
    ↓
    replies to Discord
```

## Command Registration

Commands can be registered in two ways:

### Guild Commands (Development)

- **Speed**: Instant registration
- **Scope**: Only works in the specified guild
- **Usage**: Set `DISCORD_GUILD_ID` in `.env`

```bash
DISCORD_GUILD_ID=123456789012345678
```

### Global Commands (Production)

- **Speed**: Up to 1 hour propagation time
- **Scope**: Works in all guilds where the bot is installed
- **Usage**: Leave `DISCORD_GUILD_ID` empty in `.env`

The bot automatically chooses the registration strategy based on whether `DISCORD_GUILD_ID` is set.

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- A Discord bot token (from [Discord Developer Portal](https://discord.com/developers/applications))

### Installation

```bash
# Install dependencies for all workspaces
npm install
```

### Configuration

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and fill in your values:
# - DISCORD_TOKEN: Your bot token
# - DISCORD_APP_ID: Your application ID
# - DISCORD_GUILD_ID: (optional) Guild ID for dev testing
```

### Development

```bash
# Run in watch mode (auto-restart on changes)
npm run dev
```

### Building

```bash
# Compile TypeScript to JavaScript
npm run build
```

### Running in Production

```bash
# Build first
npm run build

# Start the compiled bot
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Linting & Formatting

```bash
# Check for lint errors
npm run lint

# Auto-fix lint errors
npm run lint:fix

# Check formatting
npm run format:check

# Auto-format code
npm run format
```

## Adding a New Feature Slice

Follow these steps to add a new command/feature:

### 1. Create the Feature Directory

```bash
mkdir -p src/features/<featureName>/__tests__
```

### 2. Create Required Files

Create these files in order:

#### `types.ts` - Define domain types
```typescript
export interface MyFeatureParams {
  // Input parameters
}

export interface MyFeatureResult {
  // Output result
}
```

#### `schema.ts` - Define Zod validation
```typescript
import { z } from 'zod';

export const myFeatureSchema = z.object({
  // Validation rules
});

export type MyFeatureInput = z.infer<typeof myFeatureSchema>;
```

#### `service.ts` - Pure domain logic
```typescript
// NO discord.js imports allowed!
export function myFeatureLogic(params: MyFeatureParams): MyFeatureResult {
  // Pure business logic
}
```

#### `command.ts` - Discord command + handler
```typescript
import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';

export const myCommand = new SlashCommandBuilder()
  .setName('mycommand')
  .setDescription('...');

export async function handleMyCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  // Extract options
  // Validate with schema
  // Call service
  // Reply to user
}
```

#### `index.ts` - Export the feature slice
```typescript
import type { FeatureSlice } from '../../core/types.js';
import { myCommand, handleMyCommand } from './command.js';

export const myFeature: FeatureSlice = {
  name: 'mycommand',
  command: myCommand,
  handler: handleMyCommand,
};
```

#### `__tests__/service.test.ts` - Unit tests
```typescript
import { describe, it, expect } from 'vitest';
import { myFeatureLogic } from '../service.js';

describe('myFeatureLogic', () => {
  it('should ...', () => {
    // Test your pure logic
  });
});
```

### 3. Register the Feature

In `src/app.ts`, import and register your feature:

```typescript
import { myFeature } from './features/myFeature/index.js';

// In createApp():
registry.register(myFeature);
```

### 4. Test and Deploy

```bash
# Run tests
npm test

# Build
npm run build

# Start bot
npm run dev
```

Your new command should now be available in Discord!

## Feature Checklist

When adding a new feature, ensure:

- [ ] Feature directory created: `src/features/<name>/`
- [ ] All required files present: `index.ts`, `types.ts`, `schema.ts`, `service.ts`, `command.ts`
- [ ] Service has NO discord.js imports
- [ ] Input validated with Zod schema
- [ ] Unit tests written for service logic
- [ ] Feature registered in `src/app.ts`
- [ ] Tests pass: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] Type-checking passes: `npm run typecheck`

## Testing Strategy

### Unit Tests (Vitest)

- **Target**: Pure business logic in `service.ts` files
- **Why**: Fast, deterministic, no mocks needed
- **How**: Inject dependencies (RNG, etc.) to control behavior

### Integration Tests (Manual)

- **Target**: Discord command handlers
- **Why**: Discord.js interactions are hard to mock effectively
- **How**: Test in a real Discord server with `DISCORD_GUILD_ID` set

### What We Test

- ✅ Service functions with various inputs
- ✅ Edge cases and error conditions
- ✅ Validation schemas reject invalid input
- ✅ Formatting functions produce correct output

### What We Don't Test

- ❌ Discord.js internals (trust the library)
- ❌ Network requests to Discord API (integration test territory)
- ❌ Command registration (manual verification)

## Internal Packages

### `@discord-bot/config`

Environment variable parsing and validation using Zod.

**Exports:**
- `env`: Validated environment configuration
- `isDevelopment`, `isProduction`, `isTest`: Environment checks

### `@discord-bot/logger`

Structured logging with level filtering and colored output.

**Usage:**
```typescript
import { createLogger } from '@discord-bot/logger';

const logger = createLogger({ level: 'info', prefix: 'myFeature' });
logger.info('Something happened', { userId: 123 });
```

### `@discord-bot/tsconfig`

Shared TypeScript compiler configuration.

**Usage:**
```json
{
  "extends": "@discord-bot/tsconfig/base.json"
}
```

## Tech Stack

- **Runtime**: Node.js 20+ (LTS)
- **Language**: TypeScript 5.3+
- **Package Manager**: npm (workspaces)
- **Discord Library**: discord.js v14
- **Validation**: Zod
- **Testing**: Vitest
- **Linting**: ESLint + Prettier

## Best Practices

1. **Keep services pure**: No side effects, no Discord.js imports in `service.ts`
2. **Validate early**: Use Zod schemas to catch bad input at the command boundary
3. **Test the logic**: Focus tests on business logic, not Discord adapters
4. **Handle errors gracefully**: Catch errors in handlers and report to users
5. **Use dependency injection**: Pass dependencies (RNG, APIs) as parameters for testability
6. **Follow the pattern**: Every feature follows the same structure for consistency

## Troubleshooting

### Commands not showing up in Discord

- **Guild commands**: Should appear instantly. Check `DISCORD_GUILD_ID` is correct.
- **Global commands**: Can take up to 1 hour. Be patient or use guild commands for dev.

### Build errors

```bash
# Clean build artifacts
npm run clean

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Type errors in editor

```bash
# Rebuild TypeScript declaration files
npm run build
```

## License

MIT

---

**Built with Feature Slice Architecture for long-term maintainability.**
