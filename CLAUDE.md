# CLAUDE.md — Authoritative Technical Documentation

> **This document is the PRIMARY source of truth for this repository.**
> All technical decisions, behavior, and architecture documented here are canonical.

---

## 1. Repo Overview

This is a **Discord bot for tabletop RPG character tracking**, built with TypeScript and a Feature Slice architecture. It allows players to create characters, track their stats (D&D 5e style), and manage them via Discord slash commands.

### Design Philosophy

1. **Feature Slice Architecture**: Each feature (dice rolling, character management) is self-contained with strict dependency boundaries.
2. **Typed KV Attribute System**: Character stats are stored as typed key-value pairs with validation rules defined in a central configuration.
3. **Guild-Scoped Characters**: Characters belong to a user within a specific Discord server (guild). Each user can have different characters in different servers.
4. **Persistence via Ports/Adapters**: Business logic uses repository interfaces (ports); SQLite is the current adapter.
5. **Computed Values at Read-Time**: Derived stats (ability modifiers, proficiency bonus) are calculated when displayed, never stored.

### Intended Audience

- Developers and contributors modifying this codebase
- AI/LLM tooling (Claude Code) assisting with development
- Technical maintainers understanding system behavior

---

## 2. Source of Truth & Documentation Contract

### Hierarchy

| Document | Purpose | Audience |
|----------|---------|----------|
| **CLAUDE.md** (this file) | Technical source of truth | Developers, LLMs |
| **README.md** | Player-facing user guide | End users in Discord |

### Documentation Rules

1. **CLAUDE.md is authoritative**: If code and CLAUDE.md disagree, CLAUDE.md reflects intended behavior (file a TODO for discrepancies).
2. **README.md must stay synchronized**: Any change to commands, user-facing messages, or behavior MUST be reflected in README.md.
3. **Claude must update README.md**: When modifying command behavior, output text, or adding features, update README.md in the same PR.

### Pre-Commit Checklist for LLMs

Before submitting changes, verify:

- [ ] Did this change affect what players see or do?
- [ ] If yes, is README.md updated with the new behavior?
- [ ] If adding a command/subcommand, is it documented in both files?
- [ ] If changing error messages or output format, is README.md updated?

---

## 3. Quickstart (Local Dev)

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- A Discord bot token ([Discord Developer Portal](https://discord.com/developers/applications))

### Setup

```bash
# Clone and install
git clone <repo>
cd discord
npm install

# Configure environment
cp .env.example .env
# Edit .env with your values
```

### Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Bot token from Discord Developer Portal |
| `DISCORD_APP_ID` | Yes | Application ID from Discord Developer Portal |
| `DISCORD_GUILD_ID` | No | Set for instant command registration (dev only) |
| `DB_PATH` | Yes | SQLite database path (default: `./data/bot.sqlite`) |
| `NODE_ENV` | No | `development` or `production` |
| `LOG_LEVEL` | No | `debug`, `info`, `warn`, `error` |

### Running

```bash
# Development (hot reload)
npm run dev

# Production
npm run build
npm start
```

### Command Registration

- **With `DISCORD_GUILD_ID` set**: Commands register instantly to that guild (use for development)
- **Without `DISCORD_GUILD_ID`**: Commands register globally (takes up to 1 hour, use for production)

---

## 4. Architecture Map

```
discord-bot/
├── src/
│   ├── main.ts                 # Entry point
│   ├── app.ts                  # Dependency wiring, feature registration
│   ├── core/                   # Infrastructure
│   │   ├── types.ts           # FeatureSlice interface
│   │   ├── env.ts             # Environment config re-export
│   │   ├── featureRegistry.ts # Feature registration
│   │   └── commandRouter.ts   # Discord interaction routing
│   └── features/
│       ├── dice/              # /roll command
│       └── char/              # /char commands (character management)
│           ├── command.ts     # Slash command definitions & handlers
│           ├── kv/            # KV attribute system
│           │   ├── kv.config.ts   # Typed key definitions (SOURCE OF TRUTH)
│           │   ├── parser.ts      # {key:value} syntax parser
│           │   ├── validators.ts  # Type coercion and validation
│           │   └── service.ts     # Patch application logic
│           ├── computed/      # Derived values (mods, proficiency)
│           └── repo/          # Repository port re-exports
├── packages/
│   ├── persistence/           # SQLite adapter + ports
│   │   ├── src/ports/         # Repository interfaces (CharacterRepo, UserRepo)
│   │   └── src/sqlite/        # SQLite implementation + migrations
│   ├── config/                # Environment validation
│   └── logger/                # Structured logging
```

### Source of Truth by Subsystem

| Subsystem | Source of Truth |
|-----------|-----------------|
| Typed attribute keys | `src/features/char/kv/kv.config.ts` |
| Repository contracts | `packages/persistence/src/ports/*.ts` |
| Database schema | `packages/persistence/src/sqlite/migrations/*.ts` |
| Command definitions | `src/features/*/command.ts` |

---

## 5. Character System (Guild-Scoped)

### Current Behavior

> **Note**: Characters are currently **GUILD-SCOPED**, meaning each character belongs to a (user, guild) pair.

- **Uniqueness**: Character names are unique per (user, guild), case-insensitive.
- **Name Normalization**: Names are stored with original casing; lookup uses `name_lower` (lowercase).
- **Active Character**: One active character per (user, guild). Defaults commands to the active character if no name specified.
- **DM Support**: Commands currently require `guildId`; DMs are not supported.

### Database Tables

```
users
├── id (UUID, PK)
├── discord_user_id (unique)
├── created_at, updated_at

characters
├── id (UUID, PK)
├── user_id (FK → users.id)
├── guild_id (Discord guild snowflake)
├── name, name_lower
├── attributes (JSON)
├── created_at, updated_at
└── UNIQUE(user_id, guild_id, name_lower)

active_characters
├── user_id (FK → users.id)
├── guild_id
├── character_id (FK → characters.id)
└── UNIQUE(user_id, guild_id)
```

### TODO: User-Scoped Migration

There is planned work to migrate to **user-scoped** characters (global per Discord user, not per guild). This would:
- Change uniqueness to `UNIQUE(user_id, name_lower)`
- Change active character to one per user globally
- Enable DM support

This migration is NOT yet implemented.

---

## 6. Commands Reference (Technical)

### `/roll` — Dice Rolling

Roll dice with D&D-style notation.

| Option | Type | Default | Range | Description |
|--------|------|---------|-------|-------------|
| `sides` | integer | 20 | 2-1000 | Sides per die |
| `count` | integer | 1 | 1-50 | Number of dice |
| `modifier` | integer | 0 | -1000 to 1000 | Added to total |
| `label` | string | none | max 50 chars | Optional label |

**Example**: `/roll sides:20 count:2 modifier:5 label:"Attack Roll"`

---

### `/char set` — Create or Update Character

Creates a character if it doesn't exist, then applies attribute patches.

| Option | Required | Description |
|--------|----------|-------------|
| `name` | Yes | Character name (max 100 chars) |
| `attributes` | Yes | Patch in `{key:value, ...}` format |

**Behavior**:
- If character doesn't exist, creates it
- Merges attributes (existing keys updated, new keys added)
- Returns diff of changes + computed values if applicable
- Warns for unknown keys (stored as strings)

**Example**: `/char set name:Gandalf attributes:{class:"Wizard", level:20, str:10}`

---

### `/char show` — Display Character Information

| Option | Required | Description |
|--------|----------|-------------|
| `name` | No | Character name (defaults to active) |
| `view` | No | Display mode (see below) |

**Views**:
- `summary` (default): Identity, abilities, HP
- `stats`: Ability scores with modifiers
- `hp`: Hit points and AC
- `equipment`: Weapon info
- `attacks`: Attack calculations
- `all`: Everything
- `help`: Key reference documentation
- `template`: Copy-paste examples
- `characters`: List all characters for this user in this guild
- `active`: Show active character name

---

### `/char get` — Retrieve Specific Attributes

| Option | Required | Description |
|--------|----------|-------------|
| `name` | No | Character name (defaults to active) |
| `keys` | No* | Space-separated attribute keys |
| `prefix` | No* | Key prefix filter (e.g., "weapon") |
| `computed` | No | Include computed values (default: false) |

*At least one of `keys` or `prefix` required.

---

### `/char unset` — Remove Attributes

| Option | Required | Description |
|--------|----------|-------------|
| `keys` | Yes | Space-separated keys to remove |
| `name` | No | Character name (defaults to active) |

---

### `/char active` — Set Active Character

| Option | Required | Description |
|--------|----------|-------------|
| `name` | Yes | Character name to set as active |

---

## 7. Persistence and Migrations

### Architecture

```
Feature Code → Repository Ports (interfaces) → SQLite Adapter (Kysely)
```

- **Ports**: `packages/persistence/src/ports/` — Repository interfaces (`CharacterRepo`, `UserRepo`)
- **Adapters**: `packages/persistence/src/sqlite/` — SQLite implementation
- **Migrations**: `packages/persistence/src/sqlite/migrations/` — Schema changes

### Running Migrations

Migrations run automatically on startup via `SqliteClient.create()` with `runMigrations: true` (default).

### Database Location

- **Development**: `./data/bot.sqlite` (or as configured in `DB_PATH`)
- **In-Memory**: Use `DB_PATH=:memory:` for testing

### Migration Files

- `001_initial.ts`: Creates users, characters, active_characters tables

### Known Caveats

- SQLite doesn't support concurrent writes well; fine for single-instance deployment
- Future: may need to migrate to user-scoped characters (see TODO in Section 5)

---

## 8. Admin Operations

### Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled bot |
| `npm test` | Run all tests |
| `npm run lint` | Check linting |
| `npm run typecheck` | TypeScript type checking |

### No Admin Commands Yet

There are no admin-only Discord commands implemented. Database management is done via SQLite tooling directly.

---

## 9. Testing

### Test Framework

Vitest for all tests.

### Running Tests

```bash
npm test          # Run all tests
npm run test:watch  # Watch mode
```

### Test Categories

1. **Unit Tests**: Pure service logic (parser, validators, dice rolling)
   - Location: `src/features/*/___tests__/*.test.ts`
   - No mocking required; tests pure functions

2. **Persistence Integration Tests**: Repository behavior
   - Location: `packages/persistence/tests/__tests__/sqlite.repos.test.ts`
   - Uses in-memory SQLite (`:memory:`)

### What's Tested

- KV parser (syntax validation, edge cases)
- KV validators (type coercion, constraints)
- Dice rolling logic
- Computed value derivation
- Repository CRUD operations

---

## 10. Deployment

### Simplest Deployment

1. Clone repo to server
2. `npm install && npm run build`
3. Configure `.env` with production values
4. `npm start` (or use PM2/systemd for process management)

### Production Environment Variables

```env
DISCORD_TOKEN=<production_token>
DISCORD_APP_ID=<app_id>
DISCORD_GUILD_ID=         # Leave empty for global commands
DB_PATH=./data/bot.sqlite
NODE_ENV=production
LOG_LEVEL=info
```

### SQLite Persistence Notes

- SQLite file must be on persistent storage
- Backup the `DB_PATH` file regularly
- Single-instance only (no horizontal scaling without migrating to PostgreSQL/MySQL)

---

## 11. Contributing Guidelines for LLMs

### Hard Rules — NEVER Violate

1. **Never bypass persistence ports**: Feature code must use repository interfaces, never import Kysely or SQLite directly.

2. **Never introduce guild-scoping changes inconsistently**: The current model is guild-scoped. Any migration to user-scoped must be complete (ports, adapters, migrations, handlers).

3. **Never store computed/derived values**: Ability modifiers, proficiency bonus, and similar values are calculated at read-time. Do not add them to the database.

4. **Update KV config for new typed keys**: If adding a new known attribute key, add it to `kv.config.ts` with type, constraints, and group.

5. **Update README.md for user-facing changes**: Any command change, new output, or behavior change must be reflected in README.md.

6. **Preserve original name casing**: Store the user's original input for `name`; use `name_lower` only for uniqueness/lookup.

### Safe Change Checklist

Before submitting a PR:

- [ ] Ran `npm run build` — no TypeScript errors
- [ ] Ran `npm test` — all tests pass
- [ ] Ran `npm run lint` — no linting errors
- [ ] If touching persistence: checked port interfaces match implementation
- [ ] If touching commands: verified Discord options match handler expectations
- [ ] If touching user-facing output: updated README.md

### Code Style

- Pure functions in `service.ts` files (no Discord.js imports)
- Repository calls only in command handlers
- Zod for input validation
- Explicit error messages for users

---

## 12. Known Gaps / TODOs

### Not Implemented

- [ ] **`/char list` as standalone command**: Currently, listing characters is via `/char show view:characters`. A dedicated `/char list` subcommand is planned but not implemented.

- [ ] **User-scoped characters**: Migration from guild-scoped to user-scoped characters is planned but not implemented. See Section 5.

- [ ] **DM support**: Commands require `guildId`; DMs will be supported after user-scoped migration.

- [ ] **Character deletion**: No `/char delete` command exists.

- [ ] **`/char setup` wizard**: An interactive character creation flow is not implemented.

- [ ] **Auto-activate on create**: When creating a character with `/char set` and no active character exists, the new character should become active. (Partial implementation may exist — verify in code.)

### Known Issues

- **Error messages reference old commands**: Some error messages may suggest `/char show view:characters` when a `/char list` would be more intuitive once implemented.

---

## Appendix: Typed KV Attribute Keys

Source of truth: `src/features/char/kv/kv.config.ts`

### Identity
| Key | Type | Constraints | Description |
|-----|------|-------------|-------------|
| `name` | string | — | Character name |
| `class` | string | — | Character class |
| `level` | number | 1-20 | Character level (affects proficiency) |

### Ability Scores
| Key | Type | Constraints | Description |
|-----|------|-------------|-------------|
| `str` | number | 1-30 | Strength |
| `dex` | number | 1-30 | Dexterity |
| `con` | number | 1-30 | Constitution |
| `int` | number | 1-30 | Intelligence |
| `wis` | number | 1-30 | Wisdom |
| `cha` | number | 1-30 | Charisma |

### Combat
| Key | Type | Constraints | Description |
|-----|------|-------------|-------------|
| `hp.max` | number | >= 1 | Maximum HP |
| `hp.current` | number | >= 0 | Current HP |
| `ac` | number | 1-50 | Armor Class |
| `speed` | number | 0-200 | Movement speed (feet) |

### Equipment
| Key | Type | Constraints | Description |
|-----|------|-------------|-------------|
| `weapon.primary.name` | string | — | Weapon name |
| `weapon.primary.damage` | string | — | Damage dice (e.g., "1d8+3") |
| `weapon.primary.proficient` | boolean | — | Proficiency with weapon |

### Unknown Keys

Keys not in this list are stored as strings with a warning to the user.
