# Saga of the Lightning Warrior — World Regions

## 1. Purpose

This document defines the **canonical region identity** layer for the world of Elerion — the creative meaning that sits on top of the canonical map layout.

It comes **after** the canonical map foundation (commit `06a27b4`, `docs/world-map-canon.md`, `docs/reference/world-map-overview.png`) and **before** ferry travel, quest design, town scene refits, and final art. Everything below is design-only; nothing here changes game code.

Use this doc as the source of truth for:
- what each region means (tone, role, encounter feel)
- the six-chapter world progression
- which gates control movement between chapters
- which locations eventually need town scenes vs world-map-only landmarks
- recruit / party-member role placement
- future visual direction

---

## 2. Canonical Map Rules

- `docs/reference/world-map-overview.png` is the primary layout reference.
- `docs/world-map-canon.md` defines canonical naming and the placeholder→canon mapping table.
- **Player-facing display names** are canonical (e.g. `Eldric`, `Dreadshore`, `Northwind Pass`).
- **Technical IDs are stable implementation details** and may still use older names (e.g. the capital's technical id is `lumen_town`, the river-crossing landmark is `lm_bridgeford`, the SW village is `lm_start_village`). Do not rename technical ids without a `SAVE_VERSION` bump and a full audit.
- Non-reference placeholders (see Appendix §10) are **reserved for future side content**. They keep their geometry but their visible labels are hidden until they're given a canonical role.

---

## 3. High-Level World Identity

- **Western continent — kingdom heartland.** Green, civilised, agrarian. The world the hero is trying to save. Mountains in the north, river bisecting east-west, plains and forests below.
- **The Central Sea — the act break.** A real journey, not a quick warp. Three islands break the crossing into something memorable.
- **Eastern continent — war-torn frontier.** Harsher, dryer, more contested. The corruption's expansion zone. A second great river splits it; beyond lies the dark final region.
- **Black Citadel — the source.** The dark power that drives the conflict. Far NE, visible from miles away once the player reaches the east.

Core journey:

```
Dawnkeep → Verdant Fields → Eldric → Riverdale → Northwind Pass / Stonegate
        → Harborwatch → The Central Sea → Dreadshore → Riverrun → Warfortress
        → Twilight Grove → Black Citadel
```

Twelve major beats, six chapters, two continents. The player **walks every chokepoint** at least once on the main route.

---

## 4. Region Identity Table

Each entry below is the canonical creative spec for that region or landmark. Coordinates referenced are world-space at the 5120×2880 scale.

### Dawnkeep
- **Map position:** SW corner of the western continent (~140, 2740).
- **Visual identity:** small thatched village, wooden palisade, a single bell tower, low orchards.
- **Emotional tone:** peace tinged with first unease — the corruption is nibbling at the edges.
- **Gameplay role:** starting hub; tutorialises movement, dialogue, interaction, and the first encounter zone.
- **Story role:** the hero's home; the inciting incident happens here.
- **Encounter feel:** none in town; first encounters in the corrupted edge south of the village.
- **Chapter:** **Chapter 1**, start.
- **Scene role:** **small town scene** (eventually).
- **Memorable hook:** the bell of Dawnkeep ringing as the player leaves for the first time.

### Verdant Fields
- **Map position:** broad central-west region (~80–2300 × 60–2820 base plains).
- **Visual identity:** rolling farmland, neat dirt roads, lone trees, occasional waypost or shrine.
- **Emotional tone:** heroic country — this is the kingdom worth defending.
- **Gameplay role:** connective tissue between major hubs; the main road runs through here.
- **Story role:** the heart of the heartland; what the hero is fighting to save.
- **Encounter feel:** low — patrol skirmishes, the rare beast off-road.
- **Chapter:** **Chapter 1 → 2**, the long road north.
- **Scene role:** **region only** (no entry scene).
- **Memorable hook:** the road home from Eldric — the player walks this multiple times across chapters.

### Highland Ruins
- **Map position:** west coast, mid-vertical (~140, 1660).
- **Visual identity:** half-buried stone pillars, weathered statues, broken arch.
- **Emotional tone:** old, quiet, a kingdom older than the current one.
- **Gameplay role:** optional dungeon; gear-tier upgrade.
- **Story role:** a knight's tomb / pre-kingdom lore.
- **Encounter feel:** uncommon but mid-tier mobs.
- **Chapter:** **Chapter 2** side.
- **Scene role:** **optional dungeon** (scripted-battle chain — no full interior needed).
- **Memorable hook:** find an old sword shrouded in cobweb; first taste of "this world is older than you think".

### Riverdale
- **Map position:** at the Verdant River bridge crossing (~1390, 1020) — Bridgeford is the stone bridge inside the village.
- **Visual identity:** riverside houses, an old mill, lantern poles, the bridge as a strong silhouette.
- **Emotional tone:** quiet bottleneck — strangers passing through, news from every direction.
- **Gameplay role:** first physical chokepoint after the heartland; quest hub.
- **Story role:** "the bridge stones are damaged" — Chapter 2 main quest.
- **Encounter feel:** very light — the village is on the road.
- **Chapter:** **Chapter 2** climax.
- **Scene role:** **small town scene** (eventually).
- **Memorable hook:** the player has to earn the bridge crossing — the world reveals it has gates.

### Eldric
- **Map position:** central-west, west of the river (~1000, 720).
- **Visual identity:** walled stone city, banner-bearing manor, market plaza, lamp-lit cobbles.
- **Emotional tone:** ordered prosperity with cracks showing — the throne is uneasy.
- **Gameplay role:** main hub. Inn, shop, save crystal, NPC chain, party gathering.
- **Story role:** the wider conflict is revealed; political stakes; the writ to pass Stonegate.
- **Encounter feel:** none in city.
- **Chapter:** **Chapter 1 end** (arrival) → **Chapter 2** main.
- **Scene role:** **full town scene** (the existing `lumen_town` TownScene, refit to canon names).
- **Memorable hook:** first big interior space; the city feels lived-in.

### Everdawn Forest
- **Map position:** mid-west (~200, 800, 620×540).
- **Visual identity:** mossy canopy, narrow forest road, occasional shaft of light.
- **Emotional tone:** older than the kingdom; not hostile, but watchful.
- **Gameplay role:** optional encounter forest; hides Light's Sanctuary on its southern edge.
- **Story role:** the road from Dawnkeep to Eldric threads its eastern edge.
- **Encounter feel:** stealthy mobs — beasts, fae echoes.
- **Chapter:** **Chapter 1 → 2**.
- **Scene role:** **region only**.
- **Memorable hook:** a hidden glade with a small unique encounter the player remembers.

### Northwind Pass
- **Map position:** the N–S corridor through Silverwall Mountains (x:1100-1300, y:280-500).
- **Visual identity:** narrow rocky pass between snow-touched peaks, watchfires on either ridge.
- **Emotional tone:** ascending — leaving the heartland behind.
- **Gameplay role:** the main north chokepoint; encounter zone.
- **Story role:** the path to the older truth in the tundra.
- **Encounter feel:** mid-tier organised forces and the occasional dark acolyte.
- **Chapter:** **Chapter 3**.
- **Scene role:** **region only** (the pass corridor itself).
- **Memorable hook:** the wind sound — and the first time the player sees snow ahead.

### Frostnorth Tundra
- **Map position:** snow band along the top of the western continent (y:60-280).
- **Visual identity:** blue-white snowfields, dark stone, sparse pine, faint aurora.
- **Emotional tone:** remote isolation; a place outside the kingdom's eye.
- **Gameplay role:** optional late-Ch-3 exploration zone; mid-high encounters.
- **Story role:** a hidden monastery / older order; ties to the lightning theme.
- **Encounter feel:** frost-touched beasts, cold-attuned acolytes.
- **Chapter:** **Chapter 3** optional; revisitable late-game.
- **Scene role:** **region only** (with possibly one scripted shrine event).
- **Memorable hook:** cold biome is rare in JRPGs at this point in a game and stands out.

### Stonegate
- **Map position:** gate city at the Northwind Pass (~1100, 300).
- **Visual identity:** stone gatehouse straddling the corridor, garrison banners.
- **Emotional tone:** watch-tower vigilance — the last bulwark before the tundra.
- **Gameplay role:** chapter chokepoint; flag-gated until the player has the throne's writ.
- **Story role:** site of the Chapter 3 boss encounter.
- **Encounter feel:** small detachments at the gate.
- **Chapter:** **Chapter 3** climax.
- **Scene role:** **dungeon / scripted-battle location** (no full interior needed — a gate vignette + scripted battle is enough).
- **Memorable hook:** the boss showdown at the gate is the world's first "named threat" beat.

### Silverwall Mountains
- **Map position:** top E–W mountain barrier (y:280-500 across most of the western continent). Northwind Peaks is the NW snowy sub-cluster of this range.
- **Visual identity:** grey stone walls with silvered snow caps; not climbable.
- **Emotional tone:** the world has a hard edge — there are places you cannot just walk.
- **Gameplay role:** structural backdrop; defines that the only northward route is through Northwind Pass.
- **Story role:** background; the range itself isn't entered.
- **Encounter feel:** n/a (impassable).
- **Chapter:** all.
- **Scene role:** **region only**.
- **Memorable hook:** silhouettes the entire northern horizon from the heartland.

### Light's Sanctuary
- **Map position:** south-central western continent (~880, 2440).
- **Visual identity:** small open shrine, candles, simple stone steps.
- **Emotional tone:** still, sacred, restful.
- **Gameplay role:** safe-zone shrine; first religious/spiritual story beat.
- **Story role:** a cleric/healer recruit is based here.
- **Encounter feel:** none.
- **Chapter:** **Chapter 1 → 2**.
- **Scene role:** **world-map landmark only** initially; possibly a small scene later if used for a quest.
- **Memorable hook:** the bell of Light's Sanctuary answers the bell of Dawnkeep — a small audio motif.

### Harborwatch
- **Map position:** SE coast of the western continent (~2080, 1800).
- **Visual identity:** stone harbour wall, fishing rigs, single ship at dock, dock crane.
- **Emotional tone:** hopeful — outbound, the world is about to get larger.
- **Gameplay role:** west port; future ferry node.
- **Story role:** Chapter 3 ending — the hero commits to leaving the homeland.
- **Encounter feel:** none in town; light along the coast road.
- **Chapter:** **Chapter 3 end**.
- **Scene role:** **small town scene** (eventually) + **port/ferry node**.
- **Memorable hook:** first time the player sees a real ship; the "the world opens up" moment.

### The Central Sea
- **Map position:** band between the two continents (x:2300-3200, full height).
- **Visual identity:** open dark-blue water, scattered foam, island silhouettes.
- **Emotional tone:** scale — the world is bigger than the kingdom.
- **Gameplay role:** structural barrier crossed only via ferry; later a fast-travel substrate.
- **Story role:** the Chapter 4 crossing — includes a scripted storm/creature beat.
- **Encounter feel:** **no random encounters at sea.** Only scripted ship-deck events.
- **Chapter:** **Chapter 4** main.
- **Scene role:** **region only**.
- **Memorable hook:** the sky over the central sea looks different from anywhere else.

### Whisper Isle
- **Map position:** northern island (~2470, 400).
- **Visual identity:** small windswept rock, a single ruined tower.
- **Emotional tone:** secretive — the wind seems to carry voices.
- **Gameplay role:** optional late-game lore stop.
- **Story role:** an oracle / hidden recruit. Maybe ties to the lightning theme.
- **Encounter feel:** none ambient; possibly a scripted hidden encounter.
- **Chapter:** **Chapter 6+** revisits.
- **Scene role:** **world-map landmark only**.
- **Memorable hook:** voices the player can't quite hear.

### Tempest Isles
- **Map position:** southern central-sea island cluster (~2500, 2300).
- **Visual identity:** jagged storm-lashed rocks, broken masts on a beach.
- **Emotional tone:** raw weather; danger.
- **Gameplay role:** optional dungeon; storm-themed boss; lightning attunement rite.
- **Story role:** the hero's power is tested or upgraded here.
- **Encounter feel:** storm-elemental mobs, scripted boss.
- **Chapter:** **Chapter 4–5** optional.
- **Scene role:** **optional dungeon** (scripted-battle chain).
- **Memorable hook:** weather effect overlay sells the storm.

### Saint's Isle
- **Map position:** central-southern sea (~2780, 1840). *(Repurposed from the old "Storm Shrine" placeholder.)*
- **Visual identity:** quiet stone monastery on a sun-warmed rock.
- **Emotional tone:** sanctuary at sea — relief during the crossing.
- **Gameplay role:** mid-Ch-4 stopover; safe save point on the sea route.
- **Story role:** an exiled priest with eastern war news.
- **Encounter feel:** none.
- **Chapter:** **Chapter 4** main.
- **Scene role:** **world-map landmark only** for now (no scene needed).
- **Memorable hook:** the contrast — calm island in the middle of a tense crossing.

### Dreadshore
- **Map position:** west coast of the eastern continent (~3280, 1500).
- **Visual identity:** weathered docks, half-burned palisade, militia at the gate.
- **Emotional tone:** tense arrival — this is not the heartland.
- **Gameplay role:** east hub; inn, shop, save; quest density.
- **Story role:** the eastern war becomes real; first eastern recruit.
- **Encounter feel:** none in town.
- **Chapter:** **Chapter 4 end** / **Chapter 5** main.
- **Scene role:** **full town scene** (the existing `ashenveil_town` TownScene, refit to canon names and tone).
- **Memorable hook:** noticeably poorer and tenser than Eldric — the eastern continent introduces itself through a town.

### Riverrun
- **Map position:** at the Ironflow River crossing (~3800, 1180).
- **Visual identity:** stone fortifications around an iron-spanned bridge; siege scars.
- **Emotional tone:** holding the line — desperate but standing.
- **Gameplay role:** Chapter 5 chokepoint; siege quest hub.
- **Story role:** the player helps break or hold the siege to earn safe passage east.
- **Encounter feel:** scripted skirmish on the bridge.
- **Chapter:** **Chapter 5** climax.
- **Scene role:** **small town scene** (eventually) — the most narratively-loaded new town.
- **Memorable hook:** the bridge itself — the only crossing — visible from far off.

### Greymarsh Wilds
- **Map position:** broader eastern wild region (rocky base of the eastern continent west of the river).
- **Visual identity:** rocky scrubland, dust, scorched earth, refugee camps.
- **Emotional tone:** the war's edge — silent, watchful, sometimes haunted.
- **Gameplay role:** first eastern encounter zone; the road between Dreadshore and Riverrun.
- **Story role:** the player learns the cost of the war from people displaced by it.
- **Encounter feel:** enemy patrols, dark acolytes, occasional ridge fang.
- **Chapter:** **Chapter 4 end → Chapter 5**.
- **Scene role:** **region only**.
- **Memorable hook:** a burned-out farm or refugee column tells the player the war is real.

### Twilight Grove
- **Map position:** eastern dark forest (~4040, 1800) — east of Riverrun.
- **Visual identity:** purple-tinged trees, gnarled roots, sickly wisp glow.
- **Emotional tone:** dread — the corruption has eaten this forest from within.
- **Gameplay role:** Chapter 6 traversal zone; secondary route to the Citadel.
- **Story role:** the corruption is shown doing something — a redeemable lost knight here.
- **Encounter feel:** heavy corrupted-wisp swarms; thematic callback to early-game corruption.
- **Chapter:** **Chapter 5 end → Chapter 6**.
- **Scene role:** **region only** with possibly one scripted recruit event.
- **Memorable hook:** visual rhyme with the Dawnkeep-edge corruption from Chapter 1 — the player now understands what was at the start.

### Warfortress
- **Map position:** east-central, beyond the Ironflow (~4220, 720).
- **Visual identity:** black-stone keep with iron banners, gate machinery, watch braziers.
- **Emotional tone:** enemy stronghold — first true "boss castle".
- **Gameplay role:** Chapter 5 climax dungeon.
- **Story role:** break the corrupted general who commands the eastern front.
- **Encounter feel:** dungeon-flavoured fights ending in a multi-form boss.
- **Chapter:** **Chapter 5** climax.
- **Scene role:** **dungeon / scripted-battle location** (no full interior scene — a scripted-battle chain with intercutting dialogue is enough).
- **Memorable hook:** the first dungeon the player walks into and is supposed to feel outmatched.

### Black Citadel
- **Map position:** far NE (~4760, 280) within the corruption strip around it.
- **Visual identity:** obsidian spires, purple bleed, sigils carved into the stone.
- **Emotional tone:** arrival at the source.
- **Gameplay role:** final dungeon corridor and three-stage final boss.
- **Story role:** Chapter 6 climax — lightning vs the dark power.
- **Encounter feel:** dense, hard, themed exclusively around the dark power.
- **Chapter:** **Chapter 6** climax.
- **Scene role:** **final dungeon** (scripted-battle chain).
- **Memorable hook:** the destination the player has been seeing on the horizon since Chapter 4.

---

## 5. Six-Chapter Progression

The geography itself paces the story. Each chapter ends at a chokepoint that opens at the next chapter's start.

### Chapter 1 — *The Quiet Greenlands*
- **Theme:** home; first taste of corruption; reaching the capital.
- **Start:** Dawnkeep.
- **End:** arrival at Eldric.
- **Newly accessible:** Dawnkeep, Verdant Fields, Everdawn Forest, Light's Sanctuary, Eldric south gate.
- **Main objective:** investigate the corruption stalking the edge of Dawnkeep; reach Eldric to warn the throne.
- **Required route:** Dawnkeep → Verdant Fields (with road wending through Everdawn Forest's edge) → Eldric.
- **Chokepoint:** none hard (open road).
- **Major town/dungeon visited:** Dawnkeep, Eldric.
- **Possible recruit:** a cleric/healer from Light's Sanctuary OR a knight from Eldric.
- **Boss/climax:** a corrupted-forest entity in the edge south of Dawnkeep (rewires the disabled "Investigate Clearing" placeholder).
- **World map state change:** Dawnkeep corrupted edge cleared (consumed flag).
- **Revisit:** Dawnkeep always reachable for personal NPC scenes.

### Chapter 2 — *The Capital and the Crossing*
- **Theme:** politics; the wider conflict revealed; the river opens.
- **Start:** Eldric.
- **End:** crossing the Verdant River at Riverdale.
- **Newly accessible:** Eldric interior, Highland Ruins (optional), Riverdale.
- **Main objective:** lobby the throne for action; learn the war in the east is real; help Riverdale repair the bridge.
- **Required route:** Eldric → Verdant Fields → Riverdale (bridge repair quest).
- **Chokepoint:** Verdant River at Bridgeford.
- **Major town/dungeon visited:** Eldric (deeper), Riverdale.
- **Possible recruit:** a mage at Highland Ruins OR a river scout at Riverdale.
- **Boss/climax:** ambush of corrupted soldiers at the bridge (scripted).
- **World map state change:** Bridgeford crossing flag set; east-of-river western continent now traversable; Stonegate visible on the horizon.
- **Revisit:** Highland Ruins and Everdawn Forest reachable for the rest of the game.

### Chapter 3 — *North to the Frozen Gate*
- **Theme:** cold truth; older corruption; prepare for the sea.
- **Start:** Riverdale.
- **End:** Harborwatch (boarding the ship).
- **Newly accessible:** Northwind Pass, Stonegate, Frostnorth Tundra (optional), Harborwatch.
- **Main objective:** pass Stonegate with the throne's writ; uncover the older corruption story in the tundra; reach Harborwatch with sea passage approved.
- **Required route:** Riverdale → Northwind Pass → Stonegate → (south detour to) Harborwatch.
- **Chokepoint:** Stonegate (flag-gated by the throne's writ).
- **Major town/dungeon visited:** Stonegate (vignette), Harborwatch.
- **Possible recruit:** a mountain monk in the tundra OR the garrison captain at Stonegate.
- **Boss/climax:** the Shadecaster encounter at Stonegate (existing scripted-battle trigger, retrofitted to fit Chapter 3).
- **World map state change:** ferry to the eastern continent unlocked.
- **Revisit:** Frostnorth Tundra reachable for the rest of the game.

### Chapter 4 — *The Sea Opens*
- **Theme:** scale; the world is bigger than the kingdom; arrival.
- **Start:** Harborwatch (boarding).
- **End:** Dreadshore (East Port).
- **Newly accessible:** The Central Sea (via ferry), Saint's Isle, Tempest Isles (visible, optional), Dreadshore.
- **Main objective:** cross the sea, survive a storm event, arrive at Dreadshore, learn the eastern war first-hand.
- **Required route:** Harborwatch → Saint's Isle (forced stopover) → Dreadshore.
- **Chokepoint:** the ferry itself (flag-gated).
- **Major town/dungeon visited:** Saint's Isle (vignette), Dreadshore.
- **Possible recruit:** a ship captain (forced join) OR a refugee character at Dreadshore.
- **Boss/climax:** scripted storm-creature event during the crossing.
- **World map state change:** eastern continent is now active; ferry can be re-used; Tempest Isles becomes accessible for the optional dungeon.
- **Revisit:** ferries west allowed.

### Chapter 5 — *Warfields and the Bridge*
- **Theme:** war on the ground; the cost; breaking the enemy's spine.
- **Start:** Dreadshore.
- **End:** fall of Warfortress.
- **Newly accessible:** Greymarsh Wilds, Riverrun, Warfortress.
- **Main objective:** cross Greymarsh to Riverrun; help break the siege; assault Warfortress.
- **Required route:** Dreadshore → Greymarsh Wilds → Riverrun (siege chain) → east of Ironflow → Warfortress.
- **Chokepoint:** Ironflow River at Riverrun.
- **Major town/dungeon visited:** Riverrun, Warfortress.
- **Possible recruit:** a defector at Riverrun OR a siege engineer.
- **Boss/climax:** corrupted general at Warfortress (multi-form boss).
- **World map state change:** eastern continent inland safe-ish; Twilight Grove and Black Citadel now ominously visible.
- **Revisit:** Whisper Isle now accessible.

### Chapter 6 — *Into the Black Citadel*
- **Theme:** confrontation; the source; lightning vs shadow.
- **Start:** Warfortress (or Riverrun if resting).
- **End:** Black Citadel — final boss.
- **Newly accessible:** Twilight Grove, the corridor to Black Citadel, Black Citadel itself.
- **Main objective:** reach and destroy the Citadel.
- **Required route:** through Twilight Grove → Black Citadel.
- **Chokepoint:** the corruption barrier into the Citadel approach (lifted by Ch-5 victory + a hero-power moment).
- **Major town/dungeon visited:** Black Citadel.
- **Possible recruit:** a redeemed corrupted knight in Twilight Grove (very late recruit, optional).
- **Boss/climax:** the dark power's avatar in three stages.
- **World map state change:** corruption fades; postgame opens.
- **Revisit:** fast travel unlocked for all reachable nodes.

---

## 6. Gating and Unlock Structure

Every gate is a place the player physically encounters — none are abstract menu locks.

| Gate | What blocks the player | Unlock | Chapter | Mechanism | Why it feels natural |
|---|---|---|---|---|---|
| Riverdale (Verdant River) | Damaged bridge story-blocker on top of the literal river | Ch 2 sidequest: help Riverdale repair the bridge | Ch 2 | Story flag toggles a "repaired" road sprite + the visible barrier is removed | A river you can see; the bridge is the only way |
| Stonegate (Northwind Pass) | Garrison won't let civilians through during the alert | Ch 3 plot beat: throne's writ delivered | Ch 3 | Flag-gated `WorldTrigger` (existing scripted-battle pattern) | A literal gate; soldiers explain |
| Harborwatch (sea travel) | No ferry yet | Ch 3 plot beat: throne approves passage | Ch 3 end | `chapter_3_sea_travel_unlocked` flag (already reserved); ferry trigger appears on dock | Ships don't sail without orders |
| Central Sea islands | All visible from sea, but only Saint's Isle + Lighthouse-equivalent reachable initially | Whisper Isle: Ch 6; Tempest Isles: Ch 4 mid / Ch 5 | Ch 4–6 | Per-island ferry route in `seaRoutes[]` with `requiresFlag` | Each island earns its route |
| Dreadshore arrival | Cannot disembark before Ch 4 | Story flag `arrived_east` set after sea-crossing scripted scene | Ch 4 | Auto-trigger on dock landing | The boat lands here |
| Riverrun (Ironflow) | The Ironflow bisects the eastern continent; Iron Bridge is the only crossing, and it is contested | Ch 5 main: help defend the city, earn the crossing | Ch 5 | Quest flag `ironbridge_secured` opens the bridge | A besieged city won't let you pass during fighting |
| Warfortress | Outer wards closed | Ch 5 plot beat: defeat outer commander | Ch 5 | Scripted-battle trigger | Castles need to be approached in stages |
| Twilight Grove | Reachable but encounters scale up sharply | Soft gate via encounter difficulty | Ch 5 end → Ch 6 | Encounter difficulty curve | The danger is the gate |
| Black Citadel approach | Story barrier — corruption physically opposes the player | Ch 6 beat after Twilight Grove | Ch 6 | `chapter_6_final_region_open` (already reserved) | The hero's power unlocks the final route |
| Black Citadel doors | Final dungeon doors | Final beat | Ch 6 | Final scripted-battle trigger | The end |
| Fast travel | All ports + repaired roads | Ch 6 start | Ch 6 | `fastTravelNodes[]` populated after Warfortress falls | The player has earned the world enough to move freely |

---

## 7. Town and Dungeon Priority Plan

Scoped for a solo developer. The two existing town scenes are reused; four new small scenes carry the rest of the on-foot story; everything else stays on the world map or becomes a scripted-battle chain.

### A. Existing town scenes to refit
| Canon name | Technical scene | Refit work |
|---|---|---|
| **Eldric** | `lumen_town` TownScene | rename in-town signage, NPC dialogue references; keep layout |
| **Dreadshore** | `ashenveil_town` TownScene | rename in-town signage, NPC dialogue references; reskin tone (poorer, tenser); keep layout |

### B. New town scenes eventually needed (in priority order)
1. **Dawnkeep** — start village; small footprint; carries the Ch 1 tutorial.
2. **Riverdale** — bridge village; carries the Ch 2 bridge quest.
3. **Harborwatch** — west port + ferry node; carries the Ch 3 end / Ch 4 start.
4. **Riverrun** — siege city; carries the Ch 5 climax.

That's **4 new small/mid town scenes** plus the 2 refits. Total: 6 town scenes across the whole game. Realistic.

### C. World-map-only landmarks for now
- Highland Ruins
- Light's Sanctuary
- Whisper Isle
- Saint's Isle
- Frostnorth Tundra (region)
- Silverwall Mountains (region)
- Verdant Fields (region)
- Everdawn Forest (region)
- Greymarsh Wilds (region)
- Twilight Grove (region)

### D. Dungeon / scripted-battle locations
- **Highland Ruins** — Ch 2 optional dungeon chain.
- **Tempest Isles** — Ch 4–5 optional dungeon + lightning-attunement boss.
- **Warfortress** — Ch 5 climax dungeon chain.
- **Black Citadel** — Ch 6 final dungeon chain.
- (Optional) **Twilight Grove** — a small scripted encounter for the redeemed-knight recruit.

No full interior scenes for these — each is a sequence of scripted battles + dialogue using existing `BattleScene` + `DialogueOverlay` machinery.

---

## 8. Encounter Region Identity

No stats changes here — only thematic / structural identity.

### Encounter type by region

| Region | Random encounters? | Theme |
|---|---|---|
| **Dawnkeep** (in town) | none | safe |
| **Dawnkeep corrupted edge** (Ch 1) | yes (light) | first taste of corruption |
| **Verdant Fields** | none on the main road, light off-road | bandits, wild beasts |
| **Everdawn Forest** | yes (mid) | beasts, fae echoes |
| **Highland Ruins** | yes (dungeon chain only) | older stone-guardian mobs |
| **Northwind Pass** (Ch 3) | yes (mid) | organised hostile forces, dark acolytes |
| **Frostnorth Tundra** | yes (mid-high) | frost-touched corrupted, cold beasts |
| **Stonegate** (in town) | none | safe |
| **Light's Sanctuary** | none | safe |
| **Harborwatch** (in town) | none | safe |
| **The Central Sea** | **none random**, scripted storm only | n/a |
| **Saint's Isle** | none | safe |
| **Tempest Isles** | yes (dungeon chain only) | storm elementals |
| **Whisper Isle** | none ambient | possibly scripted |
| **Dreadshore** (in town) | none | safe |
| **Greymarsh Wilds** | yes (existing) | patrols, ridge fangs, dark acolytes |
| **Riverrun** (in town) | none | safe (scripted bridge skirmish during siege) |
| **Twilight Marches → Twilight Grove** | yes (heavy) | corrupted soldiers and corrupted wisps |
| **Warfortress** | yes (dungeon chain) | hostile soldiers + boss-tier corrupted |
| **Black Citadel approach** (Black Reach) | yes (heaviest) | dark-power-themed only |
| **Black Citadel** | yes (dungeon chain) | dark-power-themed; final tier |

### Corruption progression across the journey

Chapter 1 corrupted wisps and lurkers (south of Dawnkeep) **reappear at full strength in Twilight Grove and Black Reach** in Chapter 6. The visual rhyme is intentional — the player meets the same theme at the start and at the end and understands that the corruption was always the same thing.

### Where bosses naturally sit
- Ch 1: Dawnkeep corrupted entity (rewires the disabled Grove Warden placeholder)
- Ch 2: Bridge ambush at Riverdale (scripted)
- Ch 3: Stonegate Shadecaster (existing trigger, retrofitted)
- Ch 4: storm-creature mid-sea
- Ch 5: corrupted general at Warfortress
- Ch 6: dark avatar at Black Citadel (three stages)

One major scripted fight per chapter. Sustainable.

---

## 9. Recruit / Party Placement Ideas

Roles, not final names. Each role is anchored to a region so the act of going there is the recruitment.

| Slot | Role | Anchor region | Chapter | Required vs optional | Notes |
|---|---|---|---|---|---|
| 1 | Hero (lightning warrior) | Dawnkeep | Ch 1 start | required | the player |
| 2 | Cleric / healer | Light's Sanctuary or Eldric | Ch 1 end | required | first companion |
| 3 | Knight | Eldric | Ch 2 | required | the throne's representative; gives the writ |
| 4 | Mage | Highland Ruins or Everdawn Forest | Ch 2 | optional | older-order mage |
| 5 | River scout | Riverdale | Ch 2 | optional | guides the river/mountain leg |
| 6 | Mountain monk | Frostnorth Tundra | Ch 3 | optional | cold-themed striker |
| 7 | Ship captain | Harborwatch | Ch 3 end | required | makes the sea crossing possible |
| 8 | Refugee character | Dreadshore | Ch 4 | optional | eastern voice on the war |
| 9 | Defector | Riverrun | Ch 5 | required for story, optional in combat | inside knowledge of Warfortress |
| 10 | Siege engineer | Riverrun | Ch 5 | optional | unlocks an upgrade path |
| 11 | Redeemed corrupted knight | Twilight Grove | Ch 6 | optional | last recruit; ties the Ch-1 corruption motif to the endgame |

**Cap**: 2 recruits per chapter. Each recruit gets at least one personal scene in their region.

---

## 10. Hidden / Reserved Side Content Appendix

Non-reference placeholders kept in the config with hidden labels. They retain geometry but don't appear as named main-map locations until they're given a canonical role.

| Placeholder | Current purpose | Possible future use | Stay hidden for now? |
|---|---|---|---|
| **Forest Shrine** (`lm_forest_shrine`) | landmark slot in Everdawn Forest | side dungeon / shrine for a mage recruit attunement quest | **yes** |
| **Lighthouse Isle** (`lm_lighthouse` + region) | island slot N–W of Saint's Isle | possible Ch 4 forced sea stopover (alternative to Saint's Isle) | **yes** |
| **Merchant Atoll** (`lm_merchant` + region) | island slot central sea | possible Ch 4 trade island / merchant recruit | **yes** |
| **Frontier Town** (`lm_frontier_town`) | town slot between Dreadshore and Riverrun | possible Ch 5 second eastern village / defector hub | **yes** |
| **Ancient Ruins** (`lm_ancient_ruins`) | landmark slot SE of Riverrun | possible Ch 5–6 optional lightning-lineage dungeon | **yes** |
| **Thornwood corrupted edge** (`thornwood_region`) | corrupted-forest patch south of Dawnkeep | the Ch 1 "first taste of corruption" zone — this one is most likely to come back as canon | **yes (for now)** |
| **Lumen Grove** (`lumen_grove`) | small decorative forest near Eldric | possibly named "Eldric Grove" if ever surfaced | **yes** |
| **Greymarch Dustlands** (`eastern_dustlands`) | sub-region of Greymarsh Wilds | sub-region descriptor only | **yes** |
| **Twilight Marches** (`twilight_marches`) | eastern dust band beyond the river | sub-region next to Twilight Grove | **yes** |
| **Black Reach** (`black_reach`) | corruption strip around Black Citadel | corridor descriptor for Ch 6 approach | **yes** |
| **Northwind Peaks** (`northwind_peaks`) | NW sub-cluster of Silverwall Mountains | could be re-surfaced if the mountain range needs a named peak | **yes** |

All entries keep their geometry. Surfacing one later is a single-line displayName/label change.

---

## 11. Visual Direction Notes

Defines later art direction. Nothing is implemented here — these are constraints for the eventual art pass.

### Emphasize
- **Suikoden II / PS1-era JRPG overworld readability.** Crisp silhouettes; high contrast between land and sea; clear iconography for towns / ports / dungeons.
- **Region identity at a glance.** Each region has one dominant colour and one dominant motif — Frostnorth blue + snow, Twilight Grove purple + twisted trees, Greymarsh tan + scorched.
- **Roads as clear lines.** A road must be readable even at zoom 1.25.
- **Mountains and rivers as obvious blockers.** Visual matches collision; no invisible-wall mismatches.
- **Corruption is visually distinct.** Purple bleed + sickly wisps; reusable motif from Ch-1 corrupted edge through Black Citadel.
- **Small forests with texture variation** later (when budget allows) — but only after route identity is locked.
- **Town icons** with one distinct silhouette per kind: village (thatch cluster), capital (walled rectangle with banners), port (pier + ship), gate city (gatehouse), fortress (black battlements), citadel (single tall spike).

### Avoid
- **Painterly atmospheric backgrounds** — kills readability at the greybox-to-art transition.
- **Hyperrealistic terrain** — clashes with Suikoden line clarity.
- **Modern UI affordances** (mini-icons, status pings) on the world map itself — keep the map clean.
- **Empty regions** — every region needs at least one visual element (a tree cluster, a ruin silhouette, a sigil).
- **Cluttered decoration** — the renderer perf pass dropped to ~150 shapes; future art must not regress.
- **Visual-collision mismatch** — the rule learned twice already: visible water/wall = blocked; blocked area = visible water/wall.

---

## 12. Next Implementation Recommendations

Safe order for upcoming work. Each step is independently shippable.

1. **Commit `docs/world-regions.md`.** *(this doc)*
2. **(Optional) Visual map-label review.** Walk the world with `?worldDebug=1` no-clip on, sanity-check every canon label against this document. No code changes expected.
3. **Implement ferry placeholder Harborwatch ↔ Dreadshore.** Wire the two existing `seaRoutes[]` entries to real trigger ids and add a `west_port_ferry` / `east_port_ferry` trigger on the dock landmarks. Flag-gate behind `CHAPTER_3_SEA_TRAVEL_UNLOCKED`. No new scene; just trigger + warp + dialogue.
4. **Add placeholder world-map interactions for canonical major landmarks.** Add inactive triggers (no scene yet) at Dawnkeep, Riverdale, Stonegate, Harborwatch, Riverrun, Warfortress, Black Citadel so the SPACE prompt at least labels what each place is.
5. **Design Chapter 1.** Quest beats + dialogue authored for: Dawnkeep tutorial, Thornwood-edge corruption rewire (uses existing `grove_warden` enemy + `thornwood_warden_*` dialogue), arrival at Eldric. Story flags + a new `chapter_1_complete` set.
6. **Refit Eldric and Dreadshore town display content.** Rename in-town signage / NPC lines from "Lumen"/"Ashenveil" to "Eldric"/"Dreadshore"; restyle tone for Dreadshore (poorer, tenser). Keep TownScene config geometry.
7. **Add Dawnkeep as the first new real town scene.** Smallest possible TownScene — inn modal, save crystal, two NPCs, an elder. Sets the pattern for the other three new town scenes.
8. **Add final art layers.** Defer until at least step 7 is done. Sprite swap per-layer in `world-renderer.ts` (the renderer is already structured for this).

---

*Ready for the next approved implementation prompt.*
