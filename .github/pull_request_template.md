## What this changes

<!--
List every file that changed and one line explaining why.
Examples:
- src/game/battle/engine/damage.ts — adjusted defend multiplier from 0.5 to 0.4
- src/game/data/enemies/enemies.ts — added ridge_fang_elite enemy definition
- docs/content-bible.md — documented new enemy
-->


## Why

<!-- One or two sentences on the motivation. Link to an issue if one exists. -->


## Type of change

- [ ] New content (enemy, item, skill, location, dialogue — no logic change)
- [ ] Bug fix (behaviour was wrong)
- [ ] Feature (new system or capability)
- [ ] Refactor (behaviour unchanged, structure improved)
- [ ] Docs / config only

---

## Checklist

**Architecture**
- [ ] Scene files contain only rendering, input, and transitions — no game rules or calculations
- [ ] Game rules and calculations are in engine or system modules, not in scene files
- [ ] No content ids, names, or numbers hardcoded in scene files — all content belongs in `data/`
- [ ] No new cross-module coupling that violates the boundaries in `docs/architecture.md`
- [ ] Any new `drawPanel()` call inside a container-refresh method adds the returned Graphics to the container: `const bg = drawPanel(...); container.add(bg)`

**Data and ids**
- [ ] No internal ids were renamed — OR — `SAVE_VERSION` was bumped and `docs/id-stability-rules.md` was consulted
- [ ] Story flags use `STORY_FLAGS.X` constants, not raw strings
- [ ] World trigger `targetSceneKey` uses `MapSceneKey` literals (`'TownScene'`, `'BattleScene'`), not `SCENE_KEYS`

**Save format**
- [ ] `SAVE_VERSION` was **not** changed — OR —
- [ ] `SAVE_VERSION` was incremented, the version history in `save-version.ts` comments was updated, and a row was added to `docs/change-log.md`

**Scope**
- [ ] Unrelated stable systems were not rewritten or restructured
- [ ] The change is as small as it can be while still being complete

**Verification**
- [ ] `npm run typecheck` passes with zero real errors (TS2307/TS2339 from absent `node_modules` are expected noise — all others are real failures)
- [ ] Manual test steps are listed below, or this change has no player-visible effect

---

## Manual test steps

<!--
Numbered steps a reviewer can follow to verify the change works in a browser.
If the change has no player-visible effect (docs, config, type-only change), write:
"No player-visible effect."
-->

1.
