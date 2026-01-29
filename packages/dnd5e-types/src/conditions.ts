/**
 * D&D 5e Conditions
 *
 * Standard conditions that affect creatures.
 */

/**
 * Standard 5e conditions.
 */
export const CONDITIONS = [
  'blinded',
  'charmed',
  'deafened',
  'exhaustion',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
] as const;

/**
 * Condition identifier.
 */
export type Condition = (typeof CONDITIONS)[number];

/**
 * Display names for conditions.
 */
export const CONDITION_NAMES: Record<Condition, string> = {
  blinded: 'Blinded',
  charmed: 'Charmed',
  deafened: 'Deafened',
  exhaustion: 'Exhaustion',
  frightened: 'Frightened',
  grappled: 'Grappled',
  incapacitated: 'Incapacitated',
  invisible: 'Invisible',
  paralyzed: 'Paralyzed',
  petrified: 'Petrified',
  poisoned: 'Poisoned',
  prone: 'Prone',
  restrained: 'Restrained',
  stunned: 'Stunned',
  unconscious: 'Unconscious',
};
