/**
 * Admin CLI command implementations.
 *
 * This module contains the core logic for admin commands, separated from
 * the CLI parsing and I/O handling for testability.
 */

import type { UserRepo, User } from '@discord-bot/persistence';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SetDmResult {
  user: User;
  previousIsDm: boolean;
  newIsDm: boolean;
  changed: boolean;
}

export interface SetDmParams {
  discordUserId: string;
  enabled: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set DM capability for a user.
 *
 * @param userRepo - User repository
 * @param params - Set DM parameters
 * @returns Result containing previous and new status
 */
export async function setDm(
  userRepo: UserRepo,
  params: SetDmParams
): Promise<SetDmResult> {
  // Get or create user
  const user = await userRepo.getOrCreateByDiscordUserId(params.discordUserId);
  const previousIsDm = user.isDm;

  // Check if change is needed
  if (previousIsDm === params.enabled) {
    return {
      user,
      previousIsDm,
      newIsDm: params.enabled,
      changed: false,
    };
  }

  // Apply change
  await userRepo.setUserDmStatus(user.id, params.enabled);

  // Re-read user
  const updatedUser = await userRepo.getById(user.id);
  if (!updatedUser) {
    throw new Error('User not found after update');
  }

  return {
    user: updatedUser,
    previousIsDm,
    newIsDm: updatedUser.isDm,
    changed: true,
  };
}

/**
 * List all users with DM capability.
 *
 * @param userRepo - User repository
 * @returns Array of users with DM capability
 */
export async function listDms(userRepo: UserRepo): Promise<User[]> {
  return userRepo.listDmUsers();
}
