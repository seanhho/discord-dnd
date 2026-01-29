# Encounter Persistence Model

This document describes the persistence model for D&D 5e combat encounters.

## Overview

The encounter persistence layer manages combat sessions in Discord contexts. It tracks:
- Encounter metadata and lifecycle
- Participant roster (PCs and NPCs)
- Initiative order and turn loop state
- Audit events for debugging

**IMPORTANT**: The encounter system does NOT manage character state. HP, conditions, AC, equipment, and other character attributes are stored separately in the character KV store and managed by `/char` commands.

## What Encounters Persist

### Encounter Entity
| Field | Description |
|-------|-------------|
| `id` | UUID primary key |
| `name` | Encounter name/description |
| `status` | Lifecycle: `setup`, `initiative`, `running`, `paused`, `ended` |
| `guildId` | Discord guild ID (null for DMs) |
| `channelId` | Discord channel ID |
| `threadId` | Discord thread ID (null if not in a thread) |
| `createdByDiscordUserId` | Audit field - who created the encounter (no permission meaning) |
| `round` | Current combat round (1-indexed) |
| `turnIndex` | Index into sorted participant list for current turn |
| `initiativeLocked` | Whether initiative order is locked |
| `createdAt` | Timestamp |
| `updatedAt` | Timestamp |

### Participant Entity
| Field | Description |
|-------|-------------|
| `id` | UUID primary key |
| `encounterId` | FK to encounter |
| `kind` | `pc` or `npc` |
| `displayName` | Name shown in initiative order |
| `initiative` | Initiative roll value (null until set) |
| `sortOrder` | Precomputed order for tie-breaking |
| `characterId` | FK to character (required for PCs, null for NPCs) |
| `discordUserId` | Convenience field for PCs |
| `npcRef` | Optional NPC reference ID/slug |
| `notes` | Optional notes for NPCs |

### Event Entity (Audit Log)
| Field | Description |
|-------|-------------|
| `id` | UUID primary key |
| `encounterId` | FK to encounter |
| `createdAt` | Timestamp |
| `actorDiscordUserId` | Who performed the action |
| `eventType` | Event type identifier |
| `payload` | JSON payload (no character state!) |

## What Encounters Do NOT Persist

The encounter system explicitly does NOT store:
- Character HP, max HP, or temporary HP
- Conditions (poisoned, stunned, etc.)
- Armor Class or other defenses
- Equipment or inventory
- Spell slots or resources
- Attack rolls, damage, or saving throw results
- Any stat block information for NPCs

All character state lives in the character KV store and is managed by the existing `/char` commands.

## Context Rules

### One Active Encounter Per Context
Only ONE non-ended encounter can exist per (guildId, channelId, threadId) context at a time. This is enforced by a partial unique index in SQLite.

- A channel can have one active encounter
- A thread in that channel can have its own separate active encounter
- Different channels can have concurrent active encounters

### Context Matching
When querying for an active encounter:
- All three fields (guildId, channelId, threadId) must match exactly
- Null values are matched explicitly (not as wildcards)

## Turn Loop Storage

### Design Choice: turn_index (Integer)

We store `turn_index` as an integer index into the sorted participant list rather than storing a `current_participant_id`. This approach:

**Advantages:**
- Simpler arithmetic for advancing turns (increment and wrap)
- Natural handling of participant removal (just re-query the list)
- No dangling references if a participant is removed

**Participant Ordering:**
Participants are sorted by:
1. `initiative` DESC (higher goes first)
2. `sort_order` ASC (for tie-breaking)

Null initiative values sort last.

### Advancing Turns
```typescript
// Get current combatant
const participants = await participantRepo.listParticipants(encounterId);
const current = participants[encounter.turnIndex];

// Advance to next turn
const nextIndex = (encounter.turnIndex + 1) % participants.length;
const advanceRound = nextIndex === 0;

await encounterRepo.updateEncounter(encounterId, {
  turnIndex: nextIndex,
  round: advanceRound ? encounter.round + 1 : encounter.round,
});
```

## NPCs

NPCs are represented with minimal identity only:
- `displayName` - What appears in initiative order
- `npcRef` - Optional reference ID for linking to external stat blocks
- `notes` - Optional DM notes

**No stat blocks are stored**. NPCs in encounters are "manual" - the DM tracks their HP, actions, etc. separately (either in their head, on paper, or in a future feature).

## Repository Methods

### EncounterRepo
```typescript
createEncounter({ name, guildId?, channelId, threadId?, createdByDiscordUserId })
getEncounter(encounterId)
getActiveEncounterByContext({ guildId?, channelId, threadId? })
updateEncounter(encounterId, patch)
endEncounter(encounterId)
listEncountersByContext({ guildId?, channelId, threadId? })
```

### EncounterParticipantRepo
```typescript
addPcParticipant({ encounterId, characterId, displayName?, discordUserId? })
addNpcParticipant({ encounterId, displayName, npcRef?, notes? })
removeParticipant(encounterId, participantId)
listParticipants(encounterId)
getParticipant(encounterId, participantId)
setInitiative(encounterId, participantId, initiative)
bulkSetInitiative(encounterId, entries)
reorderParticipants(encounterId, orderedParticipantIds)
```

### EncounterEventRepo
```typescript
appendEvent({ encounterId, actorDiscordUserId?, eventType, payload? })
listEvents(encounterId, limit?)
```

## Example Usage

```typescript
// Create an encounter
const encounter = await encounterRepo.createEncounter({
  name: 'Goblin Ambush',
  guildId: interaction.guildId,
  channelId: interaction.channelId,
  createdByDiscordUserId: interaction.user.id,
});

// Add participants
await participantRepo.addPcParticipant({
  encounterId: encounter.id,
  characterId: character.id,
});

await participantRepo.addNpcParticipant({
  encounterId: encounter.id,
  displayName: 'Goblin Chief',
});

// Set initiatives
await participantRepo.bulkSetInitiative(encounter.id, [
  { participantId: pcId, initiative: 15 },
  { participantId: npcId, initiative: 12 },
]);

// Lock initiative and start combat
await encounterRepo.updateEncounter(encounter.id, {
  status: 'running',
  initiativeLocked: true,
});

// Get current turn
const participants = await participantRepo.listParticipants(encounter.id);
const current = participants[encounter.turnIndex];
console.log(`It's ${current.displayName}'s turn!`);

// End encounter
await encounterRepo.endEncounter(encounter.id);
```

## DM Capability

Any user with DM capability can manage any encounter. The `createdByDiscordUserId` field is for audit purposes only and does not restrict access.

Check DM status using the existing `isDm(discordUserId)` function from the user system.
