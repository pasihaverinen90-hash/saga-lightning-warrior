# World Map Canon

This document points at the canonical reference images for the Elerion world map and states the rules for how they should be used by future implementation work.

Current implementation aligned: commit `a659ee7` (`src/game/data/maps/elerion-world-config.ts`).

---

## Reference images

| Image | Purpose |
|---|---|
| [`docs/reference/world-map-overview.png`](reference/world-map-overview.png) | **Primary structural reference.** A map-only crop of the original planning image — both continents, the central sea, islands, roads, rivers, mountains, towns, ports, dungeons, and any labels that belong to the map itself. Use this image for placement of every geographic feature. |
| [`docs/reference/world-map-canon-full.png`](reference/world-map-canon-full.png) | **Full planning sheet.** The original image including the right-side prompt panel and the bottom documentation / story-progression / legend / key-features / map-structure boxes. Useful as background context only. |

The right-side panel and bottom boxes in the full image are **supporting notes**. They are not part of the in-game world and must not be turned into in-game UI or HUD elements.

---

## How to use these references

- Use `world-map-overview.png` as the single source of truth for:
  - relative placement of continents, islands, and the central sea
  - shape and flow of rivers
  - placement and shape of mountain barriers and the pass
  - road routes connecting major settlements
  - position of towns, villages, ports, gates, ruins, fortresses, the dark citadel, and any other landmarks visible in the overview
- Future world-map changes should follow `world-map-overview.png` unless the user explicitly asks for a deviation.
- The full image is for background reading only — never copy its right or bottom panels into the game.

---

## Canonical implementation

- The current `src/game/data/maps/elerion-world-config.ts` is the **canonical foundation** going forward. It is aligned with `world-map-overview.png` in both structure (Frostnorth Tundra band, Northwind Peaks NW sub-cluster, Silverwall Mountains horizontal top band with the N–S Northwind Pass at Stonegate, Verdant River with the Bridgeford bridge at Riverdale, central sea with Whisper / Tempest / Saint's islands, eastern continent with Dreadshore / Riverrun / Warfortress / Twilight Grove / Black Citadel) and visible display names.
- Future world-map passes should refine on top of this config, not restart from scratch.

---

## Non-canon placeholder content

Any older map, story, or quest content that predates this canon is **non-canon placeholder** unless it is explicitly redesigned to fit the new structure. In particular:

- Old quest hooks (e.g. the disabled "Investigate Clearing" Grove Warden trigger) are non-canon.
- Old location names that were dropped during the Elerion reposition (e.g. "Border Fields", "North Pass", "Ashenveil Road" as a separate location) are non-canon.
- The Lumen and Ashenveil town scenes remain canonical only as placeholders until they are revisited; their internal layouts may be reworked when story design lands.

The Lightning Warrior story and quest progression will be redesigned later from scratch. Until then, any content that conflicts with the world-map canon may be treated as freely replaceable.

---

## Canonical place names

Display labels visible on the world map are aligned to the reference image. Technical ids are kept **stable** even where the display name has changed; do not rename technical ids without a `SAVE_VERSION` bump and a full cross-file audit.

| Canon display name | Technical id(s) | Notes |
|---|---|---|
| Dawnkeep | `lm_start_village` | starting village |
| Verdant Fields | `vergant_fields` (region) | broad western plains base |
| Highland Ruins | `lm_highland_ruins` | west-coast ruin |
| Riverdale | `lm_bridgeford` | river-crossing village |
| Bridgeford *(structure name)* | `verdant_bridge` (region) | the stone bridge inside Riverdale; kept visible as the bridge structure |
| Eldric | `lm_lumen_capital` / `lumen_town` (TownScene) | the capital city |
| Everdawn Forest | `evergreen_forest` (region) / `western_forest_zone` | western forest |
| Northwind Pass | `mountain_pass_zone` / `mountain_pass_road` / `mountain_pass` (LocationDef) | the pass corridor through Silverwall Mountains |
| Frostnorth Tundra | `northern_tundra` (region) / `northern_tundra_zone` | snow band along the top |
| Stonegate | `lm_mountain_gate` | gate city at the pass |
| Silverwall Mountains | `spine_band_west` + `spine_band_east` (regions) | top E–W mountain barrier (Northwind Peaks `northwind_peaks` is a NW sub-cluster) |
| Light's Sanctuary | `lm_saints_sanctuary` | south-central shrine |
| Harborwatch | `lm_west_port` | SE coast port |
| The Central Sea | structural sea band (x:2300–3200); no visible label entity | |
| Whisper Isle | `lm_whisper` / `whisper_isle` (region) | northern sea island |
| Tempest Isles | `lm_tempest` / `tempest_spire` (region) | southern sea island |
| Saint's Isle | `lm_storm` / `storm_isle` (region) | central-southern sea island (repurposed from old "Storm Shrine" placeholder) |
| Dreadshore | `lm_east_port` / `ashenveil_town` (TownScene) | east-continent arrival port |
| Riverrun | `lm_river_city` | eastern river-crossing city |
| Greymarsh Wilds | `greymarch_wilds` (region) | eastern wild region (broader base) |
| Twilight Grove | `blackwoods` (region) / `eastern_warfields_zone` | eastern dark forest |
| Warfortress | `lm_war_fortress` | east-of-river fortress |
| Black Citadel | `lm_dark_citadel` | far-NE final dungeon |

---

## Reserved for future side content

Non-reference placeholders kept in the config with their labels hidden. They retain coordinates and geometry; their display labels are blank so they don't appear as named map locations until they're given a canonical role.

| Technical id | Kind | Possible future role |
|---|---|---|
| `lm_forest_shrine` | landmark | side shrine / optional dungeon in Everdawn Forest |
| `lm_lighthouse` | landmark + island region (`lighthouse_isle`) | possible Ch 4 sea side stop |
| `lm_merchant` | landmark + island region (`merchant_atoll`) | possible Ch 4 merchant / trade island |
| `lm_frontier_town` | landmark | possible eastern frontier village (between Dreadshore and Riverrun) |
| `lm_ancient_ruins` | landmark | possible optional dungeon east of the river |
| `lumen_grove` | region | decorative forest near Eldric |
| `thornwood_region` | region | possible future early-corruption / side-quest area in the SW |
| `eastern_dustlands` | region | sub-region of Greymarsh Wilds |
| `twilight_marches` | region | sub-region beyond the river, near Twilight Grove |
| `black_reach` | region | corruption strip around Black Citadel |
| `northwind_peaks` | region | NW sub-cluster of Silverwall Mountains (label hidden so the range reads as one feature) |
| `ironflow_river_n` / `ironflow_river_s` / `iron_bridge` | regions | the eastern river + Iron Bridge structure (kept geometrically; labels hidden because the reference names only Riverrun, not the river) |

Geometry stays so that future content can light up a label without re-laying-out the map.
