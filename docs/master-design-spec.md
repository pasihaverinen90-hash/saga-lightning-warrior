# Master Design Spec — Saga of the Lightning Warrior

This document records the original design intent for the project. It describes the intended complete game. The current build implements Chapter 1 as a complete vertical slice. Items not yet implemented are marked **[FUTURE]**.

---

## Genre and platform

Browser-based 2D fantasy JRPG.
Platform: web browser, keyboard only.
Inspiration: Suikoden, early Final Fantasy, light Pokémon-style exploration rhythm.

---

## Tone

Bright heroic fantasy. Adventurous, sincere, readable. The world is threatened by evil but the tone is not bleak or grimdark. There should be warmth, colour, and hope.

---

## World

**Name:** Elarion
**Setting:** The borderlands — a frontier region where corruption is spreading from a dark force led by the mage Braxtion.

---

## Characters

### Hugo
- Age: 15
- Personality: optimistic, cheerful, trusting, brave
- Role: protagonist
- Weapon: lightning sword
- Element: lightning
- Battle role: balanced front-line physical attacker
- Colour identity: lightning yellow

### Serelle Vaun
- Age: 15
- Personality: proud, aristocratic, sharp-tongued, disciplined, secretly warm and kind
- Role: first ally — joins in Lumen Town
- Weapon: ice scepter
- Element: ice
- Battle role: magic attacker / utility
- Colour identity: ice blue

### Kael
- Role: second ally — joins in Ashenveil
- Weapon: battle axe
- Element: fire
- Battle role: tank / heavy physical attacker
- Colour identity: ember orange

### Braxtion — [FUTURE, not confronted in Chapter 1]
- Role: major antagonist
- Visual: dark mage, regal menace, controlled power

### Shadecaster Veyr — [current build, Chapter 1 boss]
- Role: field commander aligned with Braxtion
- Fight location: North Pass
- Outcome: `chapter_1_complete` and `boss_veyr_defeated` flags set on defeat

### Grove Warden — [current build, optional encounter]
- Role: corrupted guardian spirit in the Thornwood
- Optional scripted fight; rewards items on clear

---

## Chapter 1 story flow (implemented)

1. Title screen — New Game or Load Game
2. Player spawns on world map (Border Fields) near Lumen Town entrance
3. Enter Lumen Town — talk to NPCs, explore inn and shop
4. Story event: Serelle joins the party (`serelle_joined` flag set)
5. Leave town and travel north through the North Pass zone (random encounters active)
6. North Pass trigger fires — boss introduction dialogue
7. Boss battle: Shadecaster Veyr
8. Victory dialogue — `boss_veyr_defeated` and `chapter_1_complete` flags set
9. Return to world map
10. Optional: travel east to Ashenveil Road (random encounters), enter Ashenveil, recruit Kael
11. Optional: push south into the Thornwood, defeat Grove Warden

---

## Intended full scope [FUTURE — not yet started]

- Complete story arc — multiple chapters leading to confrontation with Braxtion
- Suikoden-inspired recruit roster (30+ characters) [FUTURE]
- 5-person active party in battle (current: 3 max active) [FUTURE]
- 5-enemy group max in battle (current: up to 3 in data) [FUTURE]
- Equipment management UI for manual slot assignment [FUTURE]
- Branching dialogue trees [FUTURE]
- Quest journal / objective tracker [FUTURE]
- Multiple world map regions [FUTURE]
- Multiple save slots (currently 1) [FUTURE]
- Controller / gamepad support [FUTURE]
- Background music and sound effects [FUTURE]
- Portrait sprite art (currently placeholder ellipses) [FUTURE]
- Tile-based map rendering (currently pixel-based free movement) [FUTURE]

---

## First playable success criteria (met)

A player can:
- Launch the game in a browser and start a new game
- Walk the world map and enter Lumen Town
- Talk to NPCs and recruit Serelle through a story event
- Save the game
- Leave town and fight random battles in the North Pass
- Win a battle and receive XP and gold
- Defeat Shadecaster Veyr (scripted boss fight)
- Optionally recruit Kael in Ashenveil
- Optionally clear the Thornwood
