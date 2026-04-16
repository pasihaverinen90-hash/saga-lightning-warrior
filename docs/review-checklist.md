# Code Review Checklist

Use this when reviewing a pull request or auditing a Claude session's output. It is the detailed companion to the PR template checklist.

Full rules are in `CLAUDE.md` and `docs/architecture.md`. This checklist is a fast triage tool, not a substitute for reading those documents.

---

## Immediate blockers — reject if any apply

- [ ] **Unrelated systems rewritten.** A change to battle damage should not also restructure TownScene. Reject and ask for a targeted change.
- [ ] **Scene file contains game rules.** Damage calculations, XP distribution, encounter rolling, or save logic in a scene file is an architecture violation.
- [ ] **`localStorage` accessed outside `save-service.ts`.** Any direct `localStorage.getItem/setItem` outside that file is a boundary violation.
- [ ] **`GameState` mutated directly.** All state writes must go through `state-actions.ts`.
- [ ] **`SAVE_VERSION` changed without documentation.** A version bump with no entry in `save-version.ts` comments and `docs/change-log.md` is incomplete.
- [ ] **Stable id renamed without a `SAVE_VERSION` bump.** Character ids, equipment ids, item ids, player skill ids, story flag string values, and location ids are stored in save data. Renaming without a version bump silently corrupts existing saves. See `docs/id-stability-rules.md`.
- [ ] **Raw story flag strings in code.** Must be `STORY_FLAGS.X` constants — never `'serelle_joined'` as a literal.
- [ ] **TypeScript errors other than TS2307 or TS2339.** TS2307 (cannot find module 'phaser') and TS2339 (property does not exist on Scene) are ambient-type noise from absent `node_modules` in the Claude container. Every other `error TS` is a real failure that must be fixed.

---

## Architecture review

**Module boundaries**

- [ ] Does the changed file's import list match the allowed directions in `docs/architecture.md`?
  - `data/` files must not import from `core/scene-keys`, `state/`, battle scenes, world scenes, or town scenes
  - Engine files (`battle/engine/`) must not import Phaser
  - Scene files must not import other scene files directly
- [ ] Was `movement-system.ts` imported from `shared/movement-system`, not `world/systems/movement-system` (old path, no longer exists)?
- [ ] Did any new data file use `MapSceneKey` literals (`'TownScene'`, `'BattleScene'`) rather than `SCENE_KEYS.X`?

**Panel background ownership**

- [ ] Any new `drawPanel()` call inside a container-refresh method — is the returned `Graphics` object added to the container?

```ts
// Correct
const bg = drawPanel(this, opts);
container.add(bg);

// Wrong — leaks one Graphics object per refresh
drawPanel(this, opts);
```

This is a confirmed recurring bug pattern (fixed in `refreshStatusPanel`, `refreshSkillPanel`, `refreshItemPanel`). Check any new panel-in-container code.

**Content placement**

- [ ] New characters, enemies, skills, items, equipment, locations, or dialogue defined in `data/` files only?
- [ ] New story flag ids defined in `data/story/story-events.ts` as `STORY_FLAGS` constants?
- [ ] No content ids, display names, or numeric values hardcoded in scene files?

---

## Save format review

Trigger this section if any of the following files changed: `game-state-types.ts`, `party-members.ts`, `save-types.ts`, `save-version.ts`, or any file that adds or removes a field on `GameState`, `PartyMember`, `InventoryEntry`, or `EquipmentSlots`.

- [ ] Was a field added, removed, or renamed in `GameState`, `PartyMember`, `InventoryEntry`, or `EquipmentSlots`?
  - If yes: was `SAVE_VERSION` incremented?
  - If yes: was a row added to the version history in `save-version.ts` comments?
  - If yes: was a row added to `docs/change-log.md`?
- [ ] If `SAVE_VERSION` was incremented: does loading an old-version save correctly return `false` from `loadGame()` without crashing?
- [ ] Was `initNewGame()` updated to populate any new fields with sensible defaults?

---

## Id stability review

Trigger this section if any `data/` file was modified.

- [ ] Were any ids renamed? Cross-check against `docs/id-stability-rules.md`.
- [ ] If a stable (save-data) id was renamed: is `SAVE_VERSION` bumped and documented?
- [ ] If a data-only id was renamed: are all references updated in `encounter-tables.ts`, `world-map-config.ts`, town configs, and `dialogue-data.ts`?
- [ ] Were new ids added? Do they use `snake_case` and avoid collision with existing ids?

---

## UI and style review

- [ ] Colours imported from `COLORS` or `COLOR_HEX` in `config.ts`? No hardcoded hex strings.
- [ ] Fonts imported from `FONTS`, sizes from `FONT_SIZES` in `config.ts`?
- [ ] Text on custom art backgrounds (dialogue box parchment, result panel parchment) uses dark ink colours — not light parchment `#F3EBD2` on warm parchment art.
- [ ] Text on dark navy `drawPanel` backgrounds uses the parchment colour palette.
- [ ] For any new sprite/asset: was it added to `PreloadScene.ts`? Nothing should be loaded lazily.

---

## Scope and safety

- [ ] Is the change as small as it can be while still being complete?
- [ ] Were any stable unrelated systems touched that did not need to change?
- [ ] Could this change be split into smaller independent PRs without losing coherence?

---

## Verification sign-off

- [ ] `npm run typecheck` output is shown or confirmed passing — zero non-ambient errors
- [ ] Manual test steps are present and specific, not just "tested locally"
- [ ] For any battle change: turn order, damage range, or XP split verified manually for a simple case (e.g. 2 allies vs 1 enemy, round numbers)
- [ ] For any save change: a full round-trip save/load was verified in browser
- [ ] For any story flag change: the flag guards (`requiresFlag`, `consumedByFlag`) were verified in the world map trigger
- [ ] For any new dialogue sequence: the `onComplete` effects fire correctly and the right flags are set
