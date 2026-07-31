# Map Architecture

How maps work in Saga of the Lightning Warrior after the tilemap rebuild.

Companion document: [`asset-pipeline.md`](asset-pipeline.md) covers how the art
and the map files themselves are produced.

---

## The three-layer structure

The world is split by **scale**, not by scene class:

| Layer | What it is | Encounters | Example |
|---|---|---|---|
| **Travel map** | The overworld you cross to get from place to place. Settlements appear as clusters you walk up to and enter. | yes | `elerion_west` |
| **Location maps** | Walkable places at field scale — towns, forests, dungeons. Each is its own map and may use its own tileset. | towns no, field yes | `dawnkeep`, `everdawn_forest` |
| **Interiors** | Inside a building. | never | `dawnkeep_inn` |

All three are ordinary Tiled tilemaps served by **one scene**,
[`TileMapScene`](../src/game/maps/scenes/TileMapScene.ts). What differs between
them is map data — which layers exist, the `kind` property, whether saving is
allowed — not code. Adding a location is a new map file plus one row in
[`map-registry.ts`](../src/game/maps/map-registry.ts); no scene changes.

---

## Tile size and scale

**64 px tiles.** At 1280×720 the camera shows 20 × 11.25 tiles, close to classic
SNES-era JRPG framing.

Camera zoom is **fixed at 1.0** and must stay there. Any other zoom makes
NEAREST filtering sample tile edges unevenly and the whole map shimmers while
walking. If a view feels too wide or too tight, change the tile size or the map
dimensions — not the zoom.

| Map | Tiles | Pixels | Crossing time at its walk speed |
|---|---|---|---|
| `elerion_west` | 60 × 40 | 3840 × 2560 | ~20 s corner to corner |
| `dawnkeep` | 40 × 30 | 2560 × 1920 | ~15 s |
| `everdawn_forest` | 48 × 36 | 3072 × 2304 | ~18 s |
| `dawnkeep_inn` | 20 × 15 | 1280 × 960 | one screen |

---

## Layers

Fixed names, in render order (back to front):

```
Ground · Terrain · Water · Paths · DecorationBelow · DecorationAbove · Foreground
```

`Water` sits **below** `Paths` on purpose: a bridge is a path crossing a river,
so path tiles have to be able to draw over water tiles.

`Foreground` draws above the player. Everything else draws below.

Object layers carry gameplay data and are never rendered as tiles:

| Layer | Holds |
|---|---|
| `Objects` | Placed sprites — trees, rocks, buildings, furniture |
| `Collision` | Extra solid rectangles |
| `EncounterZones` | Named regions keyed into `ENCOUNTER_TABLES` |
| `Triggers` | Map exits, battles, signs, save points |
| `SpawnPoints` | Named arrival positions |
| `NPCs` | Characters with dialogue |

---

## Depth sorting

Tile layers occupy fixed depth bands. The player, NPCs and every placed object
are sorted by the **y of their ground contact point**:

```
depth = 100 + contactY
```

So walking north of a tree puts you behind its canopy; south of it puts you in
front. Buildings work the same way.

---

## Collision

Three sources, all stamped into one `TileCollisionGrid` (a `Uint8Array` bitmask):

1. **Tile properties** — a tile marked `solid` in its tileset is solid
   everywhere it is used. Water and walls work this way, so no map can forget.
2. **Object footprints** — from the atlas manifest. A tree contributes only its
   **trunk**, which is what lets the player overlap the canopy. A building
   contributes its whole body.
3. **Explicit rectangles** on the `Collision` object layer, for anything
   irregular.

The grid answers "is this rectangle blocked?" in O(1) per overlapped tile — at
most four tiles for a player-sized body. `shared/movement-system.ts` accepts
either the grid or a plain `Rect[]`, so the legacy `TownScene` is unaffected.

**The player's collision body is their feet**: 32 × 20 px against a 48 × 64
sprite. That is what makes overlapping scenery look natural.

---

## Authoring a map

Two supported styles. Both emit the same Tiled JSON.

### Grid blueprint (preferred for towns and interiors)

The map is three character grids — one character per square — plus a legend.
See [`mapdefs/dawnkeep.mjs`](../tools/asset-pipeline/mapdefs/dawnkeep.mjs).

```
base   what the ground is        .  grass    r  road    p  path
over   what stands on it         T  tree     I  inn     B  barrel
marks  gameplay                  1  spawn    X  exit    n  NPC
```

```js
base: [ '....rrr....' ],
over: [ '..T.....B..' ],
marks:[ '.....1.....' ],
```

Because the legend maps a character to a **named** tile or atlas frame, dropping
in better artwork is a one-line change — point `grass` at a different tile name,
or ship a replacement atlas that reuses the same frame names, and every map
re-renders with it. **The grid never has to change.**

Multi-tile objects are anchored by the square holding their **bottom centre** —
the square where they meet the ground, which is also what depth sorting uses.
Building collision covers the whole building, so an entrance trigger goes on the
square directly *below* the anchor.

Mismatched grid sizes and unknown characters are hard errors, with the row and
column reported. These files are hand-edited; a silently ignored typo would
surface much later as a mysterious hole.

### Programmatic builder (preferred for large organic maps)

`MapBuilder` exposes `paintPath`, `paintRect`, `paintOrganicPatch`,
`scatterObjects` and friends. Used for the travel map and the forest, where a
60 × 40 grid of hand-typed characters would be unreadable and repetitive.

**Routes must be axis-aligned with right-angle turns.** The autotiler is 4-bit
cardinal, so a diagonal run staircases and renders as disconnected blobs.

---

## Triggers

Data-driven; no story logic lives in scene code.

| `kind` | Effect | Default activation |
|---|---|---|
| `map` | Go to another map at a named spawn | contact |
| `battle` | Start a scripted battle | confirm |
| `dialogue` / `sign` | Run a dialogue sequence | confirm |
| `save` | Open the menu on the save tab | confirm |

Gating uses `requiresFlag` and `consumedByFlag`, matching the existing story-flag
convention. A trigger whose `targetMap` is not a registered tilemap routes to the
legacy `TownScene` instead — that is what lets both systems coexist.

---

## Encounters

Unchanged from before: `EncounterTracker` plus `ENCOUNTER_TABLES`, keyed by zone
id. The new maps deliberately reuse the existing zone ids
(`thornwood_zone`, `western_forest_zone`, `mountain_pass_zone`) so the tuning
carries over.

One step is now **one tile (64 px)** rather than 32 px, passed to the tracker's
constructor. Towns and interiors never roll regardless of what zones they declare.

---

## Migration status

| Location | System |
|---|---|
| Western Elerion travel map | tilemap |
| Dawnkeep + its inn | tilemap |
| Everdawn Forest | tilemap |
| **Eldric** (`lumen_town`) | **legacy `TownScene`** — holds the Serelle join event, shop, inn |
| **Dreadshore** (`ashenveil_town`) | **legacy `TownScene`** — holds the Kael join event |

Eldric is reached from the travel map and exits back to it via a named spawn.

**Dreadshore currently has no entrance.** It sits on the eastern continent, which
the Chapter 1 travel map does not cover. It was already unreachable before this
rebuild — crossing the Central Sea needed a ferry that was never implemented — so
this is not a regression, but Kael cannot be recruited until an eastern map or a
ferry exists. Reachable via the debug map cycle in the meantime.

`data/maps/elerion-world-config.ts` is **retained but no longer imported**. It is
the canonical geography reference used to lay out the travel map and to port the
remaining regions later; three documents cite it.
