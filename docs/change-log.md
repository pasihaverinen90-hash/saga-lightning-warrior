# Change Log

Reverse-chronological record of significant changes. Entries are grouped by feature area. Save format changes are highlighted.

---

## Save version history

| Version | Change |
|---------|--------|
| **5** (current) | `PartyMember` gained `equipment: EquipmentSlots ({ weapon, armor })`. Saves from v4 lack this field; loading would produce `undefined` equipment causing `resolveEffectiveStats()` to produce NaN bonuses silently. |
| 4 | `PartyMember.xp` semantics changed from "XP remainder toward next level" to "total lifetime XP earned". Intentionally invalidated to prevent corrupt state. |
| 3 | `PartyMember` gained `level: number` and `xp: number`. `EnemyDef` gained `xpReward: number` (not serialised). |
| 2 | `PartyMember` gained `colorHex: number` for battle sprite colour identity. |
| 1 | Initial structure. |

---

## GitHub preparation — architecture and hygiene

- Removed malformed `{docs,public` directory from project root (shell brace-expansion artifact from initial scaffold)
- Relocated `movement-system.ts` from `world/systems/` to `shared/` — used by both `WorldMapScene` and `TownScene`; living under `world/` was misleading
- `Rect` type is now defined in `shared/movement-system.ts` and re-exported from `world/types/world-types.ts`
- `world-map-config.ts` no longer imports from `core/scene-keys`. Trigger `targetSceneKey` uses string literals `'TownScene'` and `'BattleScene'` typed against `MapSceneKey` in `world-types.ts`
- `WorldTrigger.targetSceneKey` narrowed from `string` to `MapSceneKey`
- `refreshStatusPanel` panel background now added to container — previously leaked one Graphics object per battle action
- `vite.config.ts` removed from `tsconfig.json` include, fixing `TS6059: File is not under rootDir` error that silently broke `tsc`
- `COLOR_HEX` extended with `dangerCrimson` and `successGreen` — these existed in `COLORS` (numeric) but were absent from `COLOR_HEX` (CSS strings), causing real TypeScript errors caught by `npm run typecheck`
- Added `typecheck`, `ci`, and `engines` fields to `package.json`
- Added `.editorconfig`, `.gitattributes`, `.nvmrc`, `.github/workflows/ci.yml`, `.github/pull_request_template.md`
- Full documentation pack created: `CLAUDE.md`, updated `README.md`, and all files in `docs/`

---

## Battle UX polish

- `setPhaseBack()` now returns to the correct prior menu (skill panel → skill panel, item panel → item panel) via `targetReturnPhase` field — previously always returned to command menu
- Orphaned `drawPanel` backgrounds in `refreshSkillPanel` and `refreshItemPanel` fixed — backgrounds added to containers
- Skill panel row height increased to 56px; description line added per skill using `SkillDef.description`
- Item effect label prefixed with `♥` (HP) or `✦` (MP) glyph for at-a-glance scanning
- `spawnFloatingNumber` split into `spawnFloatingDigits`, `spawnFloatingDamage`, `spawnFloatingHeal`, `spawnFloatingLabel` for clear responsibility separation
- Floating number x-offset stagger added for simultaneous multi-hit events
- Target select prompt shortened to "Choose target · ESC to go back"
- Battle file header updated to reflect all 6 phases

---

## Custom UI art integration

- Dialogue box: custom art `dialogue-box.png` (1536×1024 → 1200×521), dark ink text on parchment zones
- Result panel: custom art `result-panel.png` (1536×1024 → 920×613), parchment text zones mapped to internal layout
- Command buttons: 4 state PNGs (`btn-normal`, `btn-selected`, `btn-disabled`, `btn-pressed`), 624×256 → 290×52, labels rendered by code
- `btn-disabled` and `btn-pressed` state corrected after initial misidentification (grey = disabled, dark navy = pressed)

---

## Damage and heal digit sprites

- `damage-digits.png` — 1540×1024, 10 frames, fire-styled orange, `frameWidth: 154`. Padded from 1536 to exact 10×154 width.
- `heal-digits.png` — 1540×1024, 10 frames, green glow. Converted from RGB+black-background to RGBA with black pixels masked transparent.
- Both loaded in `PreloadScene`, rendered in `BattleScene` via shared `spawnFloatingDigits` helper
- HP heals use sprite digits; MP restore uses styled text

---

## Equipment system (SAVE_VERSION → 5)

- `EquipmentSlots { weapon, armor }` added to `PartyMember`
- `data/equipment/equipment.ts` defines 11 weapon/armor pieces; starter gear at `price: 0`
- `data/equipment/equipment-system.ts` provides `resolveEffectiveStats()` — bonuses applied at `buildCombatants()` time in battle
- `shop-service.ts` auto-equips purchased equipment on all eligible active party members
- `equipItem` action added to `state-actions.ts`

---

## XP and leveling system (SAVE_VERSION → 3, → 4)

- XP threshold table in `level-growth.ts` (explicit levels 1–10, formula 11+)
- Stat growth profiles per character in `level-growth.ts`
- `splitXp(total, count)` in `xp-system.ts` for deterministic split with remainder
- `applyBattleXp()` in `state-actions.ts` applies per-member shares and level-ups
- Result panel shows per-member XP rows with level-up arrows

---

## Third party member — Kael

- `KAEL` added to `party-members.ts` (battle axe, iron plate, `flame_cleave`)
- Growth profile added to `level-growth.ts`
- `kael_joined` flag added to `STORY_FLAGS`
- Ashenveil join event added to `dialogue-data.ts`
- `kael` speaker added to `DialogueOverlay.ts`

---

## Ashenveil content

- `ashenveil-town-config.ts` — second playable town with full shop (including equipment), inn, save crystal, and Kael join event
- `ashenveil_town` location and `ashenveil_road` encounter zone added
- `ashenveil_patrol` enemy added; encounter table for Ashenveil Road zone

---

## Thornwood content

- `thornwood` location and `thornwood_zone` encounter zone added
- `thornwood_lurker` and `corrupted_wisp` enemies added
- `grove_warden_clearing` scripted trigger added
- `grove_warden` boss with `wisp_flare` and `shadow_wave` skills
- `THORNWOOD_CLEARED` story flag; reward items and gold granted via `onComplete` effects
- NPC dialogue overrides in Lumen Town gated on `thornwood_cleared`

---

## Random encounter system

- `EncounterTracker` class in `world/systems/encounter-system.ts`
- Step-based (32 px/step), frame-rate independent via pixel accumulator
- 6-step post-battle immunity
- Data-driven encounter tables with weighted group selection via `pickEncounterGroup()`
- `getActiveZone()` evaluates zone membership by player centre point

---

## Dialogue event system

- `EventEffect` union type in `dialogue-types.ts`
- `runEffects()` in `event-handler.ts` — only place that translates dialogue data into state mutations
- Effect types: `set_flag`, `activate_party_member`, `add_gold`, `add_item`

---

## Chapter 1 story — Serelle join / boss Veyr

- Serelle join event in Lumen Town
- North Pass entrance trigger (scripted battle, requires `serelle_joined`, consumed by `boss_veyr_defeated`)
- Boss intro and outro dialogue
- `boss_veyr_defeated` and `chapter_1_complete` flags set by outro `onComplete` effects
- NPC dialogue overrides gated on `boss_veyr_defeated`

---

## Core systems (initial build)

- Phaser 3 + TypeScript + Vite project skeleton
- BootScene → PreloadScene → TitleScene → WorldMapScene / TownScene / BattleScene
- Module separation: core, state, save, data, world, town, battle, dialogue, ui, shared
- `GameState` singleton with typed actions and selectors
- `localStorage` save/load with version gating
- Turn-based battle engine (turn-order, damage, enemy-AI, battle-result)
- Dialogue overlay with speaker colour system
- World map triggers, zones, and movement
- Town scene with inn, shop, NPC interaction
