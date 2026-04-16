# UI and Art Style Guide

All constants referenced here are defined in `src/game/core/config.ts`. Always import from there — never hardcode hex values or font strings in scene files.

---

## Visual direction

Hand-drawn 2D fantasy with clear silhouettes and readable UI. Bright, heroic palette. Gentle shading. Soft readable outlines. No muddy low-contrast look. No modern sci-fi shapes. No UI clutter. Priority: readability first.

---

## Resolution and layout

- Base resolution: **1280 × 720** (16:9)
- Phaser scaling: `FIT` mode, auto-centred
- Anti-aliasing: off (`antialias: false`, `pixelArt: false`)

---

## Colour palette

### `COLORS` — numeric (for Phaser Graphics fill/line calls)

| Key | Hex | Use |
|-----|-----|-----|
| `panelBg` | `#14233B` | Panel fill at 92% opacity |
| `panelBorder` | `#D9B35B` | Panel outer border (gold) |
| `panelHighlight` | `#324F78` | Optional inner highlight line |
| `fantasyBlue` | `#2C4E86` | Selection fill |
| `navyDeep` | `#14233B` | Deep background |
| `parchment` | `#F3EBD2` | Primary text on dark panels |
| `textSecondary` | `#D6D1C1` | Secondary text, prompts |
| `textDisabled` | `#888888` | Dimmed / unavailable items |
| `goldAccent` | `#D9B35B` | Gold decoration, selected borders |
| `iceBlue` | `#8FC8FF` | Serelle colour, MP labels, selection border |
| `lightningYellow` | `#E8D25F` | Hugo colour, lightning highlights |
| `dangerCrimson` | `#A84747` | Damage, defeat, danger |
| `successGreen` | `#5E9B63` | Healing, success states |
| `selectionFill` | `#2C4E86` | Selected menu row fill |
| `selectionBorder` | `#8FC8FF` | Selected menu row border |

### `COLOR_HEX` — CSS strings (for Phaser Text style objects)

Same values expressed as CSS hex strings. Both `dangerCrimson` and `successGreen` are present in `COLOR_HEX` — use these, do not use the `COLORS` numeric versions in text styles.

### Text on parchment art backgrounds

When text appears on the dialogue box, result panel, or any other warm parchment art, use dark ink colours. **Light parchment text (`#F3EBD2`) on parchment art is invisible.**

| Role | Dark ink colour |
|------|----------------|
| Body text | `#1e1408` |
| General dark ink | `#2c1a06` |
| Hugo name | `#7a4e00` |
| Serelle name | `#0a3070` |
| Kael name | `#6a2c0a` |
| Villain / enemy name | `#6a0a0a` |
| NPC name | `#3a2a06` |
| Guard name | `#1a2a1a` |
| Continue prompt | `#5a3a10` |
| XP header | `#1a3a6a` |
| Level-up highlight | `#7a4e00` |
| Body text / ink | `#1e1408` |

---

## Fonts

Always use `FONTS.title` or `FONTS.ui` — no raw font strings in scene files.

| Constant | Stack | Use |
|----------|-------|-----|
| `FONTS.title` | `Georgia, 'Times New Roman', serif` | Title screen logo, battle result heading |
| `FONTS.ui` | `"Trebuchet MS", Arial, sans-serif` | All menus, dialogue, battle, HUD |

### Font sizes — `FONT_SIZES` constants

At 1280 × 720 base resolution:

| Constant | Size | Use |
|----------|------|-----|
| `titleLogo` | 64px | Title screen game name |
| `subtitle` | 22px | Subtitle / version text |
| `menuButton` | 28px | Title menu buttons |
| `dialogueSpeaker` | 24px | Speaker name in dialogue box |
| `dialogueBody` | 24px | Dialogue body text |
| `battleCommand` | 26px | Battle command labels on buttons |
| `hpMp` | 20px | HP/MP numbers in status panel |
| `locationLabel` | 18px | World map / town HUD label |
| `hint` | 16px | Interaction prompts, continue prompts |
| `debug` | 14px | Debug overlays only |

---

## Programmatic panels

Use `ui/common/panel.ts → drawPanel(scene, opts)` for all dark navy bordered panels.

**Defaults:**
- Fill: `#14233B` at 92% opacity
- Border: `#D9B35B`, 3px
- Corner radius: 6px

**Critical container rule:** when `drawPanel()` is called inside a Container-refresh method, always add the returned `Graphics` object to the container:

```ts
const bg = drawPanel(this, opts);
container.add(bg);
```

Failing to do this causes one leaked GPU-backed Graphics object per refresh call. This was a confirmed bug in `refreshStatusPanel` (fixed), `refreshSkillPanel` (fixed), and `refreshItemPanel` (fixed). Apply the same pattern to any future panel inside a container.

---

## Custom art panels

These are PNG assets loaded as Phaser images and displayed at a fixed size using `setDisplaySize()`.

### Dialogue box — `'dialogue-box'`

Source: 1536×1024 RGBA · Display: **1200×521** · Position: `panelX=40, panelY=191` (bottom-anchored, 8px margin)

Panel-local text zones (add `panelX` / `panelY` for absolute game coords):

| Zone | Panel-local value |
|------|------------------|
| Portrait oval centre x | 215 |
| Portrait oval centre y | 282 |
| Portrait oval radius x | 120 |
| Portrait oval radius y | 155 |
| Text zone left edge | 349 |
| Text zone right edge | 1161 |
| Word-wrap width | 800px |
| Speaker name baseline y | 108 |
| Body text top y | 150 |
| Continue prompt x (right-anchor) | 1153 |
| Continue prompt y | 408 |

### Result panel — `'result-panel'`

Source: 1536×1024 RGBA · Display: **920×613** · Position: centred in game at `panelX=180, panelY=53`

Key vertical positions (panel-local):

| Element | Panel-local y |
|---------|--------------|
| Title text | 160 |
| Gold / reward line | 226 |
| XP divider | 258 |
| XP header row | 268 |
| First member XP row | 290 |
| Second member row | 312 |
| Third member row | 334 |
| Continue prompt | 447 |

### Command buttons — `'btn-normal'`, `'btn-selected'`, `'btn-disabled'`, `'btn-pressed'`

Source: 624×256 RGBA each · Display: **290×52** per button row (stretched non-uniformly)

State routing:
- Unaffordable skill / empty inventory → `btn-disabled` at 65% alpha
- Currently selected row → `btn-selected`
- All other rows → `btn-normal`
- `btn-pressed` reserved for confirm feedback animation (not yet wired)

Labels are rendered by code on top at depth 51. Label colour: dark ink `#2a1a06` on normal/pressed; bright parchment `#F3EBD2` on selected; disabled colour on disabled.

---

## Floating digit sprites

### `'damage-digits'` — fire-styled

Source: 1540×1024 RGBA, 10 frames, `frameWidth: 154, frameHeight: 1024`. Frame 0 = digit 0 … frame 9 = digit 9.

Display scale: `56 / 1024 ≈ 0.0547`. Each digit renders at approximately 8px wide.

### `'heal-digits'` — green glow

Same layout and frame mapping. Originally RGB with solid black background; converted to RGBA (black pixels masked transparent).

### Animation — both types

Container rises **52px** while fading from alpha 1 to 0 over **950ms** with `Quad.easeOut`, then `container.destroy()` cleans up all digit sprites.

Digit containers are built by `spawnFloatingDigits()`, called via `spawnFloatingDamage()` (fire, minus prefix) or `spawnFloatingHeal()` (green glow, plus prefix). HP heals use sprite digits. MP restore uses `spawnFloatingLabel()` with ice blue text — no MP sprite sheet.

---

## Battle screen layout

### Depth hierarchy

| Layer | Depth |
|-------|-------|
| Battle background | 0 |
| Unit sprites | 10 |
| Command / skill / item / status panels | 50–51 |
| Turn indicator | 51 |
| Target arrow | 60 |
| Floating damage/heal containers | 80 |
| Result panel art | 195 |
| Result panel text | 200 |

### Formation positions

**Allies — lower-left:**

| Slot | px | py | Occupant |
|------|----|----|---------|
| 0 | 224 | 376 | Hugo (front) |
| 1 | 124 | 284 | Serelle (mid) |
| 2 | 44 | 192 | Kael (rear) |
| 3–4 | — | — | Reserved for future expansion |

**Enemies — upper-right:**

| Slot | px | py |
|------|----|----|
| 0 | 820 | 296 |
| 1 | 920 | 224 |
| 2 | 724 | 200 |

### Command panel

Position: `x=20, y=GAME_HEIGHT−240`. Width: 290px. Button height: 52px. Gap between buttons: 4px. Four rows total.

### Status panel

Position: `x=GAME_WIDTH−340, y=GAME_HEIGHT−220`. Width: 316px. Height: 220px (fits 3 members at ~68px rows).

---

## HUD style — world map and town

- **Location label:** top-left, 24px margin, dark navy panel, gold border, parchment text
- **Interaction hint:** bottom-centre, disappears when no interactable nearby
- **Battle status panel:** per-member row with name in character colour, `Lv N` right-aligned, HP bar (green >50%, gold 25–50%, crimson <25%), HP/MP numbers, `🛡` icon when defending

---

## General rules

- Borders: 2–4px contrast border on all panels
- Panel opacity: mostly opaque (92%); slight transparency for overlays is allowed
- Spacing: generous padding — never cramped
- Text must always be readable against its background
- Selection highlights must be immediately obvious without relying on colour alone
- Avoid flashing effects that reduce readability
