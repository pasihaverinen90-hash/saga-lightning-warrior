# Saga of the Lightning Warrior

A browser-based 2D fantasy JRPG built with Phaser 3, TypeScript, and Vite.

Inspired by Suikoden, early Final Fantasy, and Pokémon-style exploration rhythm.

---

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in a modern browser. Keyboard only — no mouse required for core gameplay.

> **First clone:** after running `npm install`, commit the generated `package-lock.json` to the repository. The package.json uses `^` version ranges; a lock file ensures every contributor and CI environment installs the same versions.

```bash
npm run build     # production build → dist/
npm run preview   # preview the production build locally
```

**Requirements:** Node.js 18+, a modern browser (Chrome, Firefox, Edge, Safari).

---

## Controls

| Key | Action |
|-----|--------|
| Arrow keys | Move (world map, town) |
| `E` | Interact (talk, enter building, examine) |
| `Enter` / `Space` | Confirm (menus, dialogue) |
| `Esc` | Cancel / go back (menus) |
| `Up` / `Down` | Navigate menus |

---

## What is playable

The current build is a complete vertical slice of Chapter 1.

- **World map exploration** — walk through Border Fields, reach Lumen Town, travel the Ashenveil Road, and push into the Thornwood
- **Town exploration** — Lumen Town and Ashenveil, each with an inn, shop, NPCs, and a save point
- **Dialogue and story events** — Serelle joins in Lumen Town; Kael joins in Ashenveil; story flags gate further progression
- **Random encounters** — active in North Pass, Ashenveil Road, and Thornwood zones; never in towns
- **Turn-based battle** — Attack, Skill, Item, Defend; speed-based turn order; floating damage/heal numbers; party status panel
- **Boss battles** — Shadecaster Veyr (North Pass, scripted), Grove Warden (Thornwood, optional scripted)
- **Shop and inn** — buy consumables and equipment; rest to restore HP/MP; save at the inn or save crystal
- **XP and leveling** — XP split across active members; stat growth per character; level-up shown on result panel
- **Equipment** — weapon and armor slots per character; stat bonuses applied at battle time

---

## Save data

Saves use `localStorage`. One save slot. The save key is `saga_save_slot_1`.

Current save version: **5**. Loading a save from a different version rejects it and starts a clean state. See `docs/ARCHITECTURE.md` for the version history.

---

## Project layout

```
src/game/
  core/          Config, scene keys, input constants, boot/preload scenes
  state/         Runtime game state types, singleton state object, actions, selectors
  save/          localStorage serialization, save types, version tracking
  data/          All content definitions (characters, enemies, skills, items, equipment,
                 maps, encounter tables, dialogue, story flags) — pure data, no Phaser
  world/         World map scene, movement, encounter tracking, zone transitions
  town/          Town scene, NPC system, interaction system, shop service
  battle/        Battle scene, turn-order engine, damage, enemy AI, XP system
  dialogue/      DialogueOverlay scene, dialogue types, event-handler (story effects)
  ui/            Shared panel helper, TitleScene
  shared/        Cross-module constants (player dimensions)

public/assets/
  images/        damage-digits.png, heal-digits.png (battle popup sprites)
  ui/            dialogue-box.png, result-panel.png, btn-*.png (command buttons)
```

See `docs/ARCHITECTURE.md` for a full description of every module and how they communicate.

---

## Technology

| | |
|--|--|
| Renderer | Phaser 3.60 |
| Language | TypeScript 5 (strict) |
| Bundler | Vite 5 |
| Persistence | `localStorage` |
| External deps | None beyond the above |

No UI frameworks. No backend. No build-time code generation.
