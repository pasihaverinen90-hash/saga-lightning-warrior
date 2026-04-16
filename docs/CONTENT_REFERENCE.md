# Content Reference

All ids listed here are canonical internal identifiers. Do not rename them without auditing every reference in data files, dialogue data, story flags, and world configs.

---

## Party members

Defined in `src/game/data/characters/party-members.ts`.

| Id | Name | Starts active | Weapon slot | Armor slot | Skill |
|----|------|--------------|------------|-----------|-------|
| `hugo` | Hugo | Yes | `iron_sword` | `leather_vest` | `lightning_slash` |
| `serelle_vaun` | Serelle | No — joins via `serelle_joined` flag | `apprentice_rod` | `cloth_robe` | `ice_shard` |
| `kael` | Kael | No — joins via `kael_joined` flag | `battle_axe` | `iron_plate` | `flame_cleave` |

### Starting stats (Lv 1, before equipment bonuses)

| | Hugo | Serelle | Kael |
|--|------|---------|------|
| HP | 120 | 90 | 140 |
| MP | 40 | 70 | 28 |
| Attack | 18 | 8 | 22 |
| Magic | 8 | 22 | 5 |
| Defense | 12 | 8 | 16 |
| Speed | 10 | 12 | 7 |

### Stat growth per level-up

Defined in `src/game/data/characters/level-growth.ts`.

| | Hugo | Serelle | Kael |
|--|------|---------|------|
| HP | +14 | +8 | +18 |
| MP | +4 | +10 | +2 |
| Attack | +3 | +1 | +4 |
| Magic | +1 | +4 | +0 |
| Defense | +2 | +1 | +3 |
| Speed | +1 | +2 | +1 |

### XP thresholds

Defined in `src/game/data/characters/level-growth.ts`. `PartyMember.xp` is **total lifetime XP**, not remainder.

| Level | Total XP needed |
|-------|----------------|
| 1 | 0 |
| 2 | 100 |
| 3 | 250 |
| 4 | 450 |
| 5 | 750 |
| 6 | 1 200 |
| 7 | 1 800 |
| 8 | 2 600 |
| 9 | 3 600 |
| 10 | 5 000 |
| 11+ | `threshold(L-1) + L × 300` |

Max level: 99.

---

## Skills

Defined in `src/game/data/skills/skills.ts`.

| Id | Name | User | MP cost | Target | Element | Scaling | Power |
|----|------|------|---------|--------|---------|---------|-------|
| `lightning_slash` | Lightning Slash | Hugo | 8 | Single enemy | Lightning | Attack | 1.6× |
| `ice_shard` | Ice Shard | Serelle | 7 | Single enemy | Ice | Magic | 1.7× |
| `flame_cleave` | Flame Cleave | Kael | 9 | Single enemy | Fire | Attack | 1.55× |
| `dark_bolt` | Dark Bolt | Enemies | — | Single enemy | Dark | Magic | 1.5× |
| `shadow_wave` | Shadow Wave | Enemies | — | All enemies | Dark | Magic | 1.2× |
| `wisp_flare` | Wisp Flare | Corrupted Wisp | — | Single enemy | None | Magic | 1.8× |

`scalingStat` overrides the element heuristic. If not set, elemental skills use magic; non-elemental skills use attack.

---

## Items

Defined in `src/game/data/items/items.ts`. All items are `targetType: 'single_ally'`.

| Id | Name | Price | Effect |
|----|------|-------|--------|
| `herb_tonic` | Herb Tonic | 30g | +60 HP |
| `clearwater_drop` | Clearwater Drop | 40g | +25 MP |
| `healing_salve` | Healing Salve | 75g | +140 HP |
| `ether_vial` | Ether Vial | 90g | +60 MP |

---

## Equipment

Defined in `src/game/data/equipment/equipment.ts`. Bonuses are applied via `resolveEffectiveStats()` at battle time — base stats in `PartyMember` are never modified.

### Weapons

| Id | Name | Attack | Magic | Speed | Price |
|----|------|--------|-------|-------|-------|
| `iron_sword` | Iron Sword | +6 | — | — | 0 (starter) |
| `apprentice_rod` | Apprentice Rod | — | +7 | — | 0 (starter) |
| `battle_axe` | Battle Axe | +8 | — | −1 | 0 (starter) |
| `steel_sword` | Steel Sword | +11 | — | — | 280g |
| `war_axe` | War Axe | +13 | — | −1 | 300g |
| `ice_scepter` | Ice Scepter | — | +13 | +1 | 320g |

### Armor

| Id | Name | Defense | HP | MP | Speed | Price |
|----|------|---------|----|----|-------|-------|
| `leather_vest` | Leather Vest | +5 | +10 | — | — | 0 (starter) |
| `cloth_robe` | Cloth Robe | +3 | — | +12 | — | 0 (starter) |
| `iron_plate` | Iron Plate | +9 | +20 | — | −1 | 0 (starter) |
| `chain_mail` | Chain Mail | +8 | +18 | — | — | 350g |
| `mage_coat` | Mage's Coat | +5 | — | +20 | — | 300g (+2 magic) |

Starter equipment has `price: 0` and is pre-equipped. The shop system uses `purchaseEquipment()` which auto-equips if the item is strictly better than the currently equipped piece.

---

## Enemies

Defined in `src/game/data/enemies/enemies.ts`.

| Id | Name | Base Lv | HP | XP | Gold | Skills | Boss |
|----|------|---------|----|----|------|--------|------|
| `braxtion_soldier` | Braxtion Soldier | 2 | 60 | 30 | 12g | — | No |
| `dark_acolyte` | Dark Acolyte | 3 | 45 | 38 | 15g | `dark_bolt` | No |
| `ridge_fang` | Ridge Fang | 3 | 55 | 25 | 10g | — | No |
| `shadecaster_veyr` | Shadecaster Veyr | 8 | 220 | 300 | — | `dark_bolt` | Yes |
| `ashenveil_patrol` | Ashenveil Patrol | 4 | 78 | 44 | 18g | — | No |
| `thornwood_lurker` | Thornwood Lurker | 4 | 72 | 42 | 14g | — | No |
| `corrupted_wisp` | Corrupted Wisp | 5 | 38 | 48 | 16g | `wisp_flare` | No |
| `grove_warden` | Grove Warden | 6 | 160 | 120 | — | `shadow_wave` | Scripted only |

Boss enemies (`isBoss: true`) only appear in scripted battles, not in random encounter pools.

---

## Locations

Defined in `src/game/data/maps/locations.ts`.

| Id | Display name | Encounters |
|----|-------------|-----------|
| `border_fields` | Border Fields | No |
| `lumen_town` | Lumen Town | No |
| `north_pass` | North Pass | Yes |
| `ashenveil_road` | Ashenveil Road | Yes |
| `ashenveil_town` | Ashenveil | No |
| `thornwood` | Thornwood | Yes |

---

## Encounter tables

Defined in `src/game/data/maps/encounter-tables.ts`. Zone bounding boxes are in `data/maps/world-map-config.ts`.

| Zone id | Min safe steps | Chance/step | Enemy groups |
|---------|---------------|-------------|-------------|
| `north_pass_zone` | 8 | 12% | Braxtion Soldier ×1–2; Dark Acolyte + Ridge Fang; Soldier ×3 |
| `ashenveil_road_zone` | 6 | 13% | Ashenveil Patrol ×1–2; Patrol + Dark Acolyte; Patrol ×3 |
| `thornwood_zone` | 8 | 14% | Thornwood Lurker ×1–2; Lurker + Corrupted Wisp; Wisp ×2 |

Step size: 32px. Safe-step cooldown after any battle: 6 steps (enforced by `EncounterTracker`).

---

## Story flags

Defined in `src/game/data/story/story-events.ts`. All flag ids are accessed via the `STORY_FLAGS` constants object — never use raw strings.

| Constant | String id | Set by | Effect when true |
|----------|-----------|--------|-----------------|
| `SERELLE_JOINED` | `serelle_joined` | Dialogue event in Lumen Town | Serelle becomes active; gates North Pass scripted battle |
| `KAEL_JOINED` | `kael_joined` | Dialogue event in Ashenveil | Kael becomes active |
| `CHAPTER_1_COMPLETE` | `chapter_1_complete` | Post-boss dialogue (Shadecaster Veyr) | Marks end of Chapter 1 slice |
| `BOSS_VEYR_DEFEATED` | `boss_veyr_defeated` | Shadecaster Veyr battle result | Consumes North Pass entrance trigger; updates NPC overrides |
| `THORNWOOD_CLEARED` | `thornwood_cleared` | Grove Warden battle result | Consumes grove trigger; grants reward items; updates NPC overrides |
| `NORTH_PASS_UNLOCKED` | `north_pass_unlocked` | Reserved — not currently set | Placeholder for a future gate |

---

## World triggers

Defined in `src/game/data/maps/world-map-config.ts`. Triggers fire when the player stands within their bounding rect and presses `E`.

| Id | Destination | Requires flag | Consumed by flag | Notes |
|----|------------|--------------|-----------------|-------|
| `lumen_town_entrance` | Lumen Town | — | — | Always open |
| `north_pass_entrance` | North Pass (scripted battle) | `serelle_joined` | `boss_veyr_defeated` | Triggers Shadecaster Veyr fight |
| `ashenveil_road_entrance` | Ashenveil (town) | — | — | Always open |
| `grove_warden_clearing` | Thornwood (scripted battle) | — | `thornwood_cleared` | Optional boss; rewards items on clear |

---

## Shop stock

### Lumen Town shop

`herb_tonic`, `clearwater_drop`

### Ashenveil shop

Consumables: `herb_tonic`, `healing_salve`, `clearwater_drop`, `ether_vial`

Equipment: `steel_sword`, `war_axe`, `ice_scepter`, `chain_mail`, `mage_coat`

---

## Dialogue speaker ids

Defined by the `SpeakerId` union type in `src/game/dialogue/dialogue-types.ts` and mapped in `DialogueOverlay.ts`.

| Id | Display name | Name colour (on parchment) |
|----|-------------|---------------------------|
| `hugo` | Hugo | Dark gold `#7a4e00` |
| `serelle_vaun` | Serelle | Dark navy `#0a3070` |
| `kael` | Kael | Dark ember `#6a2c0a` |
| `narrator` | _(blank)_ | — |
| `enemy_mage` | ??? | Dark crimson `#6a0a0a` |
| `innkeeper` | Innkeeper | Dark ink `#3a2a06` |
| `shopkeeper` | Merchant | Dark ink `#3a2a06` |
| `villager` | Villager | Dark ink `#3a2a06` |
| `guard` | Guard | Dark green `#1a2a1a` |
