/**
 * Armor Class calculations.
 */

import { abilityMod } from '../ability.js';
import type { Character5eSnapshot, Armor5e } from '../../types.js';
import {
  createModifierStack,
  addModifier,
  sumModifiers,
} from '../../engine/modifiers.js';
import { createBreakdown, formatBreakdownLine, type Breakdown } from '../../engine/explain.js';

/**
 * Result of computing AC.
 */
export interface ACResult {
  total: number;
  breakdown: Breakdown;
  explain: string;
}

/**
 * Compute armor class.
 *
 * 5e AC formulas:
 * - No armor: 10 + DEX mod
 * - Light armor: armor base + DEX mod
 * - Medium armor: armor base + DEX mod (max 2)
 * - Heavy armor: armor base (no DEX)
 * - Shield: +2 (stacks with armor)
 */
export function computeArmorClass(
  character: Character5eSnapshot,
  equippedArmor?: Armor5e,
  equippedShield?: Armor5e
): ACResult {
  let stack = createModifierStack();

  const dexMod = abilityMod(character.abilityScores.dex);

  if (!equippedArmor) {
    // Unarmored: 10 + DEX
    stack = addModifier(stack, 10, 'Base');
    stack = addModifier(stack, dexMod, 'DEX mod');
  } else {
    // Add armor base AC
    stack = addModifier(stack, equippedArmor.baseAC, equippedArmor.name);

    // Add DEX modifier based on armor type
    switch (equippedArmor.category) {
      case 'light':
        // Full DEX bonus
        stack = addModifier(stack, dexMod, 'DEX mod');
        break;

      case 'medium':
        // DEX bonus capped at +2
        const cappedDex = Math.min(dexMod, 2);
        if (cappedDex !== 0) {
          stack = addModifier(stack, cappedDex, `DEX mod (max 2)`);
        }
        break;

      case 'heavy':
        // No DEX bonus
        break;
    }

    // Add armor magic bonus if any
    if (equippedArmor.magicBonus) {
      stack = addModifier(stack, equippedArmor.magicBonus, `${equippedArmor.name} magic`);
    }
  }

  // Add shield
  if (equippedShield) {
    stack = addModifier(stack, equippedShield.baseAC, equippedShield.name);
    if (equippedShield.magicBonus) {
      stack = addModifier(stack, equippedShield.magicBonus, `${equippedShield.name} magic`);
    }
  }

  // Add any misc AC bonus from character
  if (character.acBonus) {
    stack = addModifier(stack, character.acBonus, 'Misc bonus');
  }

  const breakdown = createBreakdown(stack);
  const explain = formatBreakdownLine(breakdown);

  return {
    total: sumModifiers(stack),
    breakdown,
    explain,
  };
}

/**
 * Check if a character meets armor requirements.
 * Heavy armor has STR requirements.
 */
export function meetsArmorRequirements(
  character: Character5eSnapshot,
  armor: Armor5e
): { meets: boolean; reason?: string } {
  if (armor.strengthRequirement) {
    if (character.abilityScores.str < armor.strengthRequirement) {
      return {
        meets: false,
        reason: `Requires ${armor.strengthRequirement} STR (you have ${character.abilityScores.str})`,
      };
    }
  }

  return { meets: true };
}

/**
 * Check if wearing armor imposes stealth disadvantage.
 */
export function hasStealthDisadvantage(armor?: Armor5e): boolean {
  return armor?.stealthDisadvantage ?? false;
}
