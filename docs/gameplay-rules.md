# Gameplay Rules Reference

Precise rules for every implemented system. All values are taken directly from source code. Nothing here is speculative.

---

## New Game state

Source: `state/state-actions.ts` → `initNewGame()`

| Field | Value |
|-------|-------|
| Gold | 50g |
| Inventory | Herb Tonic × 2 |
| Party | Hugo (active), Serelle (inactive), Kael (inactive) |
| Story flags | all false / absent |
| Location | Border Fields, world map spawn position |

---

## World map

- Player speed: **200 px/sec**
- Player hitbox: **28 × 36 px** (top-left origin)
- Camera: follows player smoothly, centred

### Zones

Zones are axis-aligned rectangles in `world-map-config.ts`. Membership is tested against the player's **centre point**. Zones are evaluated in array order — first match wins. List more-specific zones before broader fallback zones.

Zone types:
- `'encounter'` — random encounters active
- `'safe'` — no encounters

### Triggers

Triggers fire when the player stands inside the trigger rect and presses `E`. The scene transitions to `targetSceneKey` and records `targetLocationId` in state.

Guard conditions (both optional per trigger):
- `requiresFlag` — trigger is silent until the named flag is true
- `consumedByFlag` — trigger is silent once the named flag is true (used for boss fights)

Scripted battles attach a full `ScriptedBattle` spec to the trigger. `WorldMapScene` reads the spec and launches `BattleScene`. No boss data is hardcoded in the scene.

---

## Random encounters

Source: `world/systems/encounter-system.ts`, `data/maps/encounter-tables.ts`

- Step unit: **32 px** of player movement = 1 step (frame-rate independent)
- Post-battle immunity: **6 safe steps** before rolling can resume
- Each zone has its own table with:
  - `minStepsBeforeEncounter` — steps walked before the first roll is possible
  - `chancePerStep` — probability per step after the threshold is crossed

| Zone id | Min steps | Chance/step |
|---------|-----------|-------------|
| `north_pass_zone` | 8 | 12% |
| `ashenveil_road_zone` | 6 | 13% |
| `thornwood_zone` | 8 | 14% |

Enemy group selection is weighted random from the zone's `groups` array.

**No encounters in:** towns, inn/shop modals, any scene overlay, title scene.

---

## Town exploration

- Player speed: **180 px/sec**
- Interaction key: `E`
- Interaction: rectangle overlap test (not radial)

### Inn

- **Rest:** restores all HP and MP for all active party members. Currently free (0g cost).
- **Save:** writes current state to `localStorage` via `saveGame()`.
- Save is also available at the save crystal in the town square.

### Shop — item purchase

1. Validate gold ≥ item price
2. Deduct price via `spendGold()`
3. Add 1 to inventory via `addItem()`

### Shop — equipment purchase

1. Validate gold ≥ equipment price
2. Deduct price
3. Equip on every active party member whose slot is empty or holds a cheaper item
4. If nobody benefits: refund and return an explanation
5. Auto-equip rule: `currentItemPrice < newItemPrice` → equip. Starter gear has `price: 0`, so any purchasable item always upgrades over starter.

---

## Battle system

Source: `battle/engine/`

### Turn order

Rebuilt at the start of every round from all living combatants.

Sort order:
1. Higher speed → earlier turn
2. Tiebreak: allies before enemies
3. Tiebreak: alphabetical by id (deterministic)

Dead combatants are skipped. If all combatants on one side are defeated mid-round, the battle ends immediately.

### Commands

**Attack**
- Damage = `attacker.attack × variance(±10%) − target.defense × 0.5`
- Minimum damage: 1
- No element

**Skill**
- MP cost deducted from actor at action time
- If insufficient MP: silently falls back to a basic attack
- Damage = `baseStat × skill.power × variance(±10%) − defense × 0.5`, minimum 1
- `baseStat` resolution priority:
  1. `skill.scalingStat` explicit override (`'attack'` or `'magic'`)
  2. Element heuristic: elemental skill → magic; `element: 'none'` → attack
- Target types: `single_enemy`, `all_enemies`, `single_ally`, `all_allies`

**Item**
- Item consumed from global inventory before action resolves
- HP restore: `Math.min(restoreAmount, target.maxHP − target.currentHP)` — no overheal
- MP restore: same logic for MP

**Defend**
- Sets `isDefending = true`
- Doubles effective defense against all incoming damage until the start of the unit's next action
- Implementation: when `target.isDefending`, damage formula uses `target.defense × 2` (equivalent to halving raw damage at the formula level)

### Equipment in battle

`resolveEffectiveStats(member)` is called during `buildCombatants()` at battle start. Equipment bonuses are baked into `Combatant` stat fields. The engine modules (`damage.ts`, `battle-actions.ts`) see only final stat values and have no knowledge of equipment.

### Enemy AI

Per turn:
1. If any skill is affordable AND `Math.random() < 0.30`: pick a random affordable skill, target random living ally
2. Otherwise: physical attack on a random living ally

### Victory

1. Gold from all defeated enemies awarded via `addGold(result.goldEarned)`
2. Total XP from all defeated enemies calculated via `calcXpReward()`
3. XP split among active party members via `splitXp(total, activeCount)`:
   - `base = Math.floor(total / count)`
   - First `total % count` members receive `base + 1`; the rest receive `base`
   - Deterministic; sums exactly to `total`
4. Each member's share processed via `processMemberXp()` — walks threshold table, applies `applyStatGrowth()` per level crossed
5. Result panel shown: gold earned, XP header with `(split)` note, per-member rows with optional `→ Lv X` arrow
6. If `outroDialogueId` exists: plays dialogue, then transitions
7. World map started at pre-battle player coordinates (`returnX`, `returnY`)

### Defeat

Return to `TitleScene` with a defeat message. No save is written.

---

## Save / load

Source: `save/save-service.ts`

- Storage: `localStorage` key `saga_save_slot_1`
- Format: `{ version: number, timestamp: number, state: GameState }`
- Version mismatch: `loadGame()` returns `false`, game starts fresh
- `hasSaveData()`: checks key exists and version matches — used by title screen to enable/disable Load Game button
- `getSaveMeta()`: reads metadata (timestamp, locationId) without loading full state

### What is saved

All fields of `GameState`:
- `gold`
- `party` — all members including inactive, with current stats, level, xp, equipment
- `inventory`
- `storyFlags`
- `currentLocation` — locationId, x, y in centre-origin pixel coordinates

### Save version history

| Version | Change |
|---------|--------|
| 1 | Initial structure |
| 2 | `PartyMember` gained `colorHex` |
| 3 | `PartyMember` gained `level` and `xp` |
| 4 | `xp` semantics changed to lifetime total — intentional invalidation |
| 5 | `PartyMember` gained `equipment: EquipmentSlots` |

---

## Story flag system

Source: `data/story/story-events.ts`, `dialogue/event-handler.ts`

Flags are string keys set to `true` in `GameState.storyFlags`. They are never set to `false` — once true, always true.

Setting a flag: `setStoryFlag(flagId)` in `state-actions.ts` — called only by `runEffects()` in `event-handler.ts`.

Reading a flag: `getStoryFlag(flagId)` in `state-selectors.ts` — used by NPC dialogue override lookups and world trigger guards.

**Always use `STORY_FLAGS.X` constants — never raw strings.**

---

## Party recruitment

The pattern used by every recruit event:

1. NPC has a `dialogueId` pointing to a `DialogueSequence`
2. That sequence has `onComplete` effects: `set_flag` + `activate_party_member`
3. `runEffects()` calls `activatePartyMember(memberId)` → sets `isActive = true`
4. The member was already in `STARTING_PARTY` with `isActive: false` — no roster addition needed
5. Next battle: `getActiveParty()` includes them and `BattleScene` spawns them

NPC dialogue override: `dialogueOverrides` on an NPC definition is an array of `{ requiresFlag, dialogueId }`. `resolveNpcDialogueId()` returns the first matching override, falling back to the base `dialogueId`.

---

## XP and leveling

Source: `data/characters/level-growth.ts`, `battle/engine/xp-system.ts`

- `PartyMember.xp` = **total lifetime XP**, never decreases, never resets
- Level = highest L where `xp >= XP_THRESHOLDS[L]`
- Level-up applies flat stat gains from the character's growth profile
- On level-up, `currentHP` and `currentMP` are healed to new maximums
- Max level: 99

### XP threshold table

| Level | Total XP | Level | Total XP |
|-------|---------|-------|---------|
| 1 | 0 | 6 | 1 200 |
| 2 | 100 | 7 | 1 800 |
| 3 | 250 | 8 | 2 600 |
| 4 | 450 | 9 | 3 600 |
| 5 | 750 | 10 | 5 000 |

Levels 11+: `threshold(L) = threshold(L−1) + L × 300`. Max level 99.
