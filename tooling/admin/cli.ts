#!/usr/bin/env npx tsx
/**
 * Admin CLI for managing Discord bot administrative tasks.
 *
 * Usage:
 *   npm run admin -- <command> [options]
 *
 * Commands:
 *   set-dm     Grant or revoke DM capability for a user
 *   list-dms   List all users with DM capability
 *
 * Exit codes:
 *   0 - Success
 *   1 - Invalid arguments
 *   2 - Runtime/persistence error
 */

import { SqliteClient, SqliteUserRepo } from '@discord-bot/persistence';
import * as readline from 'node:readline';
import { setDm, listDms } from './commands.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SetDmArgs {
  discordUserId: string;
  enabled: boolean;
  yes: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function printUsage(): void {
  console.log(`
Admin CLI - Discord Bot Administration

Usage:
  npm run admin -- <command> [options]

Commands:
  set-dm      Grant or revoke DM capability for a user
  list-dms    List all users with DM capability
  help        Show this help message

Examples:
  npm run admin -- set-dm --discord-user-id 123456789 --enabled true
  npm run admin -- set-dm --discord-user-id 123456789 --enabled false --yes
  npm run admin -- list-dms
`);
}

function printSetDmUsage(): void {
  console.log(`
set-dm - Grant or revoke DM capability

Usage:
  npm run admin -- set-dm --discord-user-id <id> --enabled <true|false> [--yes]

Options:
  --discord-user-id <id>   Discord user ID (snowflake)
  --enabled <true|false>   Whether to grant (true) or revoke (false) DM capability
  --yes                    Skip confirmation prompt

Examples:
  npm run admin -- set-dm --discord-user-id 123456789012345678 --enabled true
  npm run admin -- set-dm --discord-user-id 123456789012345678 --enabled false --yes
`);
}

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

function parseArgs(args: string[]): { command: string; flags: Map<string, string> } {
  const command = args[0] || 'help';
  const flags = new Map<string, string>();

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      // Check if next arg exists and is not a flag
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        flags.set(key, nextArg);
        i++; // Skip next arg since we consumed it as a value
      } else {
        // Flag without value (boolean flag like --yes)
        flags.set(key, 'true');
      }
    }
  }

  return { command, flags };
}

function parseSetDmArgs(flags: Map<string, string>): SetDmArgs | null {
  const discordUserId = flags.get('discord-user-id');
  const enabledStr = flags.get('enabled');
  const yes = flags.get('yes') === 'true';

  if (!discordUserId) {
    console.error('Error: --discord-user-id is required');
    return null;
  }

  if (!enabledStr) {
    console.error('Error: --enabled is required');
    return null;
  }

  if (enabledStr !== 'true' && enabledStr !== 'false') {
    console.error('Error: --enabled must be "true" or "false"');
    return null;
  }

  return {
    discordUserId,
    enabled: enabledStr === 'true',
    yes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function setDmCommand(flags: Map<string, string>): Promise<number> {
  const args = parseSetDmArgs(flags);
  if (!args) {
    printSetDmUsage();
    return 1;
  }

  let client: SqliteClient | null = null;

  try {
    // Connect to database
    client = await SqliteClient.create({ runMigrations: true });
    const userRepo = new SqliteUserRepo(client.kysely);

    // Get current status first for display
    const user = await userRepo.getOrCreateByDiscordUserId(args.discordUserId);

    console.log('\nUser Information:');
    console.log(`  Internal ID:     ${user.id}`);
    console.log(`  Discord User ID: ${user.discordUserId}`);
    console.log(`  Current DM:      ${user.isDm ? 'YES' : 'NO'}`);
    console.log(`  Requested DM:    ${args.enabled ? 'YES' : 'NO'}`);

    // Check if change is needed
    if (user.isDm === args.enabled) {
      console.log(`\nNo change needed - user already has DM = ${args.enabled ? 'YES' : 'NO'}`);
      return 0;
    }

    // Confirm unless --yes
    if (!args.yes) {
      const action = args.enabled ? 'GRANT' : 'REVOKE';
      const confirmed = await confirm(`\nAre you sure you want to ${action} DM capability?`);
      if (!confirmed) {
        console.log('Cancelled.');
        return 0;
      }
    }

    // Apply the change using the commands module
    const result = await setDm(userRepo, {
      discordUserId: args.discordUserId,
      enabled: args.enabled,
    });

    console.log('\nUpdate successful!');
    console.log(`  New DM status: ${result.user.isDm ? 'YES' : 'NO'}`);
    console.log(`  Updated at:    ${result.user.updatedAt}`);

    return 0;
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error);
    return 2;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

async function listDmsCommand(): Promise<number> {
  let client: SqliteClient | null = null;

  try {
    // Connect to database
    client = await SqliteClient.create({ runMigrations: true });
    const userRepo = new SqliteUserRepo(client.kysely);

    // Get all DM users using the commands module
    const dmUsers = await listDms(userRepo);

    if (dmUsers.length === 0) {
      console.log('\nNo users with DM capability found.');
      return 0;
    }

    console.log(`\nUsers with DM capability (${dmUsers.length}):\n`);
    console.log('  Internal ID                             Discord User ID        Updated At');
    console.log('  ' + '-'.repeat(90));

    for (const user of dmUsers) {
      console.log(
        `  ${user.id}  ${user.discordUserId.padEnd(20)}  ${user.updatedAt}`
      );
    }

    return 0;
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error);
    return 2;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { command, flags } = parseArgs(args);

  let exitCode: number;

  switch (command) {
    case 'set-dm':
      exitCode = await setDmCommand(flags);
      break;

    case 'list-dms':
      exitCode = await listDmsCommand();
      break;

    case 'help':
    case '--help':
    case '-h':
      printUsage();
      exitCode = 0;
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      exitCode = 1;
      break;
  }

  process.exit(exitCode);
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(2);
});
