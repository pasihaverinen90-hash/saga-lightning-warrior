# Asset Pipeline

Everything under `public/assets/` is **generated** from two source images by
`npm run assets`. The outputs are committed (the game serves them directly, there
is no build-time image step) but they must never be hand-edited — change a
generator and re-run.

The pipeline has **zero dependencies**: PNG decode/encode is implemented directly
on `node:zlib`. It is also **deterministic** — no `Math.random` anywhere, all
variation comes from the hash/noise helpers in `lib/image.mjs`, so re-running
without changes reproduces byte-identical output.

```
npm run assets      # regenerate everything, writes docs/asset-pipeline-report.md
```

---

## Source analysis

Both supplied sheets were measured before any code was written. What they
actually are drove every decision below.

### File A — `overworldtile1.png` (terrain)

| Property | Measured |
|---|---|
| Dimensions | 1254 × 1254 |
| Colour type | RGB — **no alpha channel at all** |
| Columns | 14 usable at 82–83 px, plus a cropped 60 px column (discarded) |
| Rows | **10, of NON-UNIFORM height**: 83, 82, 81, 82, 124, 167, 122, 177, 127, 182 |
| Separators | Black grid lines baked in, bleeding 1–2 px into each cell |
| Tileability | **Not seamless** — grass measured ~22 per-channel vertical edge mismatch |

Rows 0–3 are true ground tiles. Rows 4–9 are taller because they hold artwork
drawn above its ground footprint (trees, mountains, cliffs, water, fences).

**Objects in File A have grass baked in behind them** — confirmed by extracting a
conifer cell and finding it sitting on an opaque grass square. File A is
therefore a *terrain* source only.

### File B — `overworldtile2.png` (objects)

| Property | Measured |
|---|---|
| Dimensions | 1024 × 1024 RGBA |
| Alpha | **Genuine.** 50.3 % fully transparent, 43.1 % fully opaque, 6.6 % partial |
| Fringe | Composited over magenta shows **no green halo** |
| Layout | No grid at all — 243 connected components, 121 above 120 px |

**No colour-keying, despill or background removal is performed or needed.** The
green visible in a naive preview is the RGB of pixels that are already alpha 0.
The 6.6 % partial alpha is ordinary antialiasing, not haze.

---

## Stages

| Stage | Input | Output |
|---|---|---|
| `slice-terrain.mjs` | File A | `tilesets/overworld-terrain.*` |
| `gen-autotiles.mjs` | terrain materials | 192 autotiles, merged into the same tileset |
| `extract-objects.mjs` | File B | `atlases/overworld-objects.*` |
| `gen-structures.mjs` | palette from A + B | `atlases/structures.*`, `tilesets/interior.*` |
| `gen-character.mjs` | — | `sprites/*.png` |
| `compose-maps.mjs` | map definitions | `maps/*.json` (Tiled 1.10) |

---

## Key decisions and why

### The grid is detected, never assumed

Row heights are not uniform, so a fixed grid would slice straight through the
taller artwork rows. `lib/sheet-grid.mjs` finds the black separators by their
signature (near-black **and** desaturated — requiring low saturation stops dark
tree shadows registering as grid lines).

### Seam repair

Each edge band is cross-faded with its opposite edge, forcing left == right and
top == bottom while staying continuous inland. This takes the grass tile's
measured edge error from 6.87 / 9.59 to **exactly 0** — without it, a large field
shows visible grid banding.

### Edge conforming

Every grass-backed tile (flowers, tufts, pebbles) has its outer ring blended
toward the one seamless grass base, so all of them share an identical border.
Any two can then sit adjacent in any order with no seam, while their centres keep
their variation.

### Grass variants are mirrors, not extra cells

Columns 1–3 of rows 0 and 1 *look* like grass but each carries a shrub clump.
Using them as field fill tiled a visible lattice of bushes across every map, so
they are decoration now. Field variation instead comes from mirrored copies of
the base tile — mirroring a seamless tile preserves its edges, so the variants
butt against each other invisibly at no cost.

### The road surface is found by search, then inpainted

The sheet never draws a large unbroken area of road: roads are narrow dirt bands
with grass on both sides. A hand-picked rectangle came out **23 % grass**, and
because every generated road tile is composited from that one sample, the grass
repeated as a green blob in the middle of every road tile on every map.

Fixed by searching for the least-contaminated window (smaller is cleaner —
56 px = 19.8 % foliage, 48 px = 11.3 %, **40 px = 2.8 %**) and then inpainting the
remainder away. Result: 0 % foliage.

### Autotiling is generated, not traced

The sheet's road, river and coast cells are illustrated *scenes*, not
connectable tiles — measured edge continuity between adjacent cells ranges
15–88 per channel, so laying them side by side does not produce a continuous
road. Instead the 16 neighbour cases are built by compositing the sheet's own
materials through a coverage mask.

Two things this got wrong at first, both caught by rendering whole maps to PNG:

- **A "central blob with arms" mask** left a fully-surrounded tile as a cross
  with grass corners, so a three-tile-wide road rendered as a string of beads.
  Replaced with an inset-from-open-sides field, which produces a solid surface
  with a soft verge.
- **Marking only the fully-surrounded variant solid** left any river under three
  tiles wide entirely walkable, because no cell in it ever has all four
  neighbours. Every variant of a solid material is now solid.

**3 edge-treatment variants per mask**, chosen by position: with a single
variant, every tile along a straight road shared identical edge noise and the run
read as one shape stamped over and over.

Because it is 4-bit cardinal autotiling, **routes must be authored axis-aligned**.
Diagonals staircase and read as broken.

### Objects come out of File B by connected components

There is no grid to slice, and the alpha is clean, so 8-connected regions of
alpha ≥ 128 are labelled and each becomes a sprite. Neighbouring components are
masked out of each other's crops so a sprite never picks up a piece of its
neighbour.

Classification uses geometry **plus vertically banded colour**. A flat colour
average cannot tell a cliff from a forest block — both are wide and both contain
green — but a cliff is grass on top over bare rock below. An earlier flat version
filed most cliffs under `forest` and `mountain`.

| Category | Count | Collision footprint |
|---|---|---|
| tree | 21 | 42 % width × 16 % height — **trunk only** |
| forest | 8 | 92 % × 30 % |
| cliff | 9 | 100 % × 55 % |
| mountain | 9 | 88 % × 42 % |
| rock | 38 | 82 % × 48 % |
| fence | 16 | 100 % × 45 % |
| bush | 14 | not solid |
| prop | 6 | not solid |

### Buildings, interiors and the character are generated

Neither sheet contains a house, a roof, a floorboard, a table or a character —
they are nature-only. Rather than leave towns and interiors as coloured
rectangles, those are drawn procedurally in a palette **sampled from the two
sheets** (timber from File B's fence rails, stone from its boulders, warm accents
from File A's road dirt) so they sit beside the painted terrain without clashing.

These are deliberately simple and **meant to be replaced**. Swap the PNG and keep
the frame names and nothing else has to change — not the maps, not the code.

---

## Replacing artwork

The whole system addresses art by **name**, never by index:

- **A tile**: ship a tileset whose `name` property matches (`grass`, `road_15_0`,
  `floor_wood`). Map data references names, so it re-renders untouched.
- **An object**: ship an atlas frame with the same name (`tree_07`, `inn`,
  `barrel`) plus a manifest entry giving its size, origin and footprint.
- **The character**: replace `sprites/hugo.png` keeping 48 × 64 frames, 4 walk
  frames across, direction rows in order down / left / right / up.

For grid-authored maps you can also just repoint the legend character at a
different name — see [`map-architecture.md`](map-architecture.md).

---

## Verification helpers

Not part of `npm run assets`; run them when changing a generator.

```bash
node tools/asset-pipeline/debug-contact-sheet.mjs   # File A rows, sliced and numbered
node tools/asset-pipeline/extract-objects.mjs       # + objects-by-category.png
node tools/asset-pipeline/preview-maps.mjs --scale 0.3 [--collision]
```

`preview-maps.mjs` renders each finished map to PNG exactly as the game layers
it. Every significant defect above was found this way rather than in the browser.
