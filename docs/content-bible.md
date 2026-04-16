# Content Bible

All canonical content identifiers and values. These ids are stable references used across data files, save data, dialogue, and world configuration. Do not rename any id without a full cross-reference audit and a `SAVE_VERSION` bump if the id is stored in save data. See `docs/id-stability-rules.md` for the full rules.

---

## Party members

Source: `data/characters/party-members.ts`

| Id | Name | Active at start | Weapon | Armor | Skill |
|----|------|----------------|--------|-------|-------|
| `hugo` | Hugo | Yes | `iron_sword` | `leather_vest` | `lightning_slash` |
| `serelle_vaun` | Serelle | No — joins via `serelle_joined` | `apprentice_rod` | `cloth_robe` | `ice_shard` |
| `kael` | Kael | No — joins via `kael_joined` | `battle_axe` | `iron_plate` | `flame_cleave` |

### Base stats (level 1, before equipment bonuses)

| Stat | Hugo | Serelle | Kael |
|------|------|---------|------|
| maxHP | 120 | 90 | 140 |
| maxMP | 40 | 70 | 28 |
| attack | 18 | 8 | 22 |
| magic | 8 | 22 | 5 |
| defense | 12 | 8 | 16 |
| speed | 10 | 12 | 7 |

### Stat growth per level-up

Source: `data/characters/level-growth.ts`

| Stat | Hugo | Serelle | Kael |
|------|------|---------|------|
| maxHP | +14 | +8 | +18 |
| maxMP | +4 | +10 | +2 |
| attack | +3 | +1 | +4 |
| magic | +1 | +4 | +0 |
| defense | +2 | +1 | +3 |
| speed | +1 | +2 | +1 |

### XP thresholds

`PartyMember.xp` is **total lifetime XP**, never resets.

| Level | Total XP | Level | Total XP |
|-------|---------|-------|---------|
| 1 | 0 | 6 | 1 200 |
| 2 | 100 | 7 | 1 800 |
| 3 | 250 | 8 | 2 600 |
| 4 | 450 | 9 | 3 600 |
| 5 | 750 | 10 | 5 000 |

Levels 11+: `threshold(L) = threshold(L−1) + L × 300`. Max level: 99.

---

## Skills

Source: `data/skills/skills.ts`

| Id | Name | User | MP | Target | Element | Scaling | Power |
|----|------|------|----|--------|---------|---------|-------|
| `lightning_slash` | Lightning Slash | Hugo | 8 | `single_enemy` | `lightning` | `attack` (explicit) | 1.6 |
| `ice_shard` | Ice Shard | Serelle | 8 | `single_enemy` | `ice` | magic (heuristic) | 1.7 |
| `flame_cleave` | Flame Cleave | Kael | 9 | `single_enemy` | `fire` | `attack` (explicit) | 1.55 |
| `wisp_flare` | Wisp Flare | Corrupted Wisp | 8 | `single_enemy` | `none` | `magic` (explicit) | 1.8 |
| `dark_bolt` | Dark Bolt | Enemies | 10 | `single_enemy` | `dark` | magic (heuristic) | 1.5 |
| `shadow_wave` | Shadow Wave | Enemies | 18 | `all_enemies` | `dark` | magic (heuristic) | 1.2 |

`scalingStat` explicit override takes priority over element heuristic. Heuristic: elemental → magic; `'none'` → attack.

---

## Items

Source: `data/items/items.ts`. All items are `targetType: 'single_ally'`.

| Id | Name | Price | Effect |
|----|------|-------|--------|
| `herb_tonic` | Herb Tonic | 30g | +60 HP |
| `clearwater_drop` | Clearwater Drop | 40g | +25 MP |
| `healing_salve` | Healing Salve | 75g | +140 HP |
| `ether_vial` | Ether Vial | 90g | +60 MP |

---

## Equipment

Source: `data/equipment/equipment.ts`. Bonuses applied via `resolveEffectiveStats()` at battle time — base stats in `PartyMember` are never modified.

### Weapons

| Id | Name | +ATK | +MAG | +SPD | Price |
|----|------|------|------|------|-------|
| `iron_sword` | Iron Sword | +6 | — | — | 0 (starter) |
| `apprentice_rod` | Apprentice Rod | — | +7 | — | 0 (starter) |
| `battle_axe` | Battle Axe | +8 | — | −1 | 0 (starter) |
| `steel_sword` | Steel Sword | +11 | — | — | 280g |
| `war_axe` | War Axe | +13 | — | −1 | 300g |
| `ice_scepter` | Ice Scepter | — | +13 | +1 | 320g |

### Armor

| Id | Name | +DEF | +HP | +MP | +SPD | Price |
|----|------|------|-----|-----|------|-------|
| `leather_vest` | Leather Vest | +5 | +10 | — | — | 0 (starter) |
| `cloth_robe` | Cloth Robe | +3 | — | +12 | — | 0 (starter) |
| `iron_plate` | Iron Plate | +9 | +20 | — | −1 | 0 (starter) |
| `chain_mail` | Chain Mail | +8 | +18 | — | — | 350g |
| `mage_coat` | Mage's Coat | +5 | — | +20 | — | 300g (+2 MAG) |

Starter equipment has `price: 0` and is pre-equipped. Any purchasable item always upgrades over starter.

---

## Enemies

Source: `data/enemies/enemies.ts`

| Id | Name | Lv | HP | MP | ATK | MAG | DEF | SPD | XP | Gold | Skills |
|----|------|----|----|-----|-----|-----|-----|-----|----|------|--------|
| `braxtion_soldier` | Braxtion Soldier | 2 | 60 | 0 | 14 | 0 | 8 | 7 | 30 | 12g | — |
| `dark_acolyte` | Dark Acolyte | 3 | 45 | 30 | 8 | 16 | 5 | 9 | 38 | 15g | `dark_bolt` |
| `ridge_fang` | Ridge Fang | 3 | 55 | 0 | 16 | 0 | 6 | 13 | 25 | 10g | — |
| `shadecaster_veyr` | Shadecaster Veyr | 8 | 220 | 80 | 18 | 28 | 14 | 11 | 300 | 0 | `dark_bolt`, `shadow_wave` |
| `ashenveil_patrol` | Ashenveil Patrol | 4 | 78 | 0 | 17 | 0 | 11 | 8 | 44 | 18g | — |
| `thornwood_lurker` | Thornwood Lurker | 4 | 72 | 0 | 19 | 0 | 7 | 14 | 42 | 14g | — |
| `corrupted_wisp` | Corrupted Wisp | 5 | 38 | 40 | 5 | 20 | 3 | 11 | 48 | 16g | `wisp_flare` |
| `grove_warden` | Grove Warden | 6 | 160 | 60 | 10 | 24 | 8 | 10 | 120 | 0 | `wisp_flare`, `shadow_wave` |

Boss enemies (`shadecaster_veyr`, `grove_warden`) have `goldReward: 0` — rewards come from scripted dialogue effects instead. They do not appear in random encounter pools.

---

## Locations

Source: `data/maps/locations.ts`

| Id | Display name | Encounters |
|----|-------------|-----------|
| `border_fields` | Border Fields | No |
| `lumen_town` | Lumen Town | No |
| `north_pass` | North Pass | Yes |
| `ashenveil_road` | Ashenveil Road | Yes |
| `ashenveil_town` | Ashenveil | No |
| `thornwood` | Thornwood | Yes |

---

## World triggers

Source: `data/maps/world-map-config.ts`

| Id | Destination | Requires flag | Consumed by flag | Type |
|----|------------|--------------|-----------------|------|
| `lumen_town_entrance` | `lumen_town` (TownScene) | — | — | Normal |
| `north_pass_entrance` | North Pass (BattleScene) | `serelle_joined` | `boss_veyr_defeated` | Scripted boss |
| `ashenveil_road_entrance` | `ashenveil_town` (TownScene) | — | — | Normal |
| `grove_warden_clearing` | Thornwood (BattleScene) | — | `thornwood_cleared` | Scripted optional |

---

## Encounter tables

Source: `data/maps/encounter-tables.ts`

| Zone id | Min steps | Chance/step | Enemy groups |
|---------|-----------|-------------|-------------|
| `north_pass_zone` | 8 | 12% | Soldier; Soldier×2; Acolyte; Fang; Acolyte+Soldier |
| `ashenveil_road_zone` | 6 | 13% | Patrol; Patrol×2; Patrol+Acolyte; Fang+Patrol; Acolyte×2; Fang×2 |
| `thornwood_zone` | 8 | 14% | Lurker; Lurker×2; Wisp; Wisp×2; Lurker+Wisp |

---

## Story flags

Source: `data/story/story-events.ts`. Always use `STORY_FLAGS.X` — never raw strings.

| Constant | String id | Set by | Effect |
|----------|-----------|--------|--------|
| `SERELLE_JOINED` | `serelle_joined` | Serelle join dialogue | Activates Serelle; gates North Pass trigger |
| `KAEL_JOINED` | `kael_joined` | Kael join dialogue | Activates Kael |
| `CHAPTER_1_COMPLETE` | `chapter_1_complete` | Boss Veyr outro | Marks end of Chapter 1 |
| `BOSS_VEYR_DEFEATED` | `boss_veyr_defeated` | Boss Veyr outro | Consumes North Pass trigger; enables NPC overrides |
| `THORNWOOD_CLEARED` | `thornwood_cleared` | Grove Warden outro | Consumes grove trigger; grants reward items; enables NPC overrides |
| `NORTH_PASS_UNLOCKED` | `north_pass_unlocked` | Reserved — not yet set | Placeholder for a future gate |

---

## Town shop stock

### Lumen Town (`data/maps/lumen-town-config.ts`)
`herb_tonic`, `clearwater_drop`

### Ashenveil (`data/maps/ashenveil-town-config.ts`)
Consumables: `herb_tonic`, `healing_salve`, `clearwater_drop`, `ether_vial`
Equipment: `steel_sword`, `war_axe`, `ice_scepter`, `chain_mail`, `mage_coat`

---

## Dialogue speaker ids

Source: `dialogue/dialogue-types.ts`, `dialogue/DialogueOverlay.ts`

| Id | Display name | Colour on dark panel | Colour on parchment |
|----|-------------|---------------------|-------------------|
| `hugo` | Hugo | `#E8D25F` | `#7a4e00` |
| `serelle_vaun` | Serelle | `#8FC8FF` | `#0a3070` |
| `kael` | Kael | `#D4724A` | `#6a2c0a` |
| `narrator` | _(blank)_ | — | — |
| `enemy_mage` | ??? | `#D97A7A` | `#6a0a0a` |
| `innkeeper` | Innkeeper | `#F3EBD2` | `#3a2a06` |
| `shopkeeper` | Merchant | `#F3EBD2` | `#3a2a06` |
| `villager` | Villager | `#F3EBD2` | `#3a2a06` |
| `guard` | Guard | `#F3EBD2` | `#1a2a1a` |

---

## Dialogue event effect types

Source: `dialogue/dialogue-types.ts`

| Effect type | Fields | Action |
|-------------|--------|--------|
| `set_flag` | `flagId: string` | Sets a story flag to true |
| `activate_party_member` | `memberId: string` | Sets `isActive = true` on a roster member |
| `add_gold` | `amount: number` | Adds gold to player total |
| `add_item` | `itemId: string, quantity?: number` | Adds items to inventory (default qty 1) |
