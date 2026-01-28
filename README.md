# RPG Character Tracker Bot

A Discord bot for tracking your tabletop RPG characters. Create characters, manage their stats, and keep everything organized right in Discord.

---

## What This Bot Does

This bot helps you:
- **Create characters** with names and stats
- **Track ability scores** (Strength, Dexterity, etc.)
- **Manage hit points, armor class, and equipment**
- **Switch between multiple characters** with one command
- **Roll dice** for your game

Your characters are saved per server, so you can have different characters in different Discord servers.

---

## Getting Started

### For Players

No setup needed! Just start using the commands below. Your first character will be created automatically when you use `/char set`.

### For Server Admins

Invite the bot to your server using the invite link provided by the bot owner. The bot needs permission to:
- Read and send messages
- Use slash commands

---

## Characters Overview

### What is a Character?

A character stores your RPG character's stats — things like their name, class, level, ability scores, and equipment.

### One Active Character

You can have multiple characters, but one is your **active character**. When you use commands without specifying a name, they apply to your active character.

### Characters Are Per-Server

Each server has its own set of characters. Your "Gandalf" in one server is separate from "Gandalf" in another.

---

## Commands Guide

### `/roll` — Roll Dice

Roll dice for your game.

**Options:**
- `sides` — How many sides on the die (default: 20)
- `count` — How many dice to roll (default: 1)
- `modifier` — Number to add to the total (default: 0)
- `label` — Optional name for the roll

**Examples:**
```
/roll
→ Rolls 1d20

/roll sides:6 count:4
→ Rolls 4d6

/roll sides:20 modifier:5 label:Attack Roll
→ Rolls 1d20+5 labeled "Attack Roll"
```

---

### `/char set` — Create or Update a Character

Create a new character or update an existing one's stats.

**How to use:**
```
/char set name:CharacterName attributes:{key:value, key:value}
```

**Example — Create a new character:**
```
/char set name:Gandalf attributes:{class:"Wizard", level:20}
```

**Example — Set ability scores:**
```
/char set name:Gandalf attributes:{str:10, dex:14, con:14, int:20, wis:18, cha:16}
```

**Example — Set hit points:**
```
/char set name:Gandalf attributes:{hp.max:102, hp.current:102, ac:12}
```

**Output:**
```
Updated "Gandalf"

Changes:
  class: — → "Wizard"
  level: — → 20

Computed:
  Proficiency Bonus: +6
```

**Tips:**
- If the character doesn't exist, it's created automatically
- You can set multiple stats in one command
- Use quotes around text values: `class:"Wizard"`
- Numbers don't need quotes: `level:20`

---

### `/char show` — View Character Information

See your character's stats.

**Basic usage:**
```
/char show
→ Shows your active character

/char show name:Gandalf
→ Shows Gandalf specifically
```

**Views:**

| View | What it shows |
|------|---------------|
| (none) | Summary of key stats |
| `stats` | Ability scores with modifiers |
| `hp` | Hit points, AC, speed |
| `equipment` | Weapons and gear |
| `attacks` | Attack calculations |
| `all` | Everything |
| `help` | List of all available stat keys |
| `template` | Copy-paste examples |
| `characters` | All your characters in this server |
| `active` | Just the active character's name |

**Examples:**
```
/char show view:stats
→ Shows ability scores

/char show view:characters
→ Lists all your characters

/char show view:help
→ Shows what keys you can set
```

---

### `/char active` — Switch Active Character

Change which character is your default.

**Usage:**
```
/char active name:Gandalf
```

**Output:**
```
Active character set to "Gandalf"
```

Now when you use `/char show` without a name, it shows Gandalf.

---

### `/char get` — Get Specific Stats

Retrieve particular attributes from your character.

**Options:**
- `name` — Character name (optional, defaults to active)
- `keys` — Space-separated list of stats to get
- `prefix` — Get all stats starting with this prefix
- `computed` — Include calculated values like modifiers

**Examples:**
```
/char get keys:str dex con
→ Shows Strength, Dexterity, Constitution

/char get prefix:weapon
→ Shows all weapon stats

/char get keys:str computed:true
→ Shows Strength and its modifier
```

---

### `/char unset` — Remove Stats

Remove attributes from a character.

**Usage:**
```
/char unset keys:hp.current hp.temp
```

**Example:**
```
/char unset keys:weapon.primary.name weapon.primary.damage
```

**Output:**
```
Gandalf - Attributes removed
Removed: weapon.primary.name, weapon.primary.damage
Remaining attributes: 8
```

---

## Common Workflows

### Create Your First Character

```
/char set name:Thorin attributes:{class:"Fighter", level:5, str:18, dex:12, con:16, int:10, wis:13, cha:14}
```

### Check Your Stats

```
/char show
```

### Update After Leveling Up

```
/char set name:Thorin attributes:{level:6, hp.max:58}
```

### Take Damage

```
/char set name:Thorin attributes:{hp.current:42}
```

### Switch Characters

```
/char active name:Bilbo
```

### See All Your Characters

```
/char show view:characters
```

---

## Available Stats

### Identity
- `name` — Character name
- `class` — Class (Fighter, Wizard, etc.)
- `level` — Level (1-20)

### Ability Scores (1-30)
- `str` — Strength
- `dex` — Dexterity
- `con` — Constitution
- `int` — Intelligence
- `wis` — Wisdom
- `cha` — Charisma

### Combat
- `hp.max` — Maximum hit points
- `hp.current` — Current hit points
- `ac` — Armor class (1-50)
- `speed` — Movement speed in feet

### Weapon
- `weapon.primary.name` — Weapon name
- `weapon.primary.damage` — Damage dice (e.g., "1d8+3")
- `weapon.primary.proficient` — true/false

### Custom Stats

You can add any stat you want! Unknown stats are saved as text.

```
/char set name:Gandalf attributes:{backstory:"Grey wizard from Valinor"}
```

---

## Tips & Gotchas

### Character Names Are Case-Insensitive

`Gandalf`, `GANDALF`, and `gandalf` all refer to the same character.

### Set an Active Character

Many commands default to your active character. If you haven't set one, you'll need to specify `name:` each time.

### Use Quotes for Text

Text values need quotes:
- Correct: `class:"Wizard"`
- Wrong: `class:Wizard` (will still work, but quotes are safer for text with spaces)

### Numbers Don't Need Quotes

- Correct: `level:5`
- Also works: `level:"5"` (converted automatically)

### Computed Values Are Automatic

You don't need to enter ability modifiers or proficiency bonus — they're calculated from your ability scores and level.

---

## Quick Reference

| Command | What it does |
|---------|--------------|
| `/roll` | Roll dice |
| `/char set name:X attributes:{...}` | Create/update character |
| `/char show` | View character stats |
| `/char show view:characters` | List all characters |
| `/char active name:X` | Switch active character |
| `/char get keys:X Y Z` | Get specific stats |
| `/char unset keys:X Y Z` | Remove stats |

---

## Need Help?

- Use `/char show view:help` to see all available stat keys
- Use `/char show view:template` for copy-paste examples
- Report issues to your server admin or the bot maintainer
