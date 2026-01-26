import { describe, it, expect } from 'vitest';
import { rollDice, formatRollResult } from '../service.js';
import type { DiceRollParams, RandomNumberGenerator } from '../types.js';

describe('rollDice', () => {
  it('should roll dice with default RNG', () => {
    const params: DiceRollParams = {
      sides: 6,
      count: 2,
      modifier: 0,
    };

    const result = rollDice(params);

    expect(result.rolls).toHaveLength(2);
    expect(result.rolls.every((roll) => roll >= 1 && roll <= 6)).toBe(true);
    expect(result.modifier).toBe(0);
    expect(result.subtotal).toBe(result.rolls[0]! + result.rolls[1]!);
    expect(result.total).toBe(result.subtotal);
  });

  it('should use injected RNG for deterministic testing', () => {
    const mockRng: RandomNumberGenerator = (max: number) => max; // Always return max
    const params: DiceRollParams = {
      sides: 20,
      count: 3,
      modifier: 5,
    };

    const result = rollDice(params, mockRng);

    expect(result.rolls).toEqual([20, 20, 20]);
    expect(result.subtotal).toBe(60);
    expect(result.modifier).toBe(5);
    expect(result.total).toBe(65);
  });

  it('should handle positive modifiers correctly', () => {
    const mockRng: RandomNumberGenerator = () => 10;
    const params: DiceRollParams = {
      sides: 20,
      count: 1,
      modifier: 7,
    };

    const result = rollDice(params, mockRng);

    expect(result.rolls).toEqual([10]);
    expect(result.subtotal).toBe(10);
    expect(result.total).toBe(17);
  });

  it('should handle negative modifiers correctly', () => {
    const mockRng: RandomNumberGenerator = () => 15;
    const params: DiceRollParams = {
      sides: 20,
      count: 1,
      modifier: -3,
    };

    const result = rollDice(params, mockRng);

    expect(result.rolls).toEqual([15]);
    expect(result.subtotal).toBe(15);
    expect(result.total).toBe(12);
  });

  it('should include label when provided', () => {
    const mockRng: RandomNumberGenerator = () => 5;
    const params: DiceRollParams = {
      sides: 6,
      count: 1,
      modifier: 0,
      label: 'Attack Roll',
    };

    const result = rollDice(params, mockRng);

    expect(result.label).toBe('Attack Roll');
  });

  it('should roll multiple dice correctly', () => {
    let callCount = 0;
    const values = [3, 5, 2, 6, 1];
    const mockRng: RandomNumberGenerator = () => values[callCount++]!;

    const params: DiceRollParams = {
      sides: 6,
      count: 5,
      modifier: 0,
    };

    const result = rollDice(params, mockRng);

    expect(result.rolls).toEqual([3, 5, 2, 6, 1]);
    expect(result.subtotal).toBe(17);
    expect(result.total).toBe(17);
  });
});

describe('formatRollResult', () => {
  it('should format a simple roll without modifier', () => {
    const params: DiceRollParams = { sides: 20, count: 1, modifier: 0 };
    const result = { rolls: [15], modifier: 0, subtotal: 15, total: 15 };

    const formatted = formatRollResult(params, result);

    expect(formatted).toBe('1d20 = **15** (rolled: 15)');
  });

  it('should format a roll with positive modifier', () => {
    const params: DiceRollParams = { sides: 20, count: 1, modifier: 5 };
    const result = { rolls: [12], modifier: 5, subtotal: 12, total: 17 };

    const formatted = formatRollResult(params, result);

    expect(formatted).toBe('1d20 + 5 = **17** (rolled: 12)');
  });

  it('should format a roll with negative modifier', () => {
    const params: DiceRollParams = { sides: 20, count: 1, modifier: -2 };
    const result = { rolls: [14], modifier: -2, subtotal: 14, total: 12 };

    const formatted = formatRollResult(params, result);

    expect(formatted).toBe('1d20 - 2 = **12** (rolled: 14)');
  });

  it('should format multiple dice rolls', () => {
    const params: DiceRollParams = { sides: 6, count: 3, modifier: 0 };
    const result = { rolls: [4, 5, 3], modifier: 0, subtotal: 12, total: 12 };

    const formatted = formatRollResult(params, result);

    expect(formatted).toBe('3d6 = **12** (rolled: 4, 5, 3)');
  });

  it('should include label when provided', () => {
    const params: DiceRollParams = {
      sides: 20,
      count: 1,
      modifier: 2,
      label: 'Attack Roll',
    };
    const result = { rolls: [13], modifier: 2, subtotal: 13, total: 15, label: 'Attack Roll' };

    const formatted = formatRollResult(params, result);

    expect(formatted).toBe('**Attack Roll**: 1d20 + 2 = **15** (rolled: 13)');
  });

  it('should handle complex roll with all options', () => {
    const params: DiceRollParams = {
      sides: 8,
      count: 4,
      modifier: -1,
      label: 'Damage',
    };
    const result = {
      rolls: [6, 2, 8, 5],
      modifier: -1,
      subtotal: 21,
      total: 20,
      label: 'Damage',
    };

    const formatted = formatRollResult(params, result);

    expect(formatted).toBe('**Damage**: 4d8 - 1 = **20** (rolled: 6, 2, 8, 5)');
  });
});
