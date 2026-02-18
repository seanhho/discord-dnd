# @discord-bot/persistence

Persistence layer with repository interfaces (ports) and SQLite adapter implementation.

## Architecture

This package follows a **ports and adapters** (hexagonal) pattern:

- **Ports** (`src/ports/`): Domain models and repository interfaces that are database-agnostic
- **SQLite Adapter** (`src/sqlite/`): Concrete SQLite implementation using Kysely + better-sqlite3

The rest of the application depends only on the port interfaces, allowing the database backend to be swapped without changing business logic.

## Library Choice: Kysely + better-sqlite3

- **Kysely**: Lightweight (~30KB) type-safe SQL query builder with full TypeScript inference
- **better-sqlite3**: Fastest SQLite driver for Node.js, synchronous API
- No code generation required, migrations handled programmatically

## Installation

The package is part of the npm workspace. From the root:

```bash
npm install
npm run build --workspace=@discord-bot/persistence
```

## Usage

### Basic Setup

```typescript
import { SqliteClient, SqliteUserRepo, SqliteCharacterRepo } from '@discord-bot/persistence/sqlite';
import type { UserRepo, CharacterRepo } from '@discord-bot/persistence/ports';

// Initialize client (creates database file and runs migrations)
const client = await SqliteClient.create({
  dbPath: './data/bot.sqlite', // or use ":memory:" for tests
});

// Create repository instances
const userRepo: UserRepo = new SqliteUserRepo(client.kysely);
const characterRepo: CharacterRepo = new SqliteCharacterRepo(client.kysely);

// Use repositories...

// Cleanup on shutdown
await client.close();
```

### Working with Users

```typescript
// Get or create a user from Discord ID
const user = await userRepo.getOrCreateByDiscordUserId('123456789012345678');

// Get user by internal ID
const found = await userRepo.getById(user.id);
```

### Working with Characters

```typescript
import { AttrValue } from '@discord-bot/persistence/ports';

// Create a character
const character = await characterRepo.createCharacter({
  userId: user.id,
  guildId: '987654321098765432',
  name: 'Gandalf',
});

// Find by name (case-insensitive)
const found = await characterRepo.getByName({
  userId: user.id,
  guildId: '987654321098765432',
  name: 'GANDALF', // matches "Gandalf"
});

// List all characters for a user in a guild
const characters = await characterRepo.listByUser({
  userId: user.id,
  guildId: '987654321098765432',
});
```

### Managing Attributes

Attributes use tagged values to preserve type information:

```typescript
import { AttrValue } from '@discord-bot/persistence/ports';

// Update attributes (merges with existing)
const updated = await characterRepo.updateAttributes({
  characterId: character.id,
  patch: {
    level: AttrValue.num(20),
    class: AttrValue.str('wizard'),
    isAlive: AttrValue.bool(true),
  },
});

// Remove specific attributes
const afterRemoval = await characterRepo.unsetAttributes({
  characterId: character.id,
  keys: ['isAlive'],
});
```

### Querying Active Character

Each user can have one active character per guild:

```typescript
// Set active character
await characterRepo.setActiveCharacter({
  userId: user.id,
  guildId: '987654321098765432',
  characterId: character.id,
});

// Get active character (returns null if none set)
const active = await characterRepo.getActiveCharacter({
  userId: user.id,
  guildId: '987654321098765432',
});

if (active) {
  console.log(`Active character: ${active.name}`);
  console.log(`Attributes:`, active.attributes);
} else {
  console.log('No active character set');
}

// Switch active character
await characterRepo.setActiveCharacter({
  userId: user.id,
  guildId: '987654321098765432',
  characterId: anotherCharacter.id,
});
```

## Configuration

### Environment Variables

| Variable  | Default               | Description                                |
| --------- | --------------------- | ------------------------------------------ |
| `DB_PATH` | `./data/bot.sqlite`   | Path to SQLite database file               |

Use `":memory:"` for `DB_PATH` to create an in-memory database (useful for testing).

### SqliteClient Options

```typescript
const client = await SqliteClient.create({
  dbPath: './data/bot.sqlite', // Database file path
  runMigrations: true,          // Run migrations on connect (default: true)
});
```

## Testing

Tests use in-memory SQLite for isolation and speed:

```typescript
import { describe, it, beforeEach, afterEach } from 'vitest';
import { SqliteClient, SqliteUserRepo, SqliteCharacterRepo } from '@discord-bot/persistence';

describe('My feature', () => {
  let client: SqliteClient;
  let userRepo: UserRepo;
  let characterRepo: CharacterRepo;

  beforeEach(async () => {
    client = await SqliteClient.create({ dbPath: ':memory:' });
    userRepo = new SqliteUserRepo(client.kysely);
    characterRepo = new SqliteCharacterRepo(client.kysely);
  });

  afterEach(async () => {
    await client.close();
  });

  it('should do something', async () => {
    // Test code...
  });
});
```

Run tests:

```bash
npm test
```

## Data Models

### User

| Field          | Type   | Description                    |
| -------------- | ------ | ------------------------------ |
| `id`           | string | UUID (internal identifier)     |
| `discordUserId`| string | Discord snowflake ID           |
| `createdAt`    | string | ISO 8601 timestamp             |
| `updatedAt`    | string | ISO 8601 timestamp             |

### Character

| Field        | Type                             | Description                        |
| ------------ | -------------------------------- | ---------------------------------- |
| `id`         | string                           | UUID (internal identifier)         |
| `userId`     | string                           | FK to User.id                      |
| `guildId`    | string                           | Discord guild snowflake ID         |
| `name`       | string                           | Character name (unique per user+guild, case-insensitive) |
| `attributes` | `Record<string, AttributeValue>` | Key-value attributes               |
| `createdAt`  | string                           | ISO 8601 timestamp                 |
| `updatedAt`  | string                           | ISO 8601 timestamp                 |

### AttributeValue

Tagged union preserving type information in JSON:

```typescript
type AttributeValue =
  | { t: 'n'; v: number }   // number
  | { t: 'b'; v: boolean }  // boolean
  | { t: 's'; v: string };  // string
```

## Migrations

Migrations are bundled and run automatically on client creation. To add new migrations:

1. Create a new file in `src/sqlite/migrations/` (e.g., `002_add_feature.ts`)
2. Export `up` and `down` functions
3. Register in `src/sqlite/migrator.ts`

```typescript
// src/sqlite/migrations/002_add_feature.ts
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Add migration logic
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Rollback logic
}
```


---
## Standardized Documentation Addendum
(Generated – do not edit above this line)

## Overview

Persistence layer workspace with repository interfaces and SQLite adapter support.

## Public API

- Package entrypoint: `@discord-bot/persistence`
- `main`: `./dist/index.js`
- `types`: `./dist/index.d.ts`
- `exports`:
  - `.` → `import: ./dist/index.js`, `types: ./dist/index.d.ts`
  - `./ports` → `import: ./dist/ports/index.js`, `types: ./dist/ports/index.d.ts`
  - `./sqlite` → `import: ./dist/sqlite/index.js`, `types: ./dist/sqlite/index.d.ts`

## Design Notes

- Internal workspace package (`private: true`) with subpath exports for ports and SQLite adapter layers.
- Built around `kysely` and `better-sqlite3` dependencies declared in package metadata.

## Development

- Build: `npm run build -w @discord-bot/persistence`
- Clean: `npm run clean -w @discord-bot/persistence`
- Test: `npm run test -w @discord-bot/persistence`

## Change History

- 2026-02-18: Standardized documentation addendum appended.
