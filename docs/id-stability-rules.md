# ID Stability Rules

Internal identifiers are the connective tissue of this codebase. They appear in data files, save data, dialogue sequences, world triggers, encounter tables, and NPC configs. Renaming or removing any id without a full audit is a breaking change.

---

## Why id stability matters

`GameState` is serialised to `localStorage` on every save. That data contains:
- Party member ids (`hugo`, `serelle_vaun`, `kael`)
- Equipment ids in `PartyMember.equipment.weapon` and `.armor`
- Item ids in `InventoryEntry.itemId`
- Story flag keys in `GameState.storyFlags`
- Location ids in `currentLocation.locationId`

If any of these ids change in code and a player loads an old save, the result is silent data corruption (wrong stats, missing equipment, flags never matching). This is why `SAVE_VERSION` exists — but bumping the version only signals that old saves should be discarded. It does not fix saves already on disk.

---

## Stable id categories

### Party member ids

Defined in: `data/characters/party-members.ts`
Stored in: `PartyMember.id` — serialised on every save

| Id | Status |
|----|--------|
| `hugo` | Stable — in save data |
| `serelle_vaun` | Stable — in save data |
| `kael` | Stable — in save data |

**Rule:** Never rename a party member id. Rename requires `SAVE_VERSION` bump plus migration logic or intentional invalidation.

---

### Story flag string values

Defined in: `data/story/story-events.ts` as `STORY_FLAGS` constants
Stored in: `GameState.storyFlags` as keys — serialised on every save

| Constant | String value | Status |
|----------|-------------|--------|
| `STORY_FLAGS.SERELLE_JOINED` | `serelle_joined` | Stable — in save data |
| `STORY_FLAGS.KAEL_JOINED` | `kael_joined` | Stable — in save data |
| `STORY_FLAGS.CHAPTER_1_COMPLETE` | `chapter_1_complete` | Stable — in save data |
| `STORY_FLAGS.BOSS_VEYR_DEFEATED` | `boss_veyr_defeated` | Stable — in save data |
| `STORY_FLAGS.THORNWOOD_CLEARED` | `thornwood_cleared` | Stable — in save data |
| `STORY_FLAGS.NORTH_PASS_UNLOCKED` | `north_pass_unlocked` | Reserved — not yet set |

**Rule:** The TypeScript constant names (e.g. `STORY_FLAGS.SERELLE_JOINED`) can be renamed freely. The string values they hold cannot — they are stored in save data.

**Rule:** Always access flags via `STORY_FLAGS.X`. Never use raw strings like `'serelle_joined'` in code.

---

### Item ids

Defined in: `data/items/items.ts`
Stored in: `InventoryEntry.itemId` — serialised when the item is in the player's inventory

| Id | Status |
|----|--------|
| `herb_tonic` | Stable — in save data |
| `clearwater_drop` | Stable — in save data |
| `healing_salve` | Stable — in save data |
| `ether_vial` | Stable — in save data |

**Rule:** Renaming an item id makes any existing inventory entry for that id an unknown item on load. Requires `SAVE_VERSION` bump.

---

### Equipment ids

Defined in: `data/equipment/equipment.ts`
Stored in: `PartyMember.equipment.weapon` and `PartyMember.equipment.armor` — serialised

| Id | Status |
|----|--------|
| `iron_sword` | Stable — in save data |
| `apprentice_rod` | Stable — in save data |
| `battle_axe` | Stable — in save data |
| `leather_vest` | Stable — in save data |
| `cloth_robe` | Stable — in save data |
| `iron_plate` | Stable — in save data |
| `steel_sword` | Stable — in save data |
| `war_axe` | Stable — in save data |
| `ice_scepter` | Stable — in save data |
| `chain_mail` | Stable — in save data |
| `mage_coat` | Stable — in save data |

**Rule:** An unknown equipment id at load time causes `resolveEffectiveStats()` to silently apply zero bonuses. Renaming requires `SAVE_VERSION` bump.

---

### Skill ids

Defined in: `data/skills/skills.ts`
Stored in: `PartyMember.skillIds` — serialised

Player character skill ids are in save data because `PartyMember.skillIds` is serialised. Enemy skill ids are not saved (enemies are built fresh from data definitions each battle).

| Id | Status |
|----|--------|
| `lightning_slash` | Stable — serialised in player skillIds |
| `ice_shard` | Stable — serialised in player skillIds |
| `flame_cleave` | Stable — serialised in player skillIds |
| `dark_bolt` | Safe to rename (enemy only, not in save) |
| `shadow_wave` | Safe to rename (enemy only, not in save) |
| `wisp_flare` | Safe to rename (enemy only, not in save) |

---

### Location ids

Defined in: `data/maps/locations.ts`
Stored in: `currentLocation.locationId` — serialised

| Id | Status |
|----|--------|
| `border_fields` | Stable — in save data |
| `lumen_town` | Stable — in save data |
| `north_pass` | Stable — in save data |
| `ashenveil_road` | Stable — in save data |
| `ashenveil_town` | Stable — in save data |
| `thornwood` | Stable — in save data |

**Rule:** An unknown location id at load time leaves the HUD label blank but does not crash. Still requires `SAVE_VERSION` bump because it indicates the `currentLocation` field has become inconsistent.

---

### Enemy ids

Defined in: `data/enemies/enemies.ts`
Not stored in save data — enemies are built from definitions at battle start.

| Id | Status |
|----|--------|
| `braxtion_soldier` | Safe to rename (data only) |
| `dark_acolyte` | Safe to rename (data only) |
| `ridge_fang` | Safe to rename (data only) |
| `shadecaster_veyr` | Safe to rename (data only) |
| `ashenveil_patrol` | Safe to rename (data only) |
| `thornwood_lurker` | Safe to rename (data only) |
| `corrupted_wisp` | Safe to rename (data only) |
| `grove_warden` | Safe to rename (data only) |

**Rule:** Enemy ids are safe to rename if all references in `encounter-tables.ts` and `world-map-config.ts` are updated together. No `SAVE_VERSION` bump required.

---

### Dialogue sequence ids

Defined as keys in the `DIALOGUE` object in `data/dialogue/dialogue-data.ts`.
Not stored in save data — referenced from data configs and init data at runtime.

**Rule:** Safe to rename if all references in town configs, world-map-config, and any `BattleInitData` intro/outro fields are updated together. No version bump required.

---

### Encounter zone ids

Defined as `id` fields in the `zones` array in `data/maps/world-map-config.ts`.
Must match keys in `ENCOUNTER_TABLES` in `data/maps/encounter-tables.ts`.
Not stored in save data.

**Rule:** Safe to rename if both `world-map-config.ts` and `encounter-tables.ts` are updated together.

---

### World trigger ids

Defined as `id` fields in the `triggers` array in `data/maps/world-map-config.ts`.
Not stored in save data. Currently used for internal reference only.

**Rule:** Safe to rename within `world-map-config.ts`.

---

## Procedure for unavoidable stable-id changes

When a save-data id absolutely must be renamed:

1. Increment `SAVE_VERSION` in `src/game/save/save-version.ts`
2. Add a row to the version history table in `save-version.ts` comments
3. Add a row to the version history table in `docs/change-log.md`
4. Update the id in its source definition file
5. Search all `.ts` files for any string literal of the old id and update them
6. Update the relevant table in this document
7. Note in the session output that save compatibility is broken

When renaming a data-only (non-save) id:

1. Update the id in its source definition file
2. Update all references in data config files
3. No version bump required
4. Note the rename in the session's change summary

---

## Adding new ids

| Addition | Version bump required? |
|----------|----------------------|
| New party member (`STARTING_PARTY` entry) | Yes — `PartyMember` added to serialised array |
| New item, skill, or enemy definition | No — definitions not stored; items only enter save data when added to inventory |
| New story flag constant | No — flags stored as `Record<string, boolean>`; new keys absent in old saves equal `false` |
| New location | No — unless the spawn location changes |
| New equipment definition | No — unless `EquipmentSlots` structure changes |
| New field in `GameState` or `PartyMember` | Yes — structure changed |
