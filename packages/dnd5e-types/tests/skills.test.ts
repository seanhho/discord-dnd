/**
 * Tests for skill types and constants.
 */

import { describe, it, expect } from 'vitest';
import {
  SKILLS,
  SKILL_NAMES,
  SKILL_TO_ABILITY,
  type Skill,
  type SkillProficiencies,
} from '../src/index.js';

describe('SKILLS', () => {
  it('should contain exactly 18 skills', () => {
    expect(SKILLS).toHaveLength(18);
  });

  it('should contain key skills', () => {
    expect(SKILLS).toContain('acrobatics');
    expect(SKILLS).toContain('athletics');
    expect(SKILLS).toContain('perception');
    expect(SKILLS).toContain('stealth');
    expect(SKILLS).toContain('persuasion');
  });

  it('should be a const array (readonly at compile time)', () => {
    // TypeScript's 'as const' makes the array readonly at compile time
    expect(Array.isArray(SKILLS)).toBe(true);
    expect(SKILLS.length).toBe(18);
  });
});

describe('SKILL_TO_ABILITY', () => {
  it('should map all skills to abilities', () => {
    for (const skill of SKILLS) {
      expect(SKILL_TO_ABILITY[skill]).toBeDefined();
    }
  });

  it('should map skills to correct abilities', () => {
    expect(SKILL_TO_ABILITY.acrobatics).toBe('dex');
    expect(SKILL_TO_ABILITY.athletics).toBe('str');
    expect(SKILL_TO_ABILITY.arcana).toBe('int');
    expect(SKILL_TO_ABILITY.perception).toBe('wis');
    expect(SKILL_TO_ABILITY.persuasion).toBe('cha');
  });

  it('should have all DEX skills mapped correctly', () => {
    expect(SKILL_TO_ABILITY.acrobatics).toBe('dex');
    expect(SKILL_TO_ABILITY.sleight_of_hand).toBe('dex');
    expect(SKILL_TO_ABILITY.stealth).toBe('dex');
  });

  it('should have all INT skills mapped correctly', () => {
    expect(SKILL_TO_ABILITY.arcana).toBe('int');
    expect(SKILL_TO_ABILITY.history).toBe('int');
    expect(SKILL_TO_ABILITY.investigation).toBe('int');
    expect(SKILL_TO_ABILITY.nature).toBe('int');
    expect(SKILL_TO_ABILITY.religion).toBe('int');
  });

  it('should have all WIS skills mapped correctly', () => {
    expect(SKILL_TO_ABILITY.animal_handling).toBe('wis');
    expect(SKILL_TO_ABILITY.insight).toBe('wis');
    expect(SKILL_TO_ABILITY.medicine).toBe('wis');
    expect(SKILL_TO_ABILITY.perception).toBe('wis');
    expect(SKILL_TO_ABILITY.survival).toBe('wis');
  });

  it('should have all CHA skills mapped correctly', () => {
    expect(SKILL_TO_ABILITY.deception).toBe('cha');
    expect(SKILL_TO_ABILITY.intimidation).toBe('cha');
    expect(SKILL_TO_ABILITY.performance).toBe('cha');
    expect(SKILL_TO_ABILITY.persuasion).toBe('cha');
  });
});

describe('SKILL_NAMES', () => {
  it('should have display names for all skills', () => {
    for (const skill of SKILLS) {
      expect(SKILL_NAMES[skill]).toBeDefined();
      expect(typeof SKILL_NAMES[skill]).toBe('string');
    }
  });

  it('should have proper casing', () => {
    expect(SKILL_NAMES.animal_handling).toBe('Animal Handling');
    expect(SKILL_NAMES.sleight_of_hand).toBe('Sleight of Hand');
  });
});

describe('SkillProficiencies type', () => {
  it('should allow partial proficiency maps', () => {
    const profs: SkillProficiencies = {
      athletics: 'proficient',
      perception: 'expertise',
    };

    expect(profs.athletics).toBe('proficient');
    expect(profs.perception).toBe('expertise');
    expect(profs.stealth).toBeUndefined();
  });
});
