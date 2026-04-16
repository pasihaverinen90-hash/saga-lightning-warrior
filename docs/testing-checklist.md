# Testing Checklist

Manual test protocol. Run these checks after any non-trivial change. Each item is binary: pass or fail.

Run `npm run typecheck` before everything else. TS2339 and TS2307 are expected ambient-type noise from absent `node_modules`. Any other `error TS` is a real failure that must be fixed before testing.

---

## 1. Title screen

- [ ] Game loads in browser with no console errors
- [ ] Title text and subtitle render in correct fonts and colours
- [ ] "New Game" is selectable and highlighted in blue
- [ ] "Load Game" is dimmed and not selectable when no save exists
- [ ] "Load Game" is active when a save exists
- [ ] Up/Down arrow keys cycle selection
- [ ] Enter / Space confirms selection
- [ ] No input fires before PreloadScene completes

---

## 2. New Game

- [ ] Pressing Enter on "New Game" starts the world map scene
- [ ] Player spawns in Border Fields near Lumen Town entrance
- [ ] Player has 50 gold
- [ ] Player has Herb Tonic × 2
- [ ] Only Hugo is in the active party
- [ ] No story flags are set

---

## 3. World map

- [ ] Player moves in all 4 directions with arrow keys
- [ ] Player cannot leave map boundaries
- [ ] Player collides with obstacle rectangles
- [ ] Location label at top-left updates when entering a named zone
- [ ] Interaction prompt appears when standing inside a trigger rect
- [ ] `E` key fires the trigger transition (to town or battle)
- [ ] Camera follows the player smoothly

---

## 4. Random encounters

- [ ] No encounter fires within the first ~8 steps of entering North Pass zone
- [ ] An encounter fires eventually after walking further in the zone
- [ ] After a battle, ~6 safe steps pass before the next encounter can fire
- [ ] No encounter fires while walking in Border Fields (safe zone)
- [ ] No encounter fires inside Lumen Town or Ashenveil

---

## 5. Town exploration

- [ ] Player enters Lumen Town from the world map trigger
- [ ] Player can walk around with arrow keys
- [ ] Player can return to world map via the exit zone
- [ ] `E` near inn opens inn modal
- [ ] `E` near shop opens shop modal
- [ ] `E` near save crystal opens save modal
- [ ] `E` near an NPC opens dialogue overlay
- [ ] Dialogue advances with Enter/Space
- [ ] Dialogue closes and control returns to town after the last line

---

## 6. Inn

- [ ] Inn modal opens with Rest and Cancel options
- [ ] Rest restores all HP/MP for all active party members
- [ ] Inn modal closes after Rest
- [ ] Cancel closes without restoring HP

---

## 7. Shop — items

- [ ] Shop modal opens showing available items and prices
- [ ] Player gold displayed correctly
- [ ] Purchasing an item deducts the correct gold and adds to inventory
- [ ] Attempting to buy with insufficient gold shows an error message

---

## 8. Shop — equipment

- [ ] Purchasing equipment equips on all active party members whose slot is empty or holds cheaper gear
- [ ] Members with equal or better gear are skipped
- [ ] If nobody benefits, the purchase is refused with an explanation and gold is refunded

---

## 9. Save and load

- [ ] Saving at inn or save crystal writes to localStorage without error
- [ ] "Load Game" on title is enabled after saving
- [ ] Loading resumes at the correct location with correct gold, inventory, flags, and HP
- [ ] If `SAVE_VERSION` was bumped, old saves are rejected and the game starts fresh

---

## 10. Story events — Serelle joins

- [ ] Before event: only Hugo is active
- [ ] Interacting with Serelle's NPC triggers the join dialogue
- [ ] After dialogue: Serelle is active in the party
- [ ] `serelle_joined` flag is set
- [ ] North Pass trigger is now accessible (requires `serelle_joined`)

---

## 11. Story events — Kael joins

- [ ] Travelling to Ashenveil requires no flag
- [ ] Interacting with Kael triggers the join dialogue
- [ ] After dialogue: Kael is active in the party
- [ ] `kael_joined` flag is set

---

## 12. Battle — basic flow

- [ ] Battle scene loads with the correct background colour
- [ ] All active party members appear in lower-left formation
- [ ] Enemies appear in upper-right formation
- [ ] Turn indicator shows whose turn it is
- [ ] Command menu shows Attack / Skill / Item / Defend

---

## 13. Battle — commands

- [ ] Attack → target selection → executes → fire digit damage number appears above target
- [ ] Skill → skill panel opens with name, description, MP cost → target selection → executes
- [ ] Item → item panel opens with name, quantity, glyph effect → target selection → heal applied
- [ ] Defend → shield icon appears in status panel; next hit is reduced
- [ ] ESC from target select returns to the menu that opened it (skill or item panel, not command menu)
- [ ] Disabled Skill (insufficient MP) shown dimmed — cannot be confirmed
- [ ] Disabled Item (empty inventory) shown dimmed — cannot be confirmed

---

## 14. Battle — damage and healing

- [ ] Damage: fire digit sprites with `−` prefix appear above target, rise and fade
- [ ] HP heal: green digit sprites with `+` prefix appear above target, rise and fade
- [ ] MP restore: blue text `+N MP` appears above target, rises and fades
- [ ] HP heals do not exceed target's missing HP (no overheal)
- [ ] Defeated ally shows "Defeated" in status panel row

---

## 15. Battle — victory

- [ ] Result panel shows "Victory!" on the custom art background
- [ ] Gold earned displayed and added to state
- [ ] XP displayed with per-member split rows
- [ ] Level-up row shows `+N XP → Lv X` in appropriate colour
- [ ] Entering next battle with a leveled-up member uses new stats

---

## 16. Battle — defeat

- [ ] All allies defeated → result panel shows defeat message
- [ ] Pressing Enter returns to title screen (no save written)

---

## 17. Boss — Shadecaster Veyr

- [ ] North Pass trigger requires Serelle in party (`serelle_joined`)
- [ ] Boss intro dialogue plays before battle
- [ ] `boss_veyr_defeated` and `chapter_1_complete` flags set after victory
- [ ] Post-boss outro dialogue plays
- [ ] North Pass trigger no longer fires after flag is set
- [ ] Lumen Town NPCs reflect the cleared state (dialogue overrides)

---

## 18. Boss — Grove Warden (optional)

- [ ] Grove Warden trigger fires in Thornwood zone
- [ ] Fight starts correctly; warden uses `shadow_wave` on the party
- [ ] `thornwood_cleared` flag set on victory
- [ ] Reward items added to inventory
- [ ] Grove trigger no longer fires after flag is set

---

## 19. Equipment

- [ ] Party members start with correct starter equipment
- [ ] Buying Steel Sword in Ashenveil equips on eligible members
- [ ] Members already holding better gear are skipped
- [ ] Equipment bonuses reflected in battle (higher damage output visible)

---

## 20. Regression after any state/save change

After any change to `GameState`, `PartyMember`, `InventoryEntry`, or `EquipmentSlots`:

- [ ] `SAVE_VERSION` incremented if fields changed
- [ ] An old-version save is correctly rejected (returns `false` from `loadGame()`, does not crash)
- [ ] `initNewGame()` produces valid state with all new fields populated
