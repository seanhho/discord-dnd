# @discord-bot/dnd5e

D&D 5e rules engine, data, and adapters for the Discord bot monorepo.

## Purpose

This package implements D&D 5e game mechanics including:

- **Rules**: Proficiency bonuses, ability modifiers, attack/damage rolls, skill checks, AC calculations
- **Engine**: Dice rolling, modifier stacks, explanation string builders
- **Data**: Curated weapon and armor lists
- **Adapters**: Convert KV storage format to rule-compatible types

## What's Implemented

### Rules

| Rule | Function | Description |
|------|----------|-------------|
| Proficiency | `proficiencyBonusForLevel(level)` | +2 to +6 based on level |
| Ability Mod | `abilityMod(score)` | `floor((score-10)/2)` |
| Skill Check | `computeSkillBonus(char, skill)` | Ability + proficiency/expertise |
| Skill Roll | `rollSkillCheck(rng, char, skill, adv)` | d20 + skill bonus |
| Attack Bonus | `computeAttackBonus(char, weapon)` | Ability + prof + weapon bonus |
| Attack Roll | `rollAttack(rng, char, weapon, adv)` | d20 + attack bonus, crit detection |
| Damage Roll | `rollDamage(rng, char, weapon, crit)` | Weapon dice + ability mod |
| Armor Class | `computeArmorClass(char, armor?, shield?)` | Base + DEX (with armor caps) |

### Explain Strings

All computation functions return an `explain` string showing the breakdown:

```
+3 (STR mod) +3 (Proficiency) = +6
```

### Data

**Weapons:** Greataxe, Longsword, Dagger, Shortbow, Rapier, Handaxe

**Armors:** Leather, Studded Leather, Chain Shirt, Scale Mail, Half Plate, Chain Mail, Plate, Shield

## Usage

### Computing Attack Bonus

```typescript
import {
  computeAttackBonus,
  rollAttack,
  LONGSWORD,
  type Character5eSnapshot,
} from '@discord-bot/dnd5e';

const character: Character5eSnapshot = {
  name: 'Fighter',
  level: 5,
  abilityScores: { str: 16, dex: 14, con: 12, int: 10, wis: 13, cha: 8 },
};

// Get static bonus
const bonus = computeAttackBonus(character, LONGSWORD);
console.log(bonus.total);   // 6 (STR +3 + Prof +3)
console.log(bonus.explain); // "+3 (STR mod) +3 (Proficiency) = +6"

// Roll attack with advantage
const result = rollAttack(character, LONGSWORD, 'advantage');
console.log(result.total);   // e.g., 23
console.log(result.isCrit);  // true if natural 20
console.log(result.explain); // "d20 [8, 17] (ADV: 17) + 6 = 23"
```

### Computing Skill Check

```typescript
import {
  computeSkillBonus,
  rollSkillCheck,
  type Character5eSnapshot,
} from '@discord-bot/dnd5e';

const rogue: Character5eSnapshot = {
  name: 'Rogue',
  level: 5,
  abilityScores: { str: 10, dex: 18, con: 12, int: 14, wis: 10, cha: 12 },
  skillProficiencies: {
    stealth: 'expertise',
    perception: 'proficient',
  },
};

const stealthBonus = computeSkillBonus(rogue, 'stealth');
console.log(stealthBonus.total); // 10 (DEX +4 + Expertise +6)

const result = rollSkillCheck(rogue, 'stealth');
console.log(result.explain); // "d20 (15) + 10 = 25"
```

### Computing Armor Class

```typescript
import {
  computeArmorClass,
  CHAIN_MAIL,
  SHIELD,
  type Character5eSnapshot,
} from '@discord-bot/dnd5e';

const fighter: Character5eSnapshot = {
  name: 'Fighter',
  level: 5,
  abilityScores: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
};

const ac = computeArmorClass(fighter, CHAIN_MAIL, SHIELD);
console.log(ac.total);   // 18 (Chain Mail 16 + Shield 2)
console.log(ac.explain); // "+16 (Chain Mail) +2 (Shield) = +18"
```

### Using Adapters with KV Storage

```typescript
import {
  kvToCharacterSnapshot,
  extractEquippedItems,
  computeAttackBonus,
  type KVRecord,
} from '@discord-bot/dnd5e';

// KV data from persistence layer
const kv: KVRecord = {
  name: { t: 's', v: 'Aragorn' },
  level: { t: 'n', v: 8 },
  str: { t: 'n', v: 16 },
  dex: { t: 'n', v: 14 },
  con: { t: 'n', v: 14 },
  int: { t: 'n', v: 12 },
  wis: { t: 'n', v: 13 },
  cha: { t: 'n', v: 10 },
  'skill.athletics': { t: 's', v: 'proficient' },
  'equip.weapon.main': { t: 's', v: 'longsword' },
  'inv.longsword.name': { t: 's', v: 'Longsword' },
  'inv.longsword.type': { t: 's', v: 'weapon' },
  'inv.longsword.damage': { t: 's', v: '1d8' },
};

// Convert to snapshot
const result = kvToCharacterSnapshot(kv);
if (result.success) {
  const { snapshot } = result;

  // Extract equipped weapon
  const equipped = extractEquippedItems(kv);
  if (equipped.mainWeapon) {
    const attack = computeAttackBonus(snapshot, equipped.mainWeapon);
    console.log(attack.total);
  }
}
```

## Dependency Rules

| Package | Can Import dnd5e-types? | Can Import dnd5e? |
|---------|------------------------|-------------------|
| @discord-bot/persistence | ✅ Yes | ❌ No |
| Bot features | ✅ Yes | ✅ Yes |
| @discord-bot/dnd5e | ✅ Yes | N/A |

**Important:** The persistence layer should only import from `@discord-bot/dnd5e-types` to maintain clean separation. Rule logic should not leak into the persistence layer.

## Directory Structure

```
packages/dnd5e/src/
├── index.ts           # Main exports
├── types.ts           # Internal types (Character5eSnapshot, Weapon5e, etc.)
├── rules/
│   ├── proficiency.ts # Proficiency bonus
│   ├── ability.ts     # Ability modifiers
│   ├── checks.ts      # Skill/ability checks
│   └── combat/
│       ├── attack.ts  # Attack rolls
│       ├── damage.ts  # Damage rolls
│       └── ac.ts      # Armor class
├── engine/
│   ├── rng.ts         # Random number generation
│   ├── dice.ts        # Dice parsing and rolling
│   ├── modifiers.ts   # Modifier stack
│   └── explain.ts     # Explanation string builders
├── data/
│   ├── equipment/
│   │   ├── weapons.ts # Curated weapon list
│   │   └── armors.ts  # Curated armor list
│   ├── skills.ts      # Skill utilities
│   └── conditions.ts  # Condition info
└── adapters/
    ├── kvCharacter.ts     # KV → Character5eSnapshot
    └── equipmentSlots.ts  # KV → Weapon5e/Armor5e
```

## Development

```bash
# Build
npm run build -w @discord-bot/dnd5e

# Test
npm run test -w @discord-bot/dnd5e

# Run all tests from root
npm test
```

## Testing with Deterministic RNG

For testing, use the mock RNG:

```typescript
import { createMockRNG, rollAttack, LONGSWORD } from '@discord-bot/dnd5e';

const rng = createMockRNG([20, 15]); // Will return 20, then 15
const result = rollAttack(character, LONGSWORD, 'none', {}, rng);
expect(result.chosenRoll).toBe(20);
expect(result.isCrit).toBe(true);
```
