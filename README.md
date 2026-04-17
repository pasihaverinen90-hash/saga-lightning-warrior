# Saga of the Lightning Warrior

![CI](https://github.com/pasihaverinen90-hash/saga-lightning-warrior/actions/workflows/ci.yml/badge.svg)

A browser-based 2D fantasy JRPG.
**Stack:** Phaser 3 · TypeScript · Vite · localStorage saves
**Input:** Keyboard only · **Resolution:** 1280 × 720

---

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. No mouse needed for core gameplay.

> **First clone:** after `npm install`, commit the generated `package-lock.json`. The `package.json` uses `^` version ranges; a lock file ensures every environment installs identical versions.

### All scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite` | Start local dev server on port 3000 |
| `build` | `vite build` | Production bundle → `dist/` |
| `preview` | `vite preview` | Preview the production build locally |
| `typecheck` | `tsc --noEmit` | Type-check without building (fast, use before pushing) |
| `ci` | `tsc --noEmit && vite build` | Full quality gate: typecheck + build |

**Node.js 18+ required.** Recommended: Node 22 (see `.nvmrc`).

---

## Controls

| Key | Action |
|-----|--------|
| Arrow keys / WASD | Move (world map, town) |
| `Space` | Interact / examine / advance dialogue |
| `Enter` / `Space` | Confirm in menus |
| `Esc` | Cancel / go back |
| `Up` / `Down` | Navigate menus |

---

## What is playable

The current build is a complete Chapter 1 vertical slice.

| System | Status |
|--------|--------|
| World map exploration | ✓ |
| Town exploration — Lumen Town, Ashenveil | ✓ |
| NPC dialogue with story-flag overrides | ✓ |
| Story events — Serelle joins, Kael joins | ✓ |
| Inn (rest + save) | ✓ |
| Shop — consumables and equipment | ✓ |
| Save / load via localStorage | ✓ |
| Random encounters — North Pass, Ashenveil Road, Thornwood | ✓ |
| Turn-based battle — Attack, Skill, Item, Defend | ✓ |
| Boss battles — Shadecaster Veyr, Grove Warden | ✓ |
| XP, leveling, stat growth | ✓ |
| Equipment slots — weapon and armor | ✓ |
| Floating damage and heal popups (font-based) | ✓ |
| Custom UI art — dialogue box, result panel, command buttons | ✓ |

---

## Repository layout

```
CLAUDE.md               Working guide for future Claude sessions — read first
README.md               This file
docs/
  master-design-spec.md Original game design intent
  architecture.md       Module map and boundary rules
  gameplay-rules.md     Precise rules for every system
  ui-art-style-guide.md Visual direction and colour palette
  content-bible.md      All content ids and values
  roadmap.md            Current state vs future plans
  testing-checklist.md  Manual test protocol
  change-log.md         Version history
  id-stability-rules.md Rules for managing internal identifiers
  review-checklist.md   Code review checklist

.github/
  workflows/ci.yml              GitHub Actions — typecheck + build
  pull_request_template.md      Pre-filled PR checklist

src/
  main.ts               Phaser game entry point
  game/
    core/               Config, scene keys, fonts, colours, boot/preload scenes
    state/              Game state types, singleton, actions, selectors
    save/               localStorage read/write, version tracking
    data/               All content (characters, enemies, skills, items, equipment,
                        maps, encounter tables, dialogue, story flags)
    world/              World map scene and systems
    town/               Town scene and systems
    battle/             Battle scene and engine
    dialogue/           DialogueOverlay scene and event handler
    ui/                 TitleScene, shared panel helper
    shared/             Cross-module utilities (movement, player constants)

public/assets/
  ui/                   Panel and button art (dialogue-box, result-panel, btn-*)
```

---

## Save data

- Storage: `localStorage` key `saga_save_slot_1`
- One save slot
- Current save format version: **5**
- Loading a save from a different version silently rejects it and starts fresh
- See `docs/change-log.md` for the full version history

---

## AI-assisted development

This project uses Claude for development. Read `CLAUDE.md` before making any changes — it defines architecture boundaries, data-driven content rules, save-version protocol, style rules, and output expectations that must be maintained across all sessions.
