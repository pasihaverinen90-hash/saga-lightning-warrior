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

- The current `src/game/data/maps/elerion-world-config.ts` is the **canonical foundation** going forward. It already aligns with `world-map-overview.png` (Northern Tundra band, Northwind Peaks NW cluster, Spine Mountains horizontal top band with a N–S pass, Verdant River with the Bridgeford crossing, five central-sea islands distributed N→S, eastern continent layout with Ironflow River + River City, War Fortress, Ancient Ruins, Dark Citadel, etc.).
- Future world-map passes should refine on top of this config, not restart from scratch.

---

## Non-canon placeholder content

Any older map, story, or quest content that predates this canon is **non-canon placeholder** unless it is explicitly redesigned to fit the new structure. In particular:

- Old quest hooks (e.g. the disabled "Investigate Clearing" Grove Warden trigger) are non-canon.
- Old location names that were dropped during the Elerion reposition (e.g. "Border Fields", "North Pass", "Ashenveil Road" as a separate location) are non-canon.
- The Lumen and Ashenveil town scenes remain canonical only as placeholders until they are revisited; their internal layouts may be reworked when story design lands.

The Lightning Warrior story and quest progression will be redesigned later from scratch. Until then, any content that conflicts with the world-map canon may be treated as freely replaceable.
