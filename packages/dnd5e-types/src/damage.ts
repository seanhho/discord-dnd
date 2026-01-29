/**
 * D&D 5e Damage Types
 *
 * All standard damage types from the 5e SRD.
 */

/**
 * Standard 5e damage types.
 */
export const DAMAGE_TYPES = [
  // Physical
  'bludgeoning',
  'piercing',
  'slashing',
  // Elemental
  'acid',
  'cold',
  'fire',
  'lightning',
  'thunder',
  // Other
  'force',
  'necrotic',
  'poison',
  'psychic',
  'radiant',
] as const;

/**
 * Damage type identifier.
 */
export type DamageType = (typeof DAMAGE_TYPES)[number];

/**
 * Physical damage types (affected by non-magical resistance).
 */
export const PHYSICAL_DAMAGE_TYPES: readonly DamageType[] = [
  'bludgeoning',
  'piercing',
  'slashing',
];

/**
 * Display names for damage types.
 */
export const DAMAGE_TYPE_NAMES: Record<DamageType, string> = {
  bludgeoning: 'Bludgeoning',
  piercing: 'Piercing',
  slashing: 'Slashing',
  acid: 'Acid',
  cold: 'Cold',
  fire: 'Fire',
  lightning: 'Lightning',
  thunder: 'Thunder',
  force: 'Force',
  necrotic: 'Necrotic',
  poison: 'Poison',
  psychic: 'Psychic',
  radiant: 'Radiant',
};
