# Admin CLI

Command-line tools for administering the Discord bot.

## Overview

The admin CLI provides tools to manage bot administrative tasks that should not be accessible via Discord commands. Currently, it supports managing **DM (Dungeon Master) capability**.

## What is DM Capability?

DM capability is a global flag on a user that determines whether they can perform special DM-only actions in the bot:

- **Encounters**: Creating and managing combat encounters
- **NPC Control**: Controlling non-player characters
- **Overrides**: Bypassing certain restrictions or modifying other players' data
- **Future Features**: Any DM-specific functionality added later

Key characteristics:
- **Global per user**: DM status is the same across all guilds
- **Admin-only management**: Can only be granted/revoked via this CLI, not Discord commands
- **Query-only for features**: Feature code can check DM status but cannot modify it

## Commands

### `set-dm` - Grant or Revoke DM Capability

Grant or revoke DM capability for a Discord user.

```bash
npm run admin -- set-dm --discord-user-id <id> --enabled <true|false> [--yes]
```

**Options:**

| Option | Required | Description |
|--------|----------|-------------|
| `--discord-user-id <id>` | Yes | The Discord user ID (snowflake) |
| `--enabled <true\|false>` | Yes | `true` to grant, `false` to revoke |
| `--yes` | No | Skip confirmation prompt |

**Examples:**

Grant DM capability:
```bash
npm run admin -- set-dm --discord-user-id 123456789012345678 --enabled true
```

Revoke DM capability:
```bash
npm run admin -- set-dm --discord-user-id 123456789012345678 --enabled false
```

Skip confirmation (for scripts):
```bash
npm run admin -- set-dm --discord-user-id 123456789012345678 --enabled true --yes
```

**Output:**
```
User Information:
  Internal ID:     550e8400-e29b-41d4-a716-446655440000
  Discord User ID: 123456789012345678
  Current DM:      NO
  Requested DM:    YES

Are you sure you want to GRANT DM capability? (y/N): y

Update successful!
  New DM status: YES
  Updated at:    2024-01-15T10:30:00.000Z
```

---

### `list-dms` - List All DMs

List all users who currently have DM capability.

```bash
npm run admin -- list-dms
```

**Example Output:**
```
Users with DM capability (2):

  Internal ID                             Discord User ID        Updated At
  ------------------------------------------------------------------------------------------
  550e8400-e29b-41d4-a716-446655440000  123456789012345678    2024-01-15T10:30:00.000Z
  660e8400-e29b-41d4-a716-446655440001  987654321098765432    2024-01-14T08:15:00.000Z
```

---

### `help` - Show Help

Display usage information.

```bash
npm run admin -- help
```

## Safety Notes

### Confirmation Prompts

By default, `set-dm` requires confirmation before making changes. This prevents accidental grants or revokes.

To skip confirmation (for automated scripts), use the `--yes` flag:
```bash
npm run admin -- set-dm --discord-user-id 123456789012345678 --enabled false --yes
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Invalid arguments |
| `2` | Runtime/persistence error |

### Best Practices

1. **Audit regularly**: Use `list-dms` to periodically review who has DM capability
2. **Use confirmation**: Avoid `--yes` unless scripting
3. **Document grants**: Keep a record of why DM capability was granted
4. **Revoke when not needed**: Remove DM capability when a user no longer needs it

## Finding Discord User IDs

To find a Discord user ID:

1. Enable Developer Mode in Discord (User Settings → App Settings → Advanced → Developer Mode)
2. Right-click on a user
3. Click "Copy User ID"

The ID will be a long number like `123456789012345678`.

## Troubleshooting

### "User not found after update"

This should not happen under normal circumstances. If it does:
1. Check database connectivity
2. Verify the database file is writable
3. Check for disk space issues

### Database Connection Errors

The CLI uses the same database as the bot. Ensure:
1. `DB_PATH` environment variable is set (or uses default `./data/bot.sqlite`)
2. The database file exists and is accessible
3. No other process has an exclusive lock on the database

### User Created But DM Not Set

If a user is created but DM status doesn't change:
1. Check the output for error messages
2. Verify you typed `true` or `false` exactly (not `yes`/`no`)
3. Try running with `--yes` to see if it's a stdin issue
