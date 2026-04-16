# Architecture Reference

Primary technical reference for the codebase. Read `CLAUDE.md` for the working rules that govern how to apply this architecture.

---

## Core principles

**Scenes render and route. Modules calculate.**
Scene files handle layout, input, and transitions. All game rules live in pure TypeScript modules with no Phaser dependency.

**Content lives in data files.**
Characters, enemies, skills, items, equipment, locations, encounter tables, and dialogue are in `src/game/data/`. Scenes never hardcode content.

**State mutations go through state-actions.**
The singleton `GameState` is never mutated directly outside of `state-actions.ts`.

**Systems communicate through clean contracts.**
The world scene asks the encounter system whether to fire a battle. The battle scene returns a result code. Neither knows the internals of the other.

**Save format changes require a version bump.**
Any field change to `GameState`, `PartyMember`, `InventoryEntry`, or `EquipmentSlots` must increment `SAVE_VERSION` and be documented in `docs/change-log.md`.

---

## Module map

### `src/main.ts`
Application entry point. Constructs the Phaser game instance and registers all scenes. `PauseMenuOverlay` is reserved in scene-keys but not registered — add it when implemented.

---

### `core/`

| File | Purpose |
|------|---------|
| `config.ts` | Game dimensions (1280×720), colour palette (`COLORS`, `COLOR_HEX`), font stacks (`FONTS`), font sizes (`FONT_SIZES`), panel defaults (`PANEL`), Phaser base config |
| `scene-keys.ts` | `SCENE_KEYS` constant object and `SceneKey` union type |
| `events.ts` | Global event name constants |
| `input.ts` | Shared input key constants |
| `scene-router.ts` | Utility: resolves which scene to return to after a modal |
| `utils.ts` | Small shared helpers |
| `scenes/BootScene.ts` | Entry point — immediately transitions to `PreloadScene` |
| `scenes/PreloadScene.ts` | Loads all static assets before `TitleScene`. All `this.load.*` calls go here — nothing is loaded lazily. |

---

### `state/`

| File | Purpose |
|------|---------|
| `game-state-types.ts` | All runtime state types: `GameState`, `PartyMember`, `CharacterStats`, `InventoryEntry`, `EquipmentSlots`, `StoryFlags`, `WorldPosition` |
| `game-state.ts` | Module-level singleton `GameState` object and `getState()` / `patchState()` / `setState()` / `resetState()` accessors |
| `state-actions.ts` | All state mutations. The only file that writes to `GameState`. Key exports: `initNewGame`, `activatePartyMember`, `updatePartyMemberHP`, `restorePartyFull`, `addGold`, `spendGold`, `addItem`, `removeItem`, `setStoryFlag`, `setCurrentLocation`, `applyBattleXp`, `equipItem`, `loadStateFromSave` |
| `state-selectors.ts` | Read-only derivations: `getActiveParty`, `getInventory`, `getGold`, `getStoryFlag`, `getStoryFlags`, `getItemQuantity`, `getParty` |

**Note:** `state-actions.ts` imports `splitXp` and `processMemberXp` from `battle/engine/xp-system`. This is a deliberate documented exception — XP splitting is a stateless calculation that belongs logically in the battle engine but must be applied to global state. No reverse dependency exists.

---

### `save/`

| File | Purpose |
|------|---------|
| `save-types.ts` | `SaveData` type `{ version, timestamp, state }` and `SAVE_SLOT_KEY` constant |
| `save-service.ts` | `saveGame()`, `loadGame()`, `hasSaveData()`, `deleteSave()`, `getSaveMeta()` — the only file that touches `localStorage` |
| `save-version.ts` | `SAVE_VERSION = 5` with full version history in comments |

**Version history:**

| Version | Change |
|---------|--------|
| 1 | Initial structure |
| 2 | `PartyMember` gained `colorHex` |
| 3 | `PartyMember` gained `level` and `xp` |
| 4 | `xp` semantics changed to lifetime total — intentional invalidation |
| 5 | `PartyMember` gained `equipment: EquipmentSlots` |

---

### `data/`

All files are pure TypeScript — no Phaser, no `localStorage`. No import from `core/scene-keys`.

| Path | Contents |
|------|---------|
| `characters/party-members.ts` | `HUGO`, `SERELLE`, `KAEL`, `STARTING_PARTY` |
| `characters/level-growth.ts` | XP threshold table, stat growth profiles, `levelFromXp()`, `applyStatGrowth()` |
| `enemies/enemies.ts` | `ENEMIES` record — all `EnemyDef` objects |
| `skills/skills.ts` | `SKILLS` record — all `SkillDef` objects |
| `items/items.ts` | `ITEMS` record — all `ItemDef` objects |
| `equipment/equipment.ts` | `EQUIPMENT` record — all `EquipmentDef` objects |
| `equipment/equipment-system.ts` | `resolveEffectiveStats(member)` — applies equipment bonuses over base stats. Pure, no mutations. |
| `maps/locations.ts` | `LOCATIONS` record — all `LocationDef` objects |
| `maps/world-map-config.ts` | `BORDER_FIELDS_CONFIG` — world map triggers, zones, collision, player spawn |
| `maps/lumen-town-config.ts` | `LUMEN_TOWN_CONFIG` — Lumen Town layout, NPCs, interactables |
| `maps/ashenveil-town-config.ts` | `ASHENVEIL_TOWN_CONFIG` — Ashenveil layout, NPCs, interactables |
| `maps/encounter-tables.ts` | `ENCOUNTER_TABLES` — per-zone enemy groups, weights, step thresholds |
| `dialogue/dialogue-data.ts` | `DIALOGUE` record — all `DialogueSequence` objects |
| `story/story-events.ts` | `STORY_FLAGS` constants — all flag id strings |

---

### `shared/`

| File | Purpose |
|------|---------|
| `constants/player.ts` | `PLAYER_W = 28`, `PLAYER_H = 36` — used by world and town scenes |
| `movement-system.ts` | `computeMovement()` — pure movement + axis-separated collision. No Phaser. Defines `Rect` (re-exported from `world/types/world-types.ts`). Used by both `WorldMapScene` and `TownScene`. |

---

### `world/`

| File | Purpose |
|------|---------|
| `scenes/WorldMapScene.ts` | Rendering, player movement, zone tracking, encounter rolls, trigger detection, scene transitions. Player speed: 200 px/sec. |
| `systems/encounter-system.ts` | `EncounterTracker` — step counting (32 px/step), cooldown, `onMove()` returns enemy group or null. Also `getActiveZone()`, `pickEncounterGroup()`. |
| `systems/transition-system.ts` | `getActiveTrigger()` — checks player position against all triggers |
| `types/world-types.ts` | `Rect` (re-exported from `shared/movement-system`), `MapSceneKey`, `WorldZone`, `ScriptedBattle`, `WorldTrigger`, `WorldMapConfig`, `WorldMapInitData` |

**Encounter flow:**
1. `WorldMapScene.update()` calls `updateEncounters(dt)` each frame
2. `getActiveZone()` returns the first zone containing the player's centre
3. If zone is `'encounter'`, `EncounterTracker.onMove(distance, table)` accumulates steps and rolls
4. On hit: `WorldMapScene` fades out and starts `BattleScene` with `returnSceneKey` and `returnX/Y`
5. `BattleScene` restarts the world map at those coordinates when it exits

**Scripted battle flow:**
A `WorldTrigger` with a `scriptedBattle` field carries the full battle spec (enemy ids, background, dialogue ids, flag guards). `WorldMapScene` reads this and launches `BattleScene`. `consumedByFlag` prevents re-triggering once set.

---

### `town/`

| File | Purpose |
|------|---------|
| `scenes/TownScene.ts` | Town rendering, movement (180 px/sec), NPC placement, interaction dispatch, inn/shop/save modals |
| `systems/interaction-system.ts` | `getNearbyInteractable()`, `isInExitZone()` |
| `systems/npc-system.ts` | `resolveNpcDialogueId()` — returns the appropriate dialogue id given current story flags |
| `systems/shop-service.ts` | `purchaseItem()`, `purchaseEquipment()`, `isEquipmentId()`, `getInnRestCost()` |
| `types/town-types.ts` | `TownMapConfig`, `TownInteractable`, `TownNpc` |

Towns have zero encounter code. `TownScene` accepts any valid `TownMapConfig`.

---

### `battle/`

| File | Purpose |
|------|---------|
| `scenes/BattleScene.ts` | Battle rendering, phase state machine, input, floating number popups, result panel |
| `engine/battle-types.ts` | `Combatant`, `BattleCommand`, `BattleEvent` variants, `BattleResult`, `BattleInitData` |
| `engine/turn-order.ts` | `buildTurnOrder(combatants)` — sorted by speed, tiebroken ally-first then alphabetical |
| `engine/battle-actions.ts` | `resolveAction(command, combatants)` — applies command, mutates combatants, returns `BattleEvent[]` |
| `engine/damage.ts` | `calcAttackDamage()`, `calcSkillDamage()`, `calcItemHeal()` — pure calculation |
| `engine/enemy-ai.ts` | `pickEnemyAction(enemy, allies)` — 30% skill chance, otherwise random attack |
| `engine/battle-result.ts` | `checkOutcome()`, `buildResult()` |
| `engine/xp-system.ts` | `splitXp()`, `processMemberXp()`, `calcXpReward()` |

**Battle state machine phases:**

```
start → player_command → [skill_select] → [item_select] → target_select → resolving → end
                       ↑__________ESC returns to whichever menu opened target_select________↑
```

`targetReturnPhase` field in `BattleScene` tracks which menu opened `target_select`. ESC always returns to the correct prior phase.

**Equipment in battle:** `BattleScene.buildCombatants()` calls `resolveEffectiveStats(member)` for each ally. Equipment bonuses are baked into `Combatant` stats at battle start. Engine modules see only final stat values.

---

### `dialogue/`

| File | Purpose |
|------|---------|
| `DialogueOverlay.ts` | Phaser scene launched in parallel with any host scene. Renders dialogue box art, portrait placeholder, speaker name, body text, continue prompt. Emits `'complete'` on last line dismissal. |
| `dialogue-types.ts` | `SpeakerId`, `DialogueLine`, `DialogueSequence`, `EventEffect` union and variants |
| `event-handler.ts` | `runEffects(effects)` — the only place that translates `EventEffect[]` into `state-actions` calls |

---

### `ui/`

| File | Purpose |
|------|---------|
| `common/panel.ts` | `drawPanel(scene, opts)` — draws a bordered rounded rectangle. Returns the `Graphics` object. **Callers must add it to their container.** |
| `title/TitleScene.ts` | Title screen — New Game / Load Game, keyboard navigation, `hasSaveData()` detection |

---

## Asset manifest

All assets loaded in `PreloadScene`. Nothing loaded lazily.

| Key | File | Format | Used by |
|-----|------|--------|---------|
| `damage-digits` | `images/damage-digits.png` | Spritesheet, 10 frames, frameW 154, 1540×1024 | BattleScene damage popups |
| `heal-digits` | `images/heal-digits.png` | Spritesheet, 10 frames, frameW 154, 1540×1024 | BattleScene heal popups |
| `dialogue-box` | `ui/dialogue-box.png` | Image, 1536×1024 | DialogueOverlay |
| `result-panel` | `ui/result-panel.png` | Image, 1536×1024 | BattleScene result screen |
| `btn-normal` | `ui/btn-normal.png` | Image, 624×256 | BattleScene command panel |
| `btn-selected` | `ui/btn-selected.png` | Image, 624×256 | BattleScene command panel |
| `btn-disabled` | `ui/btn-disabled.png` | Image, 624×256 | BattleScene command panel |
| `btn-pressed` | `ui/btn-pressed.png` | Image, 624×256 | BattleScene command panel |

---

## Known issues

**Stale comment in `BattleScene.ts` result section** — a comment near the XP result panel block says "All active members receive the same XP pool". This predates the XP split system and is factually wrong. The comment has no runtime effect. Correct it when next editing that section.

---

## What is not yet implemented

- Portrait sprite art (placeholder ellipses used)
- Tile-based map rendering (pixel-based free movement is current implementation)
- Pause menu overlay (`PAUSE_MENU` key reserved in `scene-keys.ts`)
- Multiple save slots
- XP progress bar in battle status panel (level number is shown; XP-to-next-level is not)
- Branching dialogue choices
- Equipment management UI
- Multiple chapters beyond Chapter 1
- Status effects (type exists in `BattleEvent` as `MissEvent` but is never generated)
- Controller input
