# World Map — Implementation Audit (2026-05-28)

This is an audit-only pass. **No game code, no config, no design doc was modified by the audit itself.**
The single deliverable beyond this report is the implementation blueprint at
[docs/reference/world-map-implementation-blueprint.svg](reference/world-map-implementation-blueprint.svg),
generated from the live `elerion-world-config.ts` so we can compare it side-by-side
with [docs/reference/world-map-overview.png](reference/world-map-overview.png).

> **Correction pass applied (2026-05-28)** — see the "Correction pass applied" section near the end of this document for the four small follow-up edits made to `elerion-world-config.ts` after the audit. The blueprint has been refreshed to match.

---

## 1. Executive summary

**Verdict: the implementation matches the canonical reference closely enough to support story planning.** All twenty-one canonical place names from the reference are present in the config, with the correct kind, in the correct general position, and (with one exception noted below) with the correct visible labels. The map is structurally ready for Chapter 1–3 story authoring.

There are **two real findings** before story authoring should begin, plus several small consistency cleanups that are safe to defer:

1. **Two central-sea islands meant to be hidden show region labels.** `lighthouse_isle` and `merchant_atoll` regions still carry display names. Their *landmark* labels are correctly hidden — but if the renderer paints region `displayName`, the labels "Lighthouse Isle" and "Merchant Atoll" will appear on the map and break the canon "3 visible islands" rule.
2. **Player start sits inside the Thornwood encounter zone.** `playerStartX/Y = (220, 2740)` is inside `thornwood_zone` (100,2280–1060,2860). A first-step encounter is possible unless the Dawnkeep landmark or some other code is treated as a safe overlay. Worth a check before story begins.

Everything else listed below is either correct, intentionally deferred, or a small label/copy mismatch.

- **Blueprint:** [docs/reference/world-map-implementation-blueprint.svg](reference/world-map-implementation-blueprint.svg)
- **Canonical reference:** [docs/reference/world-map-overview.png](reference/world-map-overview.png)

---

## 2. Canonical place checklist

Every canonical reference name is present. Coordinates are world-space (5120×2880). Position assessments are based on the world-regions.md target positions (the design doc), not on pixel-perfect tracing of the reference image.

### Western continent

| Canon name | In config? | Technical id | Display label | Coords / bounds | Visible? | Correct rel. pos.? | Correct role? | Action needed? |
|---|---|---|---|---|---|---|---|---|
| Dawnkeep | yes | `lm_start_village` | `Dawnkeep` | (140, 2740) 130×110 | yes | yes — SW corner | village (Ch 1 start) | no |
| Verdant Fields | yes | `vergant_fields` (region) | `Verdant Fields` | (80, 60) 2220×2760 | yes | yes — broad western plains | plains base | no |
| Highland Ruins | yes | `lm_highland_ruins` | `Highland Ruins` | (140, 1660) 110×90 | yes | yes — west coast mid | optional ruin | no |
| Riverdale | yes | `lm_bridgeford` | `Riverdale` | (1390, 1020) 200×160 | yes | yes — at river bridge | chokepoint village | no |
| Bridgeford *(bridge)* | yes | `verdant_bridge` (region) | `Bridgeford` | (1400, 1040) 80×140 | yes | yes — inside Riverdale | bridge structure | no |
| Eldric | yes | `lm_lumen_capital` | `Eldric` | (1000, 720) 180×160 | yes | yes — central-west | capital + TownScene | no |
| Everdawn Forest | yes | `evergreen_forest` (region) | `Everdawn Forest` | (200, 800) 620×540 | yes | yes — mid-west | forest region | no |
| Northwind Pass | yes | `mountain_pass_zone` (zone) | `Northwind Pass` (zone label) | x:1100–1300, y:280–500 | as a zone | yes — N–S corridor | encounter pass | no |
| Frostnorth Tundra | yes | `northern_tundra` (region) | `Frostnorth Tundra` | (80, 60) → top band | yes | yes — top snow band | snow region | no |
| Stonegate | yes | `lm_mountain_gate` | `Stonegate` | (1100, 300) 200×200 | yes | yes — sits in pass | gate city | no (but no town-entrance trigger yet — known deferred) |
| Silverwall Mountains | yes | `spine_band_west` + `spine_band_east` | `Silverwall Mountains` (both) | y:280–500 across west | yes | yes — top barrier | mountain barrier | minor: same label on two regions paints twice; ok |
| Light's Sanctuary | yes | `lm_saints_sanctuary` | `Light's Sanctuary` | (880, 2440) 130×110 | yes | yes — south-central | shrine | no |
| Harborwatch | yes | `lm_west_port` | `Harborwatch` | (2080, 1800) 140×120 | yes | yes — SE coast | west port | no (ferry trigger deferred) |

### Central sea

| Canon name | In config? | Technical id | Display label | Coords / bounds | Visible? | Correct rel. pos.? | Correct role? | Action needed? |
|---|---|---|---|---|---|---|---|---|
| The Central Sea | yes (structural) | — | (no entity) | x:2300–3200, full height | as ocean band | yes | sea barrier | optional: a faint "Central Sea" label could be nice later, but reference is consistent without one |
| Whisper Isle | yes | `lm_whisper` / `whisper_isle` | `Whisper Isle` (both) | landmark (2470, 400); region (2460, 380) | yes | yes — north island | side stop | no |
| Tempest Isles | yes | `lm_tempest` / `tempest_spire` | `Tempest Isles` (both) | landmark (2500, 2300); region (2480, 2280) | yes | yes — southern island | optional dungeon | no |
| Saint's Isle | yes | `lm_storm` / `storm_isle` | `Saint's Isle` (both) | landmark (2780, 1840); region (2760, 1820) | yes | yes — central-south, slightly east | sea-route safe stop | no |

### Eastern continent

| Canon name | In config? | Technical id | Display label | Coords / bounds | Visible? | Correct rel. pos.? | Correct role? | Action needed? |
|---|---|---|---|---|---|---|---|---|
| Dreadshore | yes | `lm_east_port` / `ashenveil_town` | `Dreadshore` (landmark) | (3280, 1500) 140×110 | yes | yes — west coast | east port + TownScene | no |
| Riverrun | yes | `lm_river_city` | `Riverrun` | (3800, 1180) 150×120 | yes | yes — at Ironflow crossing | chokepoint city | minor: `kind: 'gate'` reads as gate not city; landmark icon may not match "city" — see §9 |
| Greymarsh Wilds | yes | `greymarch_wilds` (region) | `Greymarsh Wilds` | (3200, 60) 1840×2760 | yes | yes — eastern base | wild region | minor: region id is `greymarch_wilds` (legacy spelling, no `s`) |
| Twilight Grove | yes | `blackwoods` (region) | `Twilight Grove` | (4040, 1800) 540×460 | yes | yes — east of river, south-central | corrupted forest | no |
| Warfortress | yes | `lm_war_fortress` | `Warfortress` | (4220, 720) 150×130 | yes | yes — beyond river, NE-ish | fortress | no |
| Black Citadel | yes | `lm_dark_citadel` | `Black Citadel` | (4760, 280) 170×150 | yes | yes — far NE | final dungeon | no |

**Result:** every canonical name on the reference image exists, is rendered, and sits in the expected zone.

---

## 3. Hidden and extra (non-reference) items

Items implemented but **not labelled** on the reference image. Classification follows the categories the user asked for.

### Landmarks with `label: ''` (correctly hidden)

| Technical id | Kind | Position | Classification |
|---|---|---|---|
| `lm_forest_shrine` | shrine | (320, 660) | **hidden correctly** — reserved for an Everdawn Forest side dungeon (canon §10) |
| `lm_lighthouse` | island | (2710, 860) | **hidden correctly** at landmark level, but see "label leak" finding below |
| `lm_merchant` | island | (2490, 1340) | **hidden correctly** at landmark level, but see "label leak" finding below |
| `lm_frontier_town` | town | (3580, 1380) | **hidden correctly** — reserved second-east-village (canon §10) |
| `lm_ancient_ruins` | ruin | (4320, 1780) | **hidden correctly** — reserved optional dungeon (canon §10) |

### Regions with `displayName: ''` (correctly hidden)

| Technical id | Position | Classification |
|---|---|---|
| `northwind_peaks` | NW mountain sub-cluster | **structural** — keeps Silverwall reading as a single named range |
| `lumen_grove` | (780, 1300) small forest near Eldric | **side content** — possibly future "Eldric Grove" |
| `thornwood_region` | (120, 2300) corrupted patch S of Dawnkeep | **structural + future canon** — the Ch 1 "first taste of corruption" patch |
| `eastern_dustlands` | dust band S of Ironflow | **structural sub-region** |
| `twilight_marches` | dust band east of Ironflow | **structural sub-region** |
| `black_reach` | corruption strip around the Citadel | **structural sub-region** |
| `ironflow_river_n` / `ironflow_river_s` / `iron_bridge` | east river | **structural** — labels intentionally suppressed (reference names only Riverrun) |

### Regions with **visible** display names that are NOT on the reference

| Technical id | Display name | Concern |
|---|---|---|
| `whisper_isle` | `Whisper Isle` | none — canonical, labeled |
| `tempest_spire` | `Tempest Isles` | none — canonical, labeled |
| `storm_isle` | `Saint's Isle` | none — canonical, labeled |
| `lighthouse_isle` | **`Lighthouse Isle`** | **finding A** — canon says hide this; region label is not blanked. The landmark `lm_lighthouse` has `label: ''`, but the region still names itself. |
| `merchant_atoll` | **`Merchant Atoll`** | **finding A** — same issue as Lighthouse Isle. |
| `verdant_river_n / _s1 / _bend / _s2` | `Verdant River` | the reference image does not clearly label the river. This is consistent with how `world-map-canon.md §Canonical place names` lists "Verdant River" implicitly via the Riverdale entry, so it's defensible — but four region segments each titled "Verdant River" may produce duplicate labels depending on renderer behaviour. |

### Encounter zones whose labels differ from canon

| Zone id | Zone displayName | Canon name | Concern |
|---|---|---|---|
| `eastern_frontier_zone` | **`Greymarsh Frontier`** | `Greymarsh Wilds` | minor: zone label and region label drift. The region itself reads `Greymarsh Wilds` (correct); only the encounter-zone display name is off-canon. |
| `eastern_warfields_zone` | `Twilight Grove` | `Twilight Grove` | correct |
| `mountain_pass_zone` | `Northwind Pass` | `Northwind Pass` | correct |
| `northern_tundra_zone` | `Frostnorth Tundra` | `Frostnorth Tundra` | correct |
| `western_forest_zone` | `Everdawn Forest` | `Everdawn Forest` | correct |
| `thornwood_zone` | `Thornwood` | (hidden, reserved) | correct — kept since the region is meant to come back as Ch 1 corruption |
| `blightlands_zone` | `Black Reach` | (hidden, reserved) | minor: the zone reveals a name (`Black Reach`) that the canon §10 keeps reserved. Probably fine — players see this only when fighting there. |

### Roads going to hidden landmarks

| Road id | Goes to | Concern |
|---|---|---|
| `west_shrine_branch` | `lm_forest_shrine` (hidden) | visible road, hidden destination. Acceptable today — the path itself is on the reference image as a trail through Everdawn. |
| `east_ruins_branch` | `lm_ancient_ruins` (hidden) | same pattern; acceptable. |

---

## 4. Structural geography accuracy

### Western continent

| Claim | Status | Notes |
|---|---|---|
| Dawnkeep in southwest | **MATCH** | (140, 2740) bottom-left quadrant; matches reference. |
| Eldric central-west / west of the river | **MATCH** | (1000, 720); river is at x=1400, so Eldric is comfortably west. |
| Riverdale at the river crossing | **MATCH** | (1390, 1020); sits exactly at the Bridgeford gap. |
| Silverwall Mountains / Northwind Pass / Stonegate in the correct northern area | **MATCH** | Mountain band at y:280–500 across the entire west, pass corridor x:1100–1300 with Stonegate inside it. |
| Harborwatch on the western continent coast | **MATCH** | (2080, 1800) on the SE coastline at the sea boundary. |
| Light's Sanctuary in roughly correct position | **MATCH** | (880, 2440) south-central. |
| Highland Ruins in roughly correct position | **MATCH** | (140, 1660) west-coast mid-vertical; matches the small ruin silhouette on the reference. |

### Central sea

| Claim | Status | Notes |
|---|---|---|
| Sea width and placement | **MATCH** | x:2300–3200 (≈17.6% of map width). Continents read clearly separated. |
| Island count | **NEEDS MINOR ADJUSTMENT** | Five islands implemented; reference shows three canonical labelled ones. The two extras are landmark-hidden but **region-labelled** — see Finding A. |
| Island placement | **MATCH** | Whisper Isle north, Saint's Isle central-south, Tempest Isles south — matches the reference's N→S layout. |
| Harborwatch → Dreadshore sea route expectation | **MATCH** (data only) | `seaRoutes[]` has both directions wired with `requiresFlag: CHAPTER_3_SEA_TRAVEL_UNLOCKED`. The `west_port_ferry` / `east_port_ferry` triggers themselves don't exist yet (deferred per canon §12.3). |

### Eastern continent

| Claim | Status | Notes |
|---|---|---|
| Dreadshore on west/northwest eastern coast | **MATCH** | (3280, 1500) on the western edge of the eastern continent at mid-vertical. |
| Riverrun at river crossing | **MATCH** | (3800, 1180), exactly at the Ironflow / Iron Bridge gap. |
| Greymarsh Wilds as eastern frontier/wilds | **MATCH** | Region covers the eastern continent base (rocky); the sub-band south of the river adds the dust feel. |
| Twilight Grove as corrupted forest approach | **MATCH** | (4040, 1800) east of Riverrun, south-central — exactly the "dark forest approach" role. |
| Warfortress positioned before final dark area | **MATCH** | (4220, 720) in the NE quadrant but inside the rocky base, not yet inside the Black Reach blight strip — reads correctly as "last stronghold before the Citadel". |
| Black Citadel in far eastern / final dark region | **MATCH** | (4760, 280) far-NE inside `black_reach`; the stone-style `citadel_road` arrives from Warfortress. |

**Summary:** the implementation is structurally faithful to the reference. The one structural deviation is the island count (5 implemented, 3 on the reference), and that lives behind a label-suppression mechanism that has a leak.

---

## 5. Findings (the things to fix before story authoring)

### Finding A — central-sea region labels leak two non-canon island names

**File:** `src/game/data/maps/elerion-world-config.ts` lines 233–242
**What:** `whisper_isle`, `lighthouse_isle`, `merchant_atoll`, `storm_isle`, `tempest_spire` are all defined as island regions. Three of those regions display canonical names (`Whisper Isle`, `Saint's Isle`, `Tempest Isles`). The remaining two — `lighthouse_isle` and `merchant_atoll` — still have `displayName: 'Lighthouse Isle'` and `displayName: 'Merchant Atoll'`, even though the canon doc explicitly lists them as "hidden, reserved for future side content" and even though their matching landmark entries (`lm_lighthouse`, `lm_merchant`) correctly use `label: ''`.

**Why it matters:** if the world renderer paints region `displayName`, the live map shows five labelled islands instead of three — breaking the canon promise that only Whisper, Tempest, and Saint's are canonical visible islands during Chapter 4.

**Risk if left:** small but visible: players see two names that have no in-game story, role, or trigger, and Chapter 4 sea content feels noisy.

**Fix (out of scope for this audit):** set both region `displayName`s to `''` and verify the renderer no longer surfaces them. No `SAVE_VERSION` impact (regions aren't saved). No game-rule change.

### Finding B — player start sits inside an encounter zone

**File:** `src/game/data/maps/elerion-world-config.ts` lines 114–115, 547
**What:** `playerStartX=220, playerStartY=2740` is inside `thornwood_zone` (x:100–1060, y:2280–2860). Dawnkeep landmark covers x:140–270, y:2740–2850 — overlapping the encounter zone in the same area.

**Why it matters:** depending on how `EncounterTracker` interacts with landmarks, a brand new player at step 1 could roll a Thornwood encounter — fine if there's a 6-step buffer at game start, undesirable if not. The Thornwood zone is also reserved as the future Ch 1 "first taste of corruption" area, so leaving it as the start-step encounter zone may be acceptable design — but it should be a *choice*, not a side effect.

**Fix (out of scope for this audit):** either move the spawn point north by ~80–120 px so it sits inside Dawnkeep proper and clear of the encounter zone, or confirm that the Thornwood encounter zone is supposed to overlap Dawnkeep and accept the gameplay implication. No `SAVE_VERSION` impact — existing saves carry their own coordinates.

### Finding C — encounter-zone display name is off-canon: "Greymarsh Frontier"

**File:** `src/game/data/maps/elerion-world-config.ts` line 569
**What:** `eastern_frontier_zone` has `displayName: 'Greymarsh Frontier'` while the canon name (and the matching region's `displayName`) is `Greymarsh Wilds`.
**Fix (out of scope):** rename the zone's display name to `Greymarsh Wilds` to match canon. No id rename, no save impact.

### Finding D — Riverrun landmark uses `kind: 'gate'`

**File:** `src/game/data/maps/elerion-world-config.ts` line 447
**What:** Riverrun is `kind: 'gate'`. Canon describes it as the eastern river-crossing city (a small town scene, eventually). The `'gate'` icon may misread on the map.
**Fix (out of scope):** consider `kind: 'town'` or a new `kind: 'fortified_town'` if available. Cosmetic only.

### Finding E — `Verdant River` label may render four times

**File:** `src/game/data/maps/elerion-world-config.ts` lines 188–230
**What:** four river regions each carry `displayName: 'Verdant River'`. Depending on the renderer, the same label may paint four times along the river.
**Fix (out of scope):** keep the label on a single segment (e.g. only the longest one), blank the others. Cosmetic.

### Finding F — `blightlands_zone` shows a hidden region's name

**File:** `src/game/data/maps/elerion-world-config.ts` line 581
**What:** encounter zone `blightlands_zone` has `displayName: 'Black Reach'`, but the `black_reach` region itself has its label hidden because it's reserved (canon §10). Player will see `Black Reach` only when they walk into the encounter zone — likely fine, but worth a conscious decision.
**Fix (out of scope):** either rename the zone to a generic descriptor or accept that "Black Reach" surfaces at Chapter 6.

---

## 6. Story-readiness check (Chapter 1 path)

The early-story path is:

> Dawnkeep → Verdant Fields → Eldric → Dawnkeep return → Eldric → Riverdale → Everdawn Forest north edge / bandit area → clue toward Stonegate / Northwind Pass.

| Need | Present? | Notes |
|---|---|---|
| Dawnkeep as starting town placeholder | **yes (landmark only, no town scene)** | `lm_start_village` exists at canonical SW. No TownScene yet — that's the canon §7 next step. Adding a scene is fully unblocked; the world side is ready. |
| Eldric as current working town scene via `lumen_town` | **yes** | `LOCATIONS.lumen_town` is a TownScene-type; trigger `lumen_town_entrance` is wired. Display name is already `Eldric`. |
| Riverdale as visible placeholder / chokepoint | **yes (landmark only, no trigger)** | The landmark and the bridge structure are present. No entry trigger yet (deferred per canon §12.4). Easy to add an inactive placeholder trigger. |
| Everdawn Forest as region | **yes** | `evergreen_forest` region (200, 800, 620×540) + `western_forest_zone` encounter zone. |
| Reasonable northern Everdawn / bandit hideout area | **yes (room available)** | Everdawn extends up to y=1340; nothing currently occupies its north edge. Plenty of space for a bandit hideout scripted-battle or trigger. |
| Stonegate / Northwind Pass as next-chapter direction | **yes** | Stonegate landmark + Northwind Pass zone + an existing `mountain_pass_boss` trigger (Shadecaster Veyr) flag-gated by `SERELLE_JOINED` and consumed by `BOSS_VEYR_DEFEATED`. The Ch 3 boss is already wired (per canon §5 it just needs to be retrofitted to fit Chapter 3 narrative). |
| Ability to keep Riverdale bridge gated later | **yes, design-only at the moment** | The Bridgeford gap is currently walkable rocky terrain. To gate it, the future repair-flag pattern would either (a) introduce a `bridge_repaired` flag and a collision rect that disappears when set, or (b) drop a `WorldTrigger` blocking the gap. Today the map supports either — no structural change required. |
| Ability to keep Eldric politically important later | **yes** | Eldric is the only TownScene on the western continent, has the canonical capital placement, and is on every early-route line. |

**Verdict:** Chapter 1 is fully supported. Chapter 2 (Eldric → Verdant Fields → Riverdale) is fully supported. Chapter 3 entry (Riverdale → Northwind Pass → Stonegate) is fully supported and even has the boss trigger already wired.

---

## 7. Recommended corrections before story implementation

Order matters here — do A first, the rest can be batched.

1. **A. Hide the two non-canon island region labels.** Blank `displayName` on `lighthouse_isle` and `merchant_atoll` regions. (Their landmark labels are already hidden.) No save impact.
2. **B. Decide what to do about the player start vs. Thornwood overlap.** Either move spawn slightly N (e.g. y: 2680 → still inside Dawnkeep landmark and clear of the encounter zone), or explicitly document the overlap as Chapter 1 design intent.
3. **C. Rename `eastern_frontier_zone` display name to `Greymarsh Wilds`.** Single-line zone-label fix.
4. **E. Reduce `Verdant River` label duplication.** Keep the name on the longest segment; blank the other three.

(Item D — Riverrun kind, and item F — Black Reach zone label — can wait.)

None of these need a `SAVE_VERSION` bump (regions, zones, and the start coordinate aren't persisted shape-of-state changes).

---

## 8. Corrections that can wait

- **Item D — Riverrun landmark `kind`.** Cosmetic; will likely sort itself out when Riverrun becomes a small TownScene in Chapter 5 prep.
- **Item F — `blightlands_zone` label surfaces `Black Reach`.** Players don't see it until Chapter 6; we can decide then.
- **Landmark placeholders for canonical major locations without scenes** (Dawnkeep, Riverdale, Stonegate, Harborwatch, Riverrun, Warfortress, Black Citadel) — adding inactive triggers so the SPACE prompt labels each is the canon §12.4 next step; it's planned, just not part of this audit.
- **Ferry triggers `west_port_ferry` / `east_port_ferry`.** Sea routes are wired in `seaRoutes[]` but the trigger ids they reference don't exist on the map yet. That's the canon §12.3 next step.
- **Encounter zone overlap at start village** — see item B above; if we resolve B by moving the spawn, also re-check the Dawnkeep landmark vs. zone overlap is still tolerable.

---

## 9. Output summary

1. **Files created:**
   - [docs/reference/world-map-implementation-blueprint.svg](reference/world-map-implementation-blueprint.svg)
   - [docs/world-map-implementation-audit.md](world-map-implementation-audit.md) *(this file)*
2. **Short summary of findings:** the live world map is structurally faithful to the canonical reference and ready for story authoring; two real findings (island label leak, start-vs-Thornwood overlap) plus three small label-consistency cleanups should be resolved before Chapter 1 dialogue is written.
3. **Does the implemented map match the reference well enough?** Yes — for story planning and for Chapter 1–3 authoring. No structural redesign is needed.
4. **Missing canonical places:** none. All twenty-one canonical names are present.
5. **Extra visible non-reference places:** two — `Lighthouse Isle` and `Merchant Atoll` region labels currently leak through despite the landmarks being hidden.
6. **Wrong or questionable positions:** none structurally. Coordinates match `docs/world-regions.md` design positions exactly.
7. **Is the Chapter 1 path supported?** Yes — every beat (Dawnkeep, Verdant Fields edge, Everdawn Forest, Eldric arrival, Riverdale chokepoint, Northwind Pass / Stonegate horizon) exists on the map; landmark scenes for Dawnkeep and Riverdale are the only authoring gaps.
8. **Blueprint:** [docs/reference/world-map-implementation-blueprint.svg](reference/world-map-implementation-blueprint.svg)
9. **Recommended next prompt:**
   > "Apply map-correction pass: (a) blank `displayName` on the `lighthouse_isle` and `merchant_atoll` regions; (b) move `playerStartY` to clear `thornwood_zone` (or document the overlap intent); (c) rename `eastern_frontier_zone.displayName` to `Greymarsh Wilds`; (d) keep `Verdant River` label on only the longest river segment. No id rename, no `SAVE_VERSION` bump expected. Provide a focused diff and a screenshot of the world map after the change."

Ready for map-correction prompt if approved.

---

## 10. Correction pass applied (2026-05-28)

All four high-priority audit findings have been applied to `src/game/data/maps/elerion-world-config.ts` in a single focused pass. The blueprint at [docs/reference/world-map-implementation-blueprint.svg](reference/world-map-implementation-blueprint.svg) has been refreshed to match. No technical ids were changed; no game systems were touched; `SAVE_VERSION` was not incremented.

### What changed

| Audit finding | Resolution | File / lines |
|---|---|---|
| **A — Lighthouse / Merchant island region labels leak** | `lighthouse_isle` and `merchant_atoll` region `displayName` set to `''`. Region geometry and the matching landmark entries are untouched, so both islands remain on the map as side-content placeholders with no visible name. Only the three canonical islands now name themselves: **Whisper Isle**, **Saint's Isle**, **Tempest Isles**. | `elerion-world-config.ts` (central-sea regions block, around lines 233–244) |
| **B — Dawnkeep start vs Thornwood encounter overlap** | Chose Option B (zone-shrink) as the smallest data-only fix. `thornwood_zone` shrunk from `(x:100, y:2280, w:960, h:580)` → `(x:320, y:2280, w:740, h:580)`. The encounter zone now starts ~50 px east of the Dawnkeep landmark's east edge (x=270) and ~100 px east of the player spawn (x=220), giving the player roughly three steps of buffer when walking east. The **visual** `thornwood_region` corruption patch is unchanged — the village still sits inside the corrupted-forest tone for narrative continuity, but mechanically there are no random encounters in or immediately adjacent to Dawnkeep. Future Chapter 1 corruption content remains fully possible: the visual region is intact, the zone still covers the bulk of the SW corruption area, and the player walks straight into the zone as soon as they head ENE along `west_main_road`. | `elerion-world-config.ts` `zones[]` — `thornwood_zone` |
| **C — `Greymarsh Frontier` zone label off-canon** | `eastern_frontier_zone.displayName` renamed `'Greymarsh Frontier'` → `'Greymarsh Wilds'`. Zone id unchanged. Now matches both the canonical reference name and the region's own `displayName`. | `elerion-world-config.ts` `zones[]` — `eastern_frontier_zone` |
| **E — `Verdant River` label duplicated across four segments** | Kept the label on the longest segment (`verdant_river_n`, height 1040). Blanked `displayName` on `verdant_river_s1` (height 860), `verdant_river_bend` (height 80), and `verdant_river_s2` (height 760). River geometry, collision, and the Bridgeford bridge are unchanged. | `elerion-world-config.ts` `regions[]` — verdant_river segments |

### Findings intentionally left for later

Per the correction-prompt scope, these are still **deferred**:

- **D** — Riverrun landmark `kind: 'gate'` (cosmetic; revisit when Riverrun becomes a small TownScene).
- **F** — `blightlands_zone` surfaces the otherwise-hidden `Black Reach` name at Chapter 6 (cosmetic; revisit during Chapter 6 design).
- Ferry triggers (`west_port_ferry` / `east_port_ferry`) — canon §12.3 next step.
- Inactive placeholder town triggers for Dawnkeep, Riverdale, Stonegate, Harborwatch, Riverrun, Warfortress, Black Citadel — canon §12.4 next step.

### Invariants the correction pass preserved

- **No technical ids changed.** Every region, landmark, road, zone, and trigger id is identical to its pre-pass value.
- **No coordinates moved** except the `thornwood_zone` x/width (chosen explicitly to resolve the start-overlap finding).
- **No collision rects changed.** River and mountain collision geometry is byte-identical to before.
- **No roads changed.** All seven roads keep their points lists exactly as they were.
- **No save shape change** — `SAVE_VERSION` is unchanged and saves from the previous build remain compatible.
- **No new dependencies, no new scenes, no new state actions, no new gameplay systems.**

### Verification (post-pass)

- `npm run typecheck` — passed (no real errors; only the documented TS2339/TS2307 ambient noise expected in the Claude container).
- `npm run build` — passed.

The blueprint and this audit are now in sync with the current code; the map is ready for story-design continuation.
