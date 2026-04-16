# CLAUDE.md — Working Guide for Saga of the Lightning Warrior

This file is the persistent instruction set for any Claude session working on this repository. Read it completely before making any changes. It supersedes general preferences in favour of this project's specific requirements.

---

## Project identity

**Saga of the Lightning Warrior** — browser-based 2D fantasy JRPG.
Stack: Phaser 3.60 · TypeScript 5 (strict) · Vite 5 · localStorage saves.
No backend. No UI frameworks. No build-time code generation.
Resolution: 1280 × 720. Keyboard-only input. Node ≥ 18.

---

## Absolute rules

These apply to every change, no exceptions.

1. **Output complete files with paths.** Never produce partial diffs or pseudocode unless explicitly asked for a plan-only response.
2. **State what changed and why.** Every response must identify which files are new, which are modified, and summarise the change in plain language.
3. **Include manual test steps** for any change that affects player-visible behaviour.
4. **Zero real TypeScript errors before handing off.** Run `npm run typecheck`. TS2339 and TS2307 are ambient-type noise from missing `node_modules` in the Claude container — all others are real and must be fixed.
5. **Call out save-version impact explicitly.** If any change touches `GameState`, `PartyMember`, `InventoryEntry`, or `EquipmentSlots`, state whether `SAVE_VERSION` must be incremented and why.
6. **Do not invent features.** If the spec mentions something not in the code, note it as future work. Do not implement it speculatively.
7. **Preserve all internal ids.** Character ids, flag ids, item ids, enemy ids, location ids, skill ids, and equipment ids are stable references used across data files, save data, and dialogue. Renaming any of them without a full audit is a breaking change.

---

## Architecture boundaries

These are enforced rules, not suggestions.

### Scene files may
- Add Phaser game objects, text, graphics, containers, tweens
- Read input keys
- Call systems and selectors
- Start or stop other scenes
- Display data received from modules

### Scene files must not
- Contain game rules or calculations
- Mutate `GameState` directly — all writes go through `state-actions.ts`
- Reference `localStorage` — all persistence goes through `save-service.ts`
- Hardcode content ids, names, or values that belong in `data/`
- Import directly from another scene file

### Engine and system modules (`engine/`, `systems/`, `shared/`) must not
- Import Phaser
- Import from scene files
- Touch `localStorage`
- Mutate global state — return values, do not side-effect

### Data files (`src/game/data/**`) must not
- Import from `core/scene-keys.ts` — use `MapSceneKey` literals (`'TownScene'`, `'BattleScene'`) from `world/types/world-types.ts` for trigger targets
- Import from state, battle scenes, world scenes, or town scenes
- Contain logic beyond simple helper constants

### Allowed cross-module import directions

| From | To | Allowed |
|------|----|---------|
| Scene | `data/`, `state/selectors`, `state/actions`, `save/service`, `engine/`, `systems/`, `shared/` | ✓ |
| `engine/` | `data/`, `state/game-state-types` (type only) | ✓ |
| `data/` | other `data/`, `world/types/world-types` (for `WorldMapConfig` type) | ✓ |
| `state-actions` | `battle/engine/xp-system` | ✓ deliberate exception — XP splitting is stateless calculation |
| Any | `core/scene-keys` (value import) | Scene files only |

---

## Data-driven content rules

- **Characters** — `data/characters/party-members.ts`. New character: define `PartyMember`, add growth profile in `level-growth.ts`, add story flag, add `activate_party_member` effect to dialogue `onComplete`, add speaker appearance in `DialogueOverlay.ts`. No scene changes needed.
- **Enemies** — `data/enemies/enemies.ts`. New enemy: add `EnemyDef`, then add to encounter group in `encounter-tables.ts` or to a `ScriptedBattle.enemyIds` in a world trigger.
- **Items** — `data/items/items.ts`. Add to town shop stock in `*-town-config.ts`. No scene changes needed.
- **Equipment** — `data/equipment/equipment.ts`. Add to shop stock. `resolveEffectiveStats()` picks up bonuses automatically.
- **Skills** — `data/skills/skills.ts`. Assign via `skillIds` on party member or enemy. Set `scalingStat` explicitly when the element heuristic gives the wrong scaling stat.
- **Locations** — `data/maps/locations.ts`. Referenced by world triggers and town configs.
- **Dialogue** — `data/dialogue/dialogue-data.ts`. Reference sequences by string key.
- **Story flags** — `data/story/story-events.ts` as `STORY_FLAGS` constants. Always use constants — never raw strings.
- **Encounter tables** — `data/maps/encounter-tables.ts`. Zone id must match zone `id` in world-map-config.
- **Town layouts** — `data/maps/*-town-config.ts`. `TownScene` accepts any valid `TownMapConfig` — no scene changes for a new town.
- **World triggers and zones** — `data/maps/world-map-config.ts`.

---

## Save-version rules

File: `src/game/save/save-version.ts`  
Current version: **5**

**Increment `SAVE_VERSION` when:**
- Adding, removing, or renaming a field in `GameState`
- Adding, removing, or renaming a field in `PartyMember`
- Adding, removing, or renaming a field in `InventoryEntry`
- Adding, removing, or renaming a field in `EquipmentSlots`
- Changing the semantics of an existing field (version 4 was bumped for this reason)

**Do not increment for:**
- Adding new enemies, items, skills, equipment, or dialogue
- Changes to scene rendering code
- Changes to battle engine calculations
- Adding new story flags (stored as `Record<string, boolean>` — new keys are simply absent in old saves)

When incrementing, add a row to the version history in `save-version.ts` comments and in `docs/change-log.md`.

---

## UI and style rules

All visual constants live in `src/game/core/config.ts`. Never hardcode hex values or font strings in scene files.

### Colours

Always import from `COLORS` (numeric, for Phaser graphics) or `COLOR_HEX` (CSS strings, for Phaser Text):

| Role | Hex |
|------|-----|
| Panel background | `#14233B` at 92% opacity |
| Panel border (gold) | `#D9B35B` |
| Primary text (parchment) | `#F3EBD2` |
| Secondary text | `#D6D1C1` |
| Disabled text | `#888888` |
| Selection fill | `#2C4E86` |
| Selection border | `#8FC8FF` |
| Hugo name colour | `#E8D25F` |
| Serelle name colour | `#8FC8FF` |
| Villain name colour | `#D97A7A` |
| Danger crimson | `#A84747` |
| Success green | `#5E9B63` |

**Text on parchment art backgrounds** (dialogue box, result panel) requires dark ink. Never place light parchment text on warm parchment art:

| Role | Dark ink colour |
|------|----------------|
| Body text | `#1e1408` |
| General dark | `#2c1a06` |
| Hugo name | `#7a4e00` |
| Serelle name | `#0a3070` |
| Kael name | `#6a2c0a` |
| Villain name | `#6a0a0a` |
| NPC name | `#3a2a06` |
| Continue prompt | `#5a3a10` |

### Fonts

Always use `FONTS.title` (Georgia serif) or `FONTS.ui` (Trebuchet MS sans-serif).

### Panel background ownership

When calling `drawPanel()` inside a container-refresh method, always add the returned Graphics object to the container:

```ts
const bg = drawPanel(this, opts);
container.add(bg);
```

Failing to do this causes one leaked GPU-backed Graphics object per refresh call.

### Custom art assets

| Key | Source | Display size | Used in |
|-----|--------|-------------|---------|
| `dialogue-box` | 1536×1024 | 1200×521 | DialogueOverlay |
| `result-panel` | 1536×1024 | 920×613 | BattleScene result screen |
| `btn-normal` | 624×256 | 290×52 per row | Battle command panel |
| `btn-selected` | 624×256 | 290×52 per row | Battle command panel |
| `btn-disabled` | 624×256 | 290×52 per row | Battle command panel |
| `btn-pressed` | 624×256 | 290×52 per row | Battle command panel |
| `damage-digits` | 1540×1024, 10 frames | scale 56/1024 | BattleScene damage popups |
| `heal-digits` | 1540×1024, 10 frames | scale 56/1024 | BattleScene heal popups |

---

## Battle system rules

Do not change these without explicit instruction.

- Turn order rebuilt each round by `buildTurnOrder()` — sorted by speed, tiebroken ally-first then alphabetical id.
- One action per unit per round. No queuing.
- Commands: `attack`, `skill`, `item`, `defend`.
- **Defend** sets `isDefending = true`. Doubles effective defense against all incoming hits until the start of the unit's next action.
- **Attack damage:** `attacker.attack × variance(±10%) − target.defense × 0.5`, minimum 1.
- **Skill damage:** `baseStat × skill.power × variance(±10%) − target.defense × 0.5`, minimum 1. `baseStat` resolved from `scalingStat` override, then element heuristic (elemental → magic, `'none'` → attack).
- **Item heal:** `Math.min(restoreAmount, target.maxHP − target.currentHP)` — never overheals.
- **XP split:** `splitXp(total, activeCount)` — `base = floor(total/count)`, first `total%count` members get `base+1`. Deterministic, sums exactly to total.
- **Equipment bonuses** applied via `resolveEffectiveStats()` at battle start. Engine modules see final stat values and have no knowledge of equipment.
- **Enemy AI:** 30% chance to use an affordable skill; otherwise attacks a random living ally.
- **Victory:** return to world map at pre-battle coordinates; award gold and XP.
- **Defeat:** return to TitleScene with a defeat message.

---

## Encounter system rules

- Step unit: 32 px of player movement = 1 step (frame-rate independent).
- Post-battle immunity: 6 safe steps before next roll (configurable via `EncounterTracker` constructor).
- Rolls only inside zones with `type: 'encounter'`.
- Towns, inn, shop, and any overlay have zero encounter code.

---

## Dialogue and event rules

- `DialogueOverlay` is launched in parallel using `scene.launch()`.
- Host scene listens for `'complete'` on the overlay's event emitter.
- After last line, `onComplete` effects run via `runEffects()` in `event-handler.ts`.
- `event-handler.ts` is the **only** place that translates dialogue data into state mutations.
- Supported effect types: `set_flag`, `activate_party_member`, `add_gold`, `add_item`.
- To add a new effect: add its interface to `dialogue-types.ts`, add a case to `event-handler.ts` with the TypeScript exhaustive-check guard.

---

## Testing expectations

Before handing off:

1. **Compile check:** `npm run typecheck` — zero errors excluding TS2339 and TS2307.
2. **New game:** `initNewGame()` must produce valid state with 50g, 2 Herb Tonics, Hugo active, Serelle and Kael inactive.
3. **Save/load:** round-trip must restore all state fields correctly.
4. **Battle change:** verify turn order, damage range, and XP split arithmetically for a 2-party-vs-1-enemy case.
5. **Data change:** verify the changed id has no orphaned references in dialogue-data, town configs, world-map-config, or encounter-tables.

---

## What Claude should avoid

- Collapsing modules into larger files
- Adding libraries or dependencies beyond Phaser, TypeScript, and Vite
- Adding backend services, websockets, or server calls
- Importing Phaser in engine or data modules
- Placing content (names, ids, numbers) in scene files — it belongs in `data/`
- Using raw story flag strings — always use `STORY_FLAGS.X`
- Using raw scene key strings in data files — use `MapSceneKey` literals
- Implementing features not yet in the codebase (controller support, branching dialogue, equipment UI, multiple save slots) without explicit instruction
- Rewriting stable systems when only a targeted change is needed
- Incrementing `SAVE_VERSION` without explicitly stating it and documenting the reason

---

## Required output format

Every response that produces code must include:

1. **File path and status** (new / changed) for each file
2. **Complete file contents** — no partial snippets unless explicitly requested
3. **Brief plain-language summary** of what changed and why
4. **Manual test steps** — numbered, specific, testable
5. **Save compatibility** — explicit statement of whether `SAVE_VERSION` is affected
