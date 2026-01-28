/**
 * DM (Dungeon Master) capability check for feature code.
 *
 * This module provides a simple API for feature code to check if a user
 * has DM capability. It uses the persistence layer internally and should
 * be the only way feature code checks DM status.
 *
 * Feature code must NEVER modify DM status - only admin tooling can do that.
 */

import type { UserRepo } from '@discord-bot/persistence';

/**
 * Create a DM check function bound to a user repository.
 *
 * @param userRepo - The user repository to use for DM checks
 * @returns A function that checks if a Discord user has DM capability
 *
 * @example
 * ```typescript
 * const isDm = createDmCheck(userRepo);
 *
 * if (await isDm('123456789012345678')) {
 *   // User has DM capability
 * }
 * ```
 */
export function createDmCheck(userRepo: UserRepo): (discordUserId: string) => Promise<boolean> {
  return async (discordUserId: string): Promise<boolean> => {
    return userRepo.isDmByDiscordUserId(discordUserId);
  };
}

/**
 * Type for the DM check function.
 */
export type DmCheckFn = (discordUserId: string) => Promise<boolean>;
