# Architecture Reference

This document describes the module structure, data flow, and key rules for the Saga of the Lightning Warrior codebase.

---

## Guiding principles

- **Scene files render and route. Modules calculate.** Phaser scenes handle layout, input capture, and scene transitions. All game rules (damage, turn order, stat growth, save serialization, encounter rolls) live in pure TypeScript modules with no Phaser dependency.
- **Content lives in data files.** Characters, enemies, skills, items, equipment, locations, encounter tables, and dialogue are all defined in `src/game/data/`. Scenes never hardcode content.
- **State mutations go through state-actions.** The singleton `GameState` in `game-state.ts` is never mutated directly outside of `state-actions.ts`.
- **Systems communicate through clean contracts.** The world scene asks the encounter system whether to fire a battle. The battle scene returns a result code. Neither knows the internals of the other.
- **Save format changes require a version bump.** See the Save system section below.

---

## Module map

### `core/`

| File | Purpose |
|------|---------|
| `config.ts` | Game dimensions (1280×720), color palette, font stacks, font sizes, panel defaults |
| `scene-keys.ts` | String constants for every Phaser scene key |
| `events.ts` | Global event name constants (currently minimal) |
| `input.ts` | Shared input key constants |
| `scene-router.ts` | Utility: resolves which scene to return to after a modal |
| `utils.ts` | Small shared utilities |
| `scenes/BootScene.ts` | Entry point — immediately starts PreloadScene |
| `scenes/PreloadScene.ts` | Loads all static assets (digit spritesheets, UI art) before TitleScene |

### `state/`

| File | Purpose |
|------|---------|
| `game-state-types.ts` | All runtime state types: `GameState`, `PartyMember`, `InventoryEntry`, `EquipmentSlots`, `StoryFlags`, `WorldPosition` |
| `game-state.ts` | Module-level singleton `GameState` object and `getGameState()` accessor |
| `state-actions.ts` | All state mutations: `newGame()`, `addGold()`, `addItem()`, `removeItem()`, `updatePartyMemberHP()`, `activatePartyMember()`, `applyBattleXp()`, `setStoryFlag()`, etc. |
| `state-selectors.ts` | Read-only derivations from state: `getActiveParty()`, `getInventory()`, `getGold()`, `getStoryFlag()` |

**Rule:** `state-actions.ts` is the only file allowed to write to `GameState`. All other modules call actions or read via selectors.

### `save/`

| File | Purpose |
|------|---------|
| `save-types.ts` | `SaveData` type (`{ version, timestamp, state }`), `SAVE_SLOT_KEY` constant |
| `save-service.ts` | `saveGame()`, `loadGame()`, `hasSave()` — only file that touches `localStorage` |
| `save-version.ts` | `SAVE_VERSION` constant with full version history in comments |

**Save version history:**

| Version | Change |
|---------|--------|
| 1 | Initial structure |
| 2 | `PartyMember` gained `colorHex: number` |
| 3 | `PartyMember` gained `level` and `xp`; `EnemyDef` gained `xpReward` (not serialized) |
| 4 | `xp` semantics changed from remainder to total lifetime XP — intentionally invalidated |
| 5 | `PartyMember` gained `equipment: EquipmentSlots` |

When adding or removing fields from `GameState` or `PartyMember`, increment `SAVE_VERSION` and add a row here.

### `data/`

All files are pure TypeScript — no Phaser, no state imports.

| Path | Contents |
|------|---------|
| `characters/party-members.ts` | `HUGO`, `SERELLE`, `KAEL`, `STARTING_PARTY` |
| `characters/level-growth.ts` | XP threshold table, stat growth profiles per character, `levelFromXp()`, `applyStatGrowth()` |
| `enemies/enemies.ts` | `ENEMIES` record — all `EnemyDef` objects |
| `skills/skills.ts` | `SKILLS` record — all `SkillDef` objects |
| `items/items.ts` | `ITEMS` record — all `ItemDef` objects |
| `equipment/equipment.ts` | `EQUIPMENT` record — all `EquipmentDef` objects |
| `equipment/equipment-system.ts` | `resolveEffectiveStats(member)` — applies equipment bonuses over base stats at battle time |
| `maps/locations.ts` | `LOCATIONS` record — all `LocationDef` objects |
| `maps/world-map-config.ts` | World map triggers and encounter zones (positions, flags, scripted battles) |
| `maps/lumen-town-config.ts` | Lumen Town NPC and building layout |
| `maps/ashenveil-town-config.ts` | Ashenveil NPC and building layout |
| `maps/encounter-tables.ts` | `ENCOUNTER_TABLES` — per-zone enemy groups, weights, encounter chance |
| `dialogue/dialogue-data.ts` | `DIALOGUE` record — all `DialogueSequence` objects |
| `story/story-events.ts` | `STORY_FLAGS` constants — all flag id strings |

### `world/`

| File | Purpose |
|------|---------|
| `scenes/WorldMapScene.ts` | World map rendering, player movement, zone tracking, encounter checks, trigger detection, scene transitions |
| `systems/encounter-system.ts` | `EncounterTracker` class — step counting, cooldown, `onMove()` → returns enemy group or null |
| `systems/movement-system.ts` | Player movement physics, collision |
| `systems/transition-system.ts` | Fade-based scene transition helper |
| `types/world-types.ts` | `WorldZone`, `WorldTrigger`, `ScriptedBattle`, `WorldMapConfig`, `WorldMapInitData` |

**Encounter flow:**
1. `WorldMapScene.update()` calls `updateEncounters(dt)` each frame.
2. `getActiveZone(px, py, zones)` returns the highest-priority zone at the player's position.
3. If the zone is type `'encounter'`, `EncounterTracker.onMove(distance, table)` accumulates steps and rolls against `table.chancePerStep` after `table.minStepsBeforeEncounter` safe steps.
4. On a hit, `WorldMapScene` launches `BattleScene` with `returnSceneKey = SCENE_KEYS.WORLD_MAP` and `returnX/returnY` set to the player's current pixel position.
5. `BattleScene` starts the world map back at those coordinates when it exits.

**Scripted battle flow:**
A `WorldTrigger` with a `scriptedBattle` field carries the full battle spec in data (enemy ids, background, dialogue ids, `requiresFlag`, `consumedByFlag`). `WorldMapScene` reads this and launches `BattleScene` with `isBoss: true`. When the battle ends and `consumedByFlag` is set, the trigger silently does nothing on subsequent visits.

### `town/`

| File | Purpose |
|------|---------|
| `scenes/TownScene.ts` | Town rendering, NPC placement, player movement, interaction dispatch |
| `systems/interaction-system.ts` | Proximity detection — determines which interactable the player is near |
| `systems/npc-system.ts` | Resolves NPC dialogue sequence given current story flags (dialogueOverrides) |
| `systems/shop-service.ts` | `purchaseItem()`, `purchaseEquipment()` — validates gold, updates inventory, auto-equips |
| `types/town-types.ts` | `TownConfig`, `TownInteractable`, `TownNpc` |

Towns never trigger encounters. The `TownScene` has no encounter code.

### `battle/`

| File | Purpose |
|------|---------|
| `scenes/BattleScene.ts` | Battle rendering, phase state machine, input, floating numbers, result panel |
| `engine/battle-types.ts` | `Combatant`, `BattleCommand`, `BattleEvent`, `BattleInitData`, `BattleResult` |
| `engine/turn-order.ts` | `buildTurnOrder(combatants)` — sorts by speed, returns ordered id array |
| `engine/battle-actions.ts` | `resolveAction(command, combatants)` — applies command, returns `BattleEvent[]` |
| `engine/damage.ts` | Damage formula: `(attack or magic * scale * skillPower) - defense`, floor 1 |
| `engine/enemy-ai.ts` | `pickEnemyAction(enemy, allies)` — weighted random choice (attack / skill) |
| `engine/battle-result.ts` | `checkOutcome(combatants)` → `'victory' | 'defeat' | 'ongoing'`; `buildResult()` → gold/XP totals |
| `engine/xp-system.ts` | `splitXp(total, count)` — deterministic remainder distribution; `processMemberXp()` |

**Battle state machine phases:**
`start` → `player_command` → `skill_select` → `item_select` → `target_select` → `resolving` → `end`

ESC from `target_select` returns to whichever menu opened it (`skill_select`, `item_select`, or `player_command`), tracked via `targetReturnPhase`.

**Equipment in battle:**
`buildCombatants()` in `BattleScene` calls `resolveEffectiveStats(member)` from `equipment-system.ts` for every ally. Equipment bonuses are baked into the `Combatant` struct at battle start. The engine modules never touch `equipment-system.ts` directly.

### `dialogue/`

| File | Purpose |
|------|---------|
| `DialogueOverlay.ts` | Phaser scene launched in parallel with any gameplay scene; renders dialogue box art, portrait placeholder, speaker name, body text, continue prompt |
| `dialogue-types.ts` | `DialogueLine`, `DialogueSequence`, `SpeakerId`, `EventEffect` types |
| `event-handler.ts` | `runEffects(effects)` — executes `EventEffect[]` (set_flag, activate_party_member, add_gold, add_item) via state-actions |

`DialogueOverlay` emits `'complete'` on its event emitter when the last line is acknowledged. The host scene (world, town, battle) registers a one-time listener and proceeds.

### `ui/`

| File | Purpose |
|------|---------|
| `common/panel.ts` | `drawPanel(scene, opts)` — draws a bordered rounded rectangle; returns the `Graphics` object so callers can add it to a Container |
| `title/TitleScene.ts` | Title screen — New Game / Load Game menu, keyboard navigation, save detection |

### `shared/`

| File | Purpose |
|------|---------|
| `constants/player.ts` | `PLAYER_W = 28`, `PLAYER_H = 36` — shared between world and town scenes |

---

## Asset loading

All assets are loaded in `PreloadScene`. Nothing is loaded lazily at runtime.

| Key | File | Used by |
|-----|------|---------|
| `damage-digits` | `images/damage-digits.png` | BattleScene — fire-styled digit sprites for damage popups |
| `heal-digits` | `images/heal-digits.png` | BattleScene — green-glow digit sprites for heal popups |
| `dialogue-box` | `ui/dialogue-box.png` | DialogueOverlay — background art (1536×1024 → displayed 1200×521) |
| `result-panel` | `ui/result-panel.png` | BattleScene endBattle — result screen background (1536×1024 → displayed 920×613) |
| `btn-normal` | `ui/btn-normal.png` | BattleScene — command button, default state |
| `btn-selected` | `ui/btn-selected.png` | BattleScene — command button, selected state |
| `btn-disabled` | `ui/btn-disabled.png` | BattleScene — command button, dimmed (no MP / empty inventory) |
| `btn-pressed` | `ui/btn-pressed.png` | BattleScene — command button, pressed state (reserved for confirm feedback) |

All button art source is 624×256. Displayed at 290×52 (stretched) per row. Labels are code-rendered on top.

---

## Adding content

### New party member
1. Add `PartyMember` object to `data/characters/party-members.ts` and include in `STARTING_PARTY` (with `isActive: false`).
2. Add a stat growth profile in `data/characters/level-growth.ts`.
3. Add a story flag constant in `data/story/story-events.ts`.
4. Add an `EventEffect` of type `activate_party_member` to the relevant dialogue sequence's `onComplete`.
5. Add the speaker appearance in `dialogue/DialogueOverlay.ts` → `getSpeakerAppearance()` and `formatSpeakerName()`.
6. No scene changes required.

### New enemy
1. Add `EnemyDef` to `data/enemies/enemies.ts`.
2. Add the enemy id to one or more encounter groups in `data/maps/encounter-tables.ts` (random encounters) or to a `ScriptedBattle.enemyIds` array in a world map trigger (scripted battle).

### New skill
1. Add `SkillDef` to `data/skills/skills.ts`. Set `scalingStat: 'attack' | 'magic'` explicitly if the element heuristic would give the wrong result.
2. Add the skill id to the relevant `PartyMember.skillIds` in `data/characters/party-members.ts` or to an `EnemyDef.skillIds` in `data/enemies/enemies.ts`.

### New item
1. Add `ItemDef` to `data/items/items.ts`.
2. Add the item to the relevant town shop stock in `data/maps/lumen-town-config.ts` or `data/maps/ashenveil-town-config.ts`.

### New equipment
1. Add `EquipmentDef` to `data/equipment/equipment.ts`.
2. Add to shop stock in the relevant town config.

### New location / town
1. Add `LocationDef` to `data/maps/locations.ts`.
2. Create a new `*-town-config.ts` in `data/maps/`.
3. Add a `WorldTrigger` in `data/maps/world-map-config.ts` pointing at the new location.
4. `TownScene` reads any config that follows the `TownConfig` shape — no scene changes needed for a new town.

### New encounter zone
1. Add a zone entry to the `zones` array in `data/maps/world-map-config.ts` with `type: 'encounter'` and a bounding rect.
2. Add a matching `EncounterTable` in `data/maps/encounter-tables.ts`.

### New dialogue sequence
1. Add a `DialogueSequence` to `data/dialogue/dialogue-data.ts`. Give it a unique string key.
2. Reference the key from a `WorldTrigger.dialogueId`, an NPC's `dialogueId`, or a `ScriptedBattle.introDialogueId` / `outroDialogueId`.

---

## What is not yet implemented

These are items from the original design spec that do not exist in the current build and have not been started:

- Portrait sprite art (placeholder ellipses are used)
- Tile-based map rendering (positions are pixel-based with no tile grid)
- Pause menu overlay
- Multiple save slots (one slot only)
- XP display in the party status panel during battle (level is shown per member; XP progress toward next level is not)
- Branching dialogue choices
- Multiple chapters beyond Chapter 1 content
- Controller input

---

## Known issues

These are confirmed bugs deferred from earlier review passes. They do not crash the game but should be fixed before the codebase grows significantly.

**`refreshStatusPanel` panel background leak** — *(fixed in audit cleanup pass)*
Was: `drawPanel()` was called inside `refreshStatusPanel()` without adding the returned `Graphics` to the container, causing one leaked GPU-backed object per battle action. Fix: `const bg = drawPanel(...); this.statusPanel.add(bg)`.

**Stale comment in `BattleScene.ts` result section** — `src/game/battle/scenes/BattleScene.ts` around the XP result panel block contains a comment that says "All active members receive the same XP pool". This predates the XP split system. The comment is misleading but has no runtime effect. Correct it when next editing that section.

