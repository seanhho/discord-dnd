/**
 * Derived/Computed values for characters.
 *
 * These values are calculated at read-time from stored attributes.
 * They are never stored in the database.
 */

import type { AttributeValue, ComputedValues } from '../types.js';

/**
 * Calculate ability modifier from ability score.
 * Formula: floor((score - 10) / 2)
 */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Format ability modifier with sign.
 */
export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Calculate proficiency bonus from character level.
 * - Levels 1-4: +2
 * - Levels 5-8: +3
 * - Levels 9-12: +4
 * - Levels 13-16: +5
 * - Levels 17-20: +6
 */
export function proficiencyBonus(level: number): number {
  if (level < 1) return 2;
  if (level <= 4) return 2;
  if (level <= 8) return 3;
  if (level <= 12) return 4;
  if (level <= 16) return 5;
  return 6;
}

/**
 * Extract numeric value from an AttributeValue if it's a number type.
 */
function getNumericValue(attr: AttributeValue | undefined): number | undefined {
  if (!attr || attr.t !== 'n') return undefined;
  return attr.v;
}

/**
 * Derive all computed values from character attributes.
 *
 * @param attributes - Character's stored attributes
 * @returns Computed values (only populated for attributes that exist)
 */
export function deriveComputed(
  attributes: Record<string, AttributeValue>
): ComputedValues {
  const computed: ComputedValues = {};

  // Level -> Proficiency Bonus
  const level = getNumericValue(attributes['level']);
  if (level !== undefined) {
    computed.proficiencyBonus = proficiencyBonus(level);
  }

  // Ability Scores -> Modifiers
  const str = getNumericValue(attributes['str']);
  if (str !== undefined) {
    computed.strMod = abilityModifier(str);
  }

  const dex = getNumericValue(attributes['dex']);
  if (dex !== undefined) {
    computed.dexMod = abilityModifier(dex);
  }

  const con = getNumericValue(attributes['con']);
  if (con !== undefined) {
    computed.conMod = abilityModifier(con);
  }

  const int = getNumericValue(attributes['int']);
  if (int !== undefined) {
    computed.intMod = abilityModifier(int);
  }

  const wis = getNumericValue(attributes['wis']);
  if (wis !== undefined) {
    computed.wisMod = abilityModifier(wis);
  }

  const cha = getNumericValue(attributes['cha']);
  if (cha !== undefined) {
    computed.chaMod = abilityModifier(cha);
  }

  return computed;
}

/**
 * Format computed values for display.
 */
export function formatComputed(computed: ComputedValues): string[] {
  const lines: string[] = [];

  if (computed.proficiencyBonus !== undefined) {
    lines.push(`Proficiency Bonus: ${formatModifier(computed.proficiencyBonus)}`);
  }

  const mods: string[] = [];
  if (computed.strMod !== undefined) mods.push(`STR ${formatModifier(computed.strMod)}`);
  if (computed.dexMod !== undefined) mods.push(`DEX ${formatModifier(computed.dexMod)}`);
  if (computed.conMod !== undefined) mods.push(`CON ${formatModifier(computed.conMod)}`);
  if (computed.intMod !== undefined) mods.push(`INT ${formatModifier(computed.intMod)}`);
  if (computed.wisMod !== undefined) mods.push(`WIS ${formatModifier(computed.wisMod)}`);
  if (computed.chaMod !== undefined) mods.push(`CHA ${formatModifier(computed.chaMod)}`);

  if (mods.length > 0) {
    lines.push(`Ability Mods: ${mods.join(', ')}`);
  }

  return lines;
}

/**
 * Check if any computed values are present.
 */
export function hasComputedValues(computed: ComputedValues): boolean {
  return Object.keys(computed).length > 0;
}
