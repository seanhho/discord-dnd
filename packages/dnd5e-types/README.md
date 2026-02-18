# @discord-bot/dnd5e-types

Stable D&D 5e type definitions for the Discord bot monorepo.

## Purpose

This package provides **pure TypeScript types, constants, and guards** for D&D 5e concepts. It contains:

- Type definitions (unions, interfaces)
- Constant arrays (abilities, skills, etc.)
- Simple type guard functions
- Display name mappings

It does **NOT** contain:

- Rules logic or calculations
- Data lists (weapons, armor stats)
- Persistence or Discord code

## Stability Contract

This package is designed to be **safe for import by the persistence layer**. Types here are stable and should not change frequently. Breaking changes will be versioned.

## Exports

### Abilities

```typescript
import {
  ABILITIES,           // ['str', 'dex', 'con', 'int', 'wis', 'cha']
  ABILITY_NAMES,       // { str: 'Strength', ... }
  ABILITY_ABBREV,      // { str: 'STR', ... }
  type Ability,        // 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
  type AbilityScores,  // Record<Ability, number>
  type SavingThrowProficiencies,
} from '@discord-bot/dnd5e-types';
```

### Skills

```typescript
import {
  SKILLS,              // 18 skill identifiers
  SKILL_NAMES,         // Display names
  SKILL_TO_ABILITY,    // Maps skill -> governing ability
  type Skill,
  type ProficiencyLevel,  // 'proficient' | 'expertise'
  type SkillProficiencies,
} from '@discord-bot/dnd5e-types';
```

### Damage Types

```typescript
import {
  DAMAGE_TYPES,
  DAMAGE_TYPE_NAMES,
  PHYSICAL_DAMAGE_TYPES,
  type DamageType,
} from '@discord-bot/dnd5e-types';
```

### Conditions

```typescript
import {
  CONDITIONS,
  CONDITION_NAMES,
  type Condition,
} from '@discord-bot/dnd5e-types';
```

### Combat

```typescript
import {
  WEAPON_PROPERTIES,
  type AdvantageState,   // 'none' | 'advantage' | 'disadvantage'
  type AttackType,       // 'melee' | 'ranged'
  type WeaponProperty,
  type ArmorCategory,    // 'light' | 'medium' | 'heavy' | 'shield'
} from '@discord-bot/dnd5e-types';
```

### Type Guards

```typescript
import {
  isAbility,
  isSkill,
  isDamageType,
  isCondition,
  isWeaponProperty,
} from '@discord-bot/dnd5e-types';

if (isAbility(userInput)) {
  // userInput is typed as Ability
}
```

### Version

```typescript
import { VERSION } from '@discord-bot/dnd5e-types';
```

## Dependency Rules

| Package | Can Import dnd5e-types? |
|---------|------------------------|
| @discord-bot/persistence | ✅ Yes |
| @discord-bot/dnd5e | ✅ Yes |
| Bot features | ✅ Yes |

**Important:** `dnd5e-types` must NOT depend on any other package in this monorepo (except `tsconfig`).

## Development

```bash
# Build
npm run build -w @discord-bot/dnd5e-types

# Test
npm run test -w @discord-bot/dnd5e-types
```


---
## Standardized Documentation Addendum
(Generated – do not edit above this line)

## Overview

Stable D&D 5e type definitions workspace intended for broad internal reuse.

## Public API

- Package entrypoint: `@discord-bot/dnd5e-types`
- `main`: `./dist/index.js`
- `types`: `./dist/index.d.ts`
- `exports`:
  - `.` → `import: ./dist/index.js`, `types: ./dist/index.d.ts`

## Design Notes

- Internal workspace package (`private: true`) focused on types-only distribution.
- Exposes a single root export path.

## Usage

```bash
npm run build -w @discord-bot/dnd5e-types
```

Import from the package root entrypoint:

```ts
import { /* exported members */ } from '@discord-bot/dnd5e-types';
```

## Change History

- 2026-02-18: Standardized documentation addendum appended.
