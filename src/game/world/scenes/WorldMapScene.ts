// src/game/world/scenes/WorldMapScene.ts
// World map exploration: movement, collision detection, zone tracking,
// trigger interaction, and distance-based random encounters.
//
// Architecture:
//   Rendering and input live here.
//   Movement math     → shared/movement-system.ts  (pure TS, no Phaser)
//   Trigger logic     → world/systems/transition-system.ts (pure TS)
//   Zone / encounter  → world/systems/encounter-system.ts  (pure TS)
//   Scripted battles  → trigger.scriptedBattle data (flag-gated, data-driven)
//   Map data          → data/maps/world-map-config.ts

import Phaser from 'phaser';
import { SCENE_KEYS } from '../../core/scene-keys';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  COLORS,
  COLOR_HEX,
  FONTS,
  FONT_SIZES,
  PANEL,
} from '../../core/config';
import { drawPanel } from '../../ui/common/panel';
import { computeMovement, type MovementInput } from '../../shared/movement-system';
import { getActiveTrigger } from '../systems/transition-system';
import { getActiveZone, EncounterTracker } from '../systems/encounter-system';
import { ENCOUNTER_TABLES } from '../../data/maps/encounter-tables';
import { BORDER_FIELDS_CONFIG } from '../../data/maps/world-map-config';
import { setCurrentLocation } from '../../state/state-actions';
import { getStoryFlag } from '../../state/state-selectors';
import type { WorldTrigger, WorldZone, WorldMapInitData } from '../types/world-types';
import { PLAYER_W, PLAYER_H } from '../../shared/constants/player';
import type { BattleInitData } from '../../battle/engine/battle-types';

// ─── Constants ────────────────────────────────────────────────────────────────

const CFG = BORDER_FIELDS_CONFIG;
const MAP_W = CFG.mapWidth;
const MAP_H = CFG.mapHeight;

const PLAYER_SPEED = 200; // px/sec

// ─── Scene ────────────────────────────────────────────────────────────────────

export class WorldMapScene extends Phaser.Scene {
  // ── Player ─────────────────────────────────────────────────────────────────
  private player!: Phaser.GameObjects.Graphics;
  /** Top-left world position of the player rect (used by all systems). */
  private px = CFG.playerStartX;
  private py = CFG.playerStartY;

  // ── Input ──────────────────────────────────────────────────────────────────
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyWASD!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private keyMenu!: Phaser.Input.Keyboard.Key;

  // ── HUD (fixed to camera via setScrollFactor(0)) ───────────────────────────
  private hudZonePanel!: Phaser.GameObjects.Graphics;
  private hudZoneText!: Phaser.GameObjects.Text;
  private hudDangerBadge!: Phaser.GameObjects.Container;
  private hudHintPanel!: Phaser.GameObjects.Graphics;
  private hudHintText!: Phaser.GameObjects.Text;

  // ── State ──────────────────────────────────────────────────────────────────
  private activeTrigger: WorldTrigger | null = null;
  private activeZone: WorldZone | null = null;
  private previousZoneId: string | null = null;
  private transitionPending = false;
  private menuActive        = false;
  private menuCooldown      = false;
  private encounterTracker = new EncounterTracker(6);

  // ─────────────────────────────────────────────────────────────────────────

  constructor() {
    super({ key: SCENE_KEYS.WORLD_MAP });
  }

  // ─── init ─────────────────────────────────────────────────────────────────

  init(data: WorldMapInitData): void {
    if (data && data.returnX !== undefined && data.returnY !== undefined) {
      this.px = data.returnX;
      this.py = data.returnY;
    } else {
      this.px = CFG.playerStartX;
      this.py = CFG.playerStartY;
    }
    this.transitionPending = false;
    this.menuActive        = false;
    this.menuCooldown      = false;
    this.activeTrigger  = null;
    this.activeZone     = null;
    this.previousZoneId = null;
    this.encounterTracker.onBattleFired();
  }

  // ─── create ───────────────────────────────────────────────────────────────

  create(): void {
    this.cameras.main.setBackgroundColor('#1e3a20');
    // Bounds read from config — automatically correct for any map size.
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.fadeIn(350, 0, 0, 0);

    this.drawWorld();
    this.createPlayer();
    this.createHUD();
    this.setupInput();

    this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
    this.cameras.main.setFollowOffset(-PLAYER_W / 2, -PLAYER_H / 2);
  }

  // ─── update ───────────────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    if (this.transitionPending) return;
    if (this.menuActive) return;

    if (this.menuCooldown && !this.keyMenu.isDown) {
      this.menuCooldown = false;
    }

    if (!this.menuCooldown && Phaser.Input.Keyboard.JustDown(this.keyMenu)) {
      this.openMenu();
      return;
    }

    const input = this.readInput();

    const prevX = this.px;
    const prevY = this.py;

    const result = computeMovement(
      this.px, this.py,
      input,
      PLAYER_SPEED,
      delta,
      MAP_W, MAP_H,
      PLAYER_W, PLAYER_H,
      CFG.collisionRects,
    );

    this.px = result.x;
    this.py = result.y;

    this.player.setPosition(this.px, this.py);

    if (result.moving && (result.x !== prevX || result.y !== prevY)) {
      setCurrentLocation({
        locationId: 'border_fields',
        x: Math.round(this.px + PLAYER_W / 2),
        y: Math.round(this.py + PLAYER_H / 2),
      });
    }

    this.activeTrigger = getActiveTrigger(
      this.px, this.py, PLAYER_W, PLAYER_H,
      CFG.triggers.filter(t => !this.isTriggerConsumed(t)),
    );
    this.activeZone    = getActiveZone(this.px, this.py, PLAYER_W, PLAYER_H, CFG.zones);

    const currentZoneId = this.activeZone?.id ?? null;
    if (currentZoneId !== this.previousZoneId) {
      this.encounterTracker.resetSteps();
      this.previousZoneId = currentZoneId;
    }

    if (result.moving && this.activeZone?.type === 'encounter') {
      const table = ENCOUNTER_TABLES[this.activeZone.id];
      if (table) {
        const dx = result.x - prevX;
        const dy = result.y - prevY;
        const distanceTraveled = Math.sqrt(dx * dx + dy * dy);
        const group = this.encounterTracker.onMove(distanceTraveled, table);
        if (group) {
          this.launchRandomEncounter(group.enemyIds, table.backgroundId);
          return;
        }
      }
    }

    this.updateHUD();

    if (this.activeTrigger && Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
      this.activateTrigger(this.activeTrigger);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // World background drawing
  // All coordinates are world-space so the camera scrolls correctly.
  // ─────────────────────────────────────────────────────────────────────────

  private drawWorld(): void {
    this.drawSkyAndGround();
    this.drawEncounterZoneOverlay();
    this.drawRoads();
    this.drawForestEdges();
    this.drawMountainRange();
    this.drawTownArea();
    this.drawAshenveilArea();
    this.drawNorthPassArea();
    this.drawThornwoodArea();
    this.drawTriggerMarkers();
  }

  private drawSkyAndGround(): void {
    const gfx = this.add.graphics();

    // Sky gradient — layered horizontal bands
    gfx.fillStyle(0x0d1f3c, 1); gfx.fillRect(0,   0,   MAP_W, 500);
    gfx.fillStyle(0x163354, 1); gfx.fillRect(0,   240, MAP_W, 340);
    gfx.fillStyle(0x1e4a30, 1); gfx.fillRect(0,   500, MAP_W, 120);
    // Ground grass
    gfx.fillStyle(0x2d6b35, 1); gfx.fillRect(0,   580, MAP_W, MAP_H - 580);
    // Subtle lighter midground band
    gfx.fillStyle(0x366e3e, 0.3); gfx.fillRect(180, 700, 3736, MAP_H - 700);

    // Stars — scattered across the wide sky
    gfx.fillStyle(0xffffff, 0.55);
    const stars = [
      [120,45],[350,28],[620,58],[940,33],[1280,68],
      [1600,40],[1920,72],[2240,30],[2560,58],[2880,44],
      [3200,70],[3520,32],[3840,54],[180,115],[520,98],
      [860,135],[1200,90],[1540,118],[1880,102],[2220,84],
      [2560,125],[2900,108],[3240,88],[3580,122],[3880,95],
      [160,180],[440,168],[720,195],[1000,176],[1300,192],
      [1600,165],[1900,188],[2200,172],[2500,196],[2800,158],
      [3100,182],[3400,168],[3700,194],
    ];
    for (const [sx, sy] of stars) gfx.fillRect(sx, sy, 2, 2);
  }

  private drawEncounterZoneOverlay(): void {
    const gfx = this.add.graphics();
    for (const zone of CFG.zones) {
      if (zone.type !== 'encounter') continue;
      if (zone.id === 'north_pass_zone') {
        gfx.fillStyle(0x000000, 0.28);
        gfx.fillRect(zone.x, zone.y, zone.width, zone.height);
        gfx.fillStyle(0x1a0a2a, 0.22);
        gfx.fillRect(zone.x, zone.y + zone.height - 90, zone.width, 90);
      } else if (zone.id === 'thornwood_zone') {
        gfx.fillStyle(0x001a00, 0.32);
        gfx.fillRect(zone.x, zone.y, zone.width, zone.height);
        gfx.fillStyle(0x0a1a0a, 0.20);
        gfx.fillRect(zone.x, zone.y, zone.width, 80);
      } else if (zone.id === 'ashenveil_road_zone') {
        gfx.fillStyle(0x1a0e00, 0.18);
        gfx.fillRect(zone.x, zone.y, zone.width, zone.height);
      }
    }
  }

  private drawRoads(): void {
    const gfx = this.add.graphics();

    // Main horizontal road — runs from left forest edge to Ashenveil trigger
    gfx.fillStyle(0x8b7340, 1);
    gfx.fillRect(180, 1060, 3280, 90);
    // Edge shadows
    gfx.fillStyle(0x6b5828, 0.6);
    gfx.fillRect(180, 1060, 3280, 8);
    gfx.fillRect(180, 1142, 3280, 8);

    // North-bound path to the pass — from mountain base down to main road
    gfx.fillStyle(0x7a6535, 1);
    gfx.fillRect(1890, 380, 80, 680);
    // Path edge shadows
    gfx.fillStyle(0x6b5828, 0.4);
    gfx.fillRect(1890, 380, 5, 680);
    gfx.fillRect(1965, 380, 5, 680);

    // Road tread marks
    gfx.fillStyle(0x6b5828, 0.4);
    for (let rx = 300; rx < 3400; rx += 120) {
      gfx.fillRect(rx, 1090, 40, 5);
    }
    // Path tread marks
    for (let ry = 430; ry < 1060; ry += 90) {
      gfx.fillRect(1912, ry, 30, 5);
    }
  }

  private drawForestEdges(): void {
    const gfx = this.add.graphics();

    // Left forest wall
    gfx.fillStyle(0x1a4a20, 1);
    gfx.fillRect(0, 0, 180, MAP_H);

    // Right forest wall
    gfx.fillStyle(0x1a4a20, 1);
    gfx.fillRect(3916, 0, 180, MAP_H);

    // Tree silhouettes along edges
    gfx.fillStyle(0x1e5c24, 1);
    for (let ty = 80; ty < MAP_H - 80; ty += 64) {
      // Left side trees
      const lx = 14 + Math.abs(Math.sin(ty * 0.08)) * 28;
      gfx.fillTriangle(lx, ty + 50, lx + 26, ty, lx + 52, ty + 50);
      gfx.fillStyle(0x164d1a, 1);
      gfx.fillTriangle(lx + 6, ty + 38, lx + 26, ty - 14, lx + 46, ty + 38);
      gfx.fillStyle(0x1e5c24, 1);

      // Right side trees
      const rx = 3930 + Math.abs(Math.sin(ty * 0.09)) * 22;
      gfx.fillTriangle(rx, ty + 50, rx + 26, ty, rx + 52, ty + 50);
      gfx.fillStyle(0x164d1a, 1);
      gfx.fillTriangle(rx + 6, ty + 38, rx + 26, ty - 14, rx + 46, ty + 38);
      gfx.fillStyle(0x1e5c24, 1);
    }
  }

  private drawMountainRange(): void {
    const gfx = this.add.graphics();

    // Mountain blocks (match collision rects)
    gfx.fillStyle(0x142a18, 1);
    gfx.fillRect(0,    0, 1600, 380);
    gfx.fillRect(2260, 0, 1836, 380);

    // Peak silhouettes — spread across the wider range
    gfx.fillStyle(0x0f2010, 1);
    const peaks: [number,number,number,number,number,number][] = [
      // Left range
      [80,380,  300,90,  520,380],
      [380,380, 620,50,  860,380],
      [700,380, 960,80,  1220,380],
      [1020,380,1280,55, 1540,380],
      // Right range
      [2160,380,2400,60, 2640,380],
      [2500,380,2760,80, 3020,380],
      [2860,380,3120,50, 3380,380],
      [3220,380,3500,70, 3780,380],
      [3560,380,3800,45, 4096,380],
    ];
    for (const [x1,y1,x2,y2,x3,y3] of peaks) {
      gfx.fillTriangle(x1, y1, x2, y2, x3, y3);
    }

    // Snow caps on tallest peaks
    gfx.fillStyle(0xc8d8c0, 0.6);
    gfx.fillTriangle(300,90,  358,138, 242,138);
    gfx.fillTriangle(620,50,  694,105, 546,105);
    gfx.fillTriangle(1280,55, 1360,108,1200,108);
    gfx.fillTriangle(2400,60, 2478,112,2322,112);
    gfx.fillTriangle(3120,50, 3202,104,3038,104);

    // Foot trees (decorative)
    gfx.fillStyle(0x1a4820, 1);
    for (const [tx, ty] of [
      [160,374],[340,378],[540,374],[760,380],[980,376],[1200,378],[1420,374],
      [2280,378],[2480,374],[2700,380],[2940,376],[3180,380],[3420,374],[3680,378],[3880,374],
    ]) {
      gfx.fillTriangle(tx, ty + 36, tx + 20, ty, tx + 40, ty + 36);
    }
  }

  private drawTownArea(): void {
    const gfx = this.add.graphics();
    const cx = 2830; // Lumen Town centre x (trigger x:2720, width:220 → centre:2830)

    // Town ground
    gfx.fillStyle(0x7a6040, 0.5);
    gfx.fillRect(cx - 260, 580, 520, 480);  // x:2570–3090, y:580–1060

    // Stone plaza
    gfx.fillStyle(0x9a8c76, 1);
    gfx.fillRect(cx - 210, 840, 420, 60);

    // Inn (ochre) — west
    gfx.fillStyle(0xb8722a, 1);
    gfx.fillRect(cx - 250, 620, 120, 120);
    gfx.fillStyle(0x7a3a14, 1);
    gfx.fillTriangle(cx - 264, 620, cx - 190, 560, cx - 116, 620);

    // Shop (blue-grey) — east
    gfx.fillStyle(0x5a7490, 1);
    gfx.fillRect(cx + 120, 635, 110, 110);
    gfx.fillStyle(0x3a5070, 1);
    gfx.fillTriangle(cx + 108, 635, cx + 175, 578, cx + 242, 635);

    // Guard house — centre
    gfx.fillStyle(0x6a6a5a, 1);
    gfx.fillRect(cx - 46, 745, 90, 78);
    gfx.fillStyle(0x4a4a3a, 1);
    gfx.fillTriangle(cx - 60, 745, cx, 698, cx + 60, 745);

    // Gate posts
    gfx.fillStyle(0x8a7860, 1);
    gfx.fillRect(cx - 34, 836, 22, 46);
    gfx.fillRect(cx + 12,  836, 22, 46);
    gfx.fillRect(cx - 38, 830, 90, 12);

    // Windows
    gfx.fillStyle(0xffe0a0, 0.8);
    gfx.fillRect(cx - 240, 640, 18, 16);
    gfx.fillRect(cx - 200, 640, 18, 16);
    gfx.fillRect(cx + 132, 654, 16, 14);

    // Town name label
    this.add.text(cx, 552, 'Lumen Town', {
      fontFamily: FONTS.ui,
      fontSize: '22px',
      color: COLOR_HEX.goldAccent,
      fontStyle: 'bold',
      stroke: '#0a0f1a',
      strokeThickness: 4,
    }).setOrigin(0.5, 1);
  }

  private drawAshenveilArea(): void {
    const gfx = this.add.graphics();
    const cx = 3570; // Ashenveil centre x (trigger x:3460, width:220 → centre:3570)

    // Town ground
    gfx.fillStyle(0x7a6040, 0.4);
    gfx.fillRect(cx - 210, 850, 420, 360);  // x:3360–3780, y:850–1210

    // Stone plaza
    gfx.fillStyle(0x8a7c68, 1);
    gfx.fillRect(cx - 170, 1040, 340, 56);

    // Inn (ochre) — west
    gfx.fillStyle(0xb8722a, 1);
    gfx.fillRect(cx - 200, 878, 110, 110);
    gfx.fillStyle(0x7a3a14, 1);
    gfx.fillTriangle(cx - 214, 878, cx - 145, 822, cx - 76, 878);

    // Elder's hall (blue-grey, larger) — east
    gfx.fillStyle(0x5a7490, 1);
    gfx.fillRect(cx + 20, 868, 160, 130);
    gfx.fillStyle(0x3a5070, 1);
    gfx.fillTriangle(cx + 4, 868, cx + 100, 808, cx + 196, 868);

    // Windows
    gfx.fillStyle(0xffe0a0, 0.8);
    gfx.fillRect(cx - 190, 898, 16, 14);
    gfx.fillRect(cx - 155, 898, 16, 14);
    gfx.fillRect(cx + 34,  888, 14, 12);
    gfx.fillRect(cx + 88,  888, 14, 12);

    // Town name label
    this.add.text(cx, 800, 'Ashenveil', {
      fontFamily: FONTS.ui,
      fontSize: '20px',
      color: COLOR_HEX.goldAccent,
      fontStyle: 'bold',
      stroke: '#0a0f1a',
      strokeThickness: 4,
    }).setOrigin(0.5, 1);
  }

  private drawNorthPassArea(): void {
    const gfx = this.add.graphics();
    const cx   = 1930; // centre of the pass gap (x:1600–2260)
    const topY = 60;

    // Stone pillars
    gfx.fillStyle(0x5a5a60, 1);
    gfx.fillRect(cx - 104, topY + 30, 36, 170);
    gfx.fillRect(cx + 68,  topY + 30, 36, 170);

    // Lintel
    gfx.fillStyle(0x484850, 1);
    gfx.fillRect(cx - 118, topY + 18, 236, 28);

    // Cracks
    gfx.lineStyle(1, 0x2a2a30, 0.8);
    gfx.beginPath();
    gfx.moveTo(cx - 94, topY + 45); gfx.lineTo(cx - 78, topY + 100);
    gfx.moveTo(cx + 80, topY + 58); gfx.lineTo(cx + 96, topY + 118);
    gfx.strokePath();

    // Danger marks
    gfx.fillStyle(0x8a2020, 0.7);
    gfx.fillRect(cx - 16, topY + 26, 32, 6);
    gfx.fillRect(cx - 16, topY + 42, 32, 6);

    // Fog wisps
    gfx.fillStyle(0x1a0a2a, 0.30);
    gfx.fillEllipse(cx, topY + 72, 200, 60);
    gfx.fillStyle(0x1a0a2a, 0.15);
    gfx.fillEllipse(cx + 44, topY + 118, 150, 46);

    // Label
    this.add.text(cx, topY - 8, 'North Pass', {
      fontFamily: FONTS.ui,
      fontSize: '20px',
      color: '#D97A7A',
      fontStyle: 'bold',
      stroke: '#0a0f1a',
      strokeThickness: 4,
    }).setOrigin(0.5, 1);
  }

  private drawThornwoodArea(): void {
    const gfx = this.add.graphics();
    // Zone: x:180–1100, y:1460–2224
    gfx.fillStyle(0x1a3014, 1);
    gfx.fillRect(180, 1460, 920, 764);

    // Undergrowth texture
    gfx.fillStyle(0x142810, 1);
    gfx.fillRect(180, 1480, 920, 140);
    gfx.fillStyle(0x0e1e0c, 0.6);
    gfx.fillRect(220, 1680, 840, 80);

    // Corrupted tree silhouettes
    gfx.fillStyle(0x0a1c08, 1);
    const thornTrees: [number, number, number][] = [
      [190,1568,28], [278,1532,32], [386,1552,26], [494,1518,34],
      [602,1548,28], [710,1522,30], [818,1552,26], [926,1526,32],
      [1010,1568,24],
      [204,1668,26], [322,1688,30], [440,1658,24], [558,1678,28],
      [676,1652,32], [794,1672,26], [912,1660,30],
      [218,1778,28], [344,1808,26], [510,1778,32], [686,1793,28],
      [808,1762,30], [950,1788,24],
      [198,1888,26], [304,1876,30], [588,1906,28], [724,1870,32],
      [858,1896,26], [980,1880,30],
      [214,1998,24], [394,1988,28], [524,2018,26], [664,2002,30],
      [820,1988,24], [958,2016,28],
      [228,2108,26], [418,2098,30], [578,2118,24], [748,2103,28],
      [920,2088,32],
      [240,2188,24], [460,2198,28], [640,2182,30], [830,2202,26],
    ];
    for (const [tx, ty, tw] of thornTrees) {
      gfx.fillTriangle(tx, ty + tw, tx + tw * 0.6, ty - tw * 0.3, tx + tw * 1.3, ty + tw * 0.6);
      gfx.fillStyle(0x081408, 1);
      gfx.fillTriangle(tx + 4, ty + tw * 0.8, tx + tw * 0.65, ty - tw * 0.5, tx + tw * 1.1, ty + tw * 0.8);
      gfx.fillStyle(0x0a1c08, 1);
    }

    // Wisp glow dots
    gfx.fillStyle(0x3a7878, 0.30);
    for (const [wx, wy] of [
      [310,1620],[520,1640],[730,1615],[940,1635],
      [252,1730],[468,1750],[668,1720],[868,1745],
      [334,1858],[568,1878],[802,1848],[1020,1870],
      [296,1978],[500,1998],[714,1972],[938,1994],
      [272,2098],[490,2118],[720,2088],[950,2110],
    ]) {
      gfx.fillCircle(wx, wy, 12);
    }
    gfx.fillStyle(0x5ababa, 0.15);
    for (const [wx, wy] of [
      [310,1620],[520,1640],[730,1615],
      [252,1730],[468,1750],
      [334,1858],[568,1878],
      [296,1978],[500,1998],
    ]) {
      gfx.fillCircle(wx, wy, 28);
    }

    // Zone label
    this.add.text(640, 1454, 'Thornwood', {
      fontFamily: FONTS.ui,
      fontSize: '18px',
      color: '#6ab87a',
      fontStyle: 'bold',
      stroke: '#0a1408',
      strokeThickness: 3,
    }).setOrigin(0.5, 1);
  }

  private isTriggerConsumed(trigger: WorldTrigger): boolean {
    const sb = trigger.scriptedBattle;
    return !!(sb?.consumedByFlag && getStoryFlag(sb.consumedByFlag));
  }

  private drawTriggerMarkers(): void {
    for (const trigger of CFG.triggers) {
      if (this.isTriggerConsumed(trigger)) continue;

      const gfx = this.add.graphics();

      const isTownEntry = trigger.targetSceneKey === SCENE_KEYS.TOWN;
      const color       = isTownEntry ? COLORS.goldAccent : COLORS.dangerCrimson;
      const labelColor  = isTownEntry ? COLOR_HEX.goldAccent : '#D97A7A';

      gfx.fillStyle(color, 0.18);
      gfx.fillRoundedRect(trigger.x, trigger.y, trigger.width, trigger.height, 4);
      gfx.lineStyle(2, color, 0.55);
      gfx.strokeRoundedRect(trigger.x, trigger.y, trigger.width, trigger.height, 4);

      this.add.text(
        trigger.x + trigger.width / 2,
        trigger.y - 8,
        `▲ ${trigger.label}`,
        {
          fontFamily: FONTS.ui,
          fontSize: '13px',
          color: labelColor,
          stroke: '#0a0f1a',
          strokeThickness: 2,
        },
      ).setOrigin(0.5, 1);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Player
  // ─────────────────────────────────────────────────────────────────────────

  private createPlayer(): void {
    this.player = this.add.graphics();
    this.player.setPosition(this.px, this.py).setDepth(10);
    this.drawPlayerGfx();
  }

  private drawPlayerGfx(): void {
    const g = this.player;
    g.clear();

    g.fillStyle(0x8a6a10, 0.5);
    g.fillEllipse(PLAYER_W / 2 + 2, PLAYER_H - 4, PLAYER_W - 4, 10);

    g.fillStyle(0xe8d25f, 1);
    g.fillRect(4, 8, PLAYER_W - 8, PLAYER_H - 12);

    g.fillStyle(0xb87820, 1);
    g.fillRect(0, 10, 6, PLAYER_H - 18);
    g.fillRect(PLAYER_W - 6, 10, 6, PLAYER_H - 18);

    g.fillStyle(0xf0d080, 1);
    g.fillRect(6, 0, PLAYER_W - 12, 12);

    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(PLAYER_W - 10, 3, 3, 3);

    g.fillStyle(0xc0c8e0, 1);
    g.fillRect(PLAYER_W - 2, 6, 3, PLAYER_H - 12);

    g.fillStyle(0xe8d25f, 0.9);
    g.fillRect(PLAYER_W, 6, 2, 4);
    g.fillRect(PLAYER_W - 1, 10, 4, 2);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HUD
  // ─────────────────────────────────────────────────────────────────────────

  private createHUD(): void {
    this.createZonePanel();
    this.createDangerBadge();
    this.createHintPanel();
  }

  private createZonePanel(): void {
    const W = 220; const H = 38;
    const X = 16;  const Y = 16;

    this.hudZonePanel = drawPanel(this, { x: X, y: Y, width: W, height: H });
    this.hudZonePanel.setScrollFactor(0).setDepth(100);

    this.hudZoneText = this.add.text(X + 14, Y + H / 2, 'Border Fields', {
      fontFamily: FONTS.ui,
      fontSize: `${FONT_SIZES.locationLabel}px`,
      color: COLOR_HEX.parchment,
      fontStyle: 'bold',
    })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(101);
  }

  private createDangerBadge(): void {
    const W = 190; const H = 34;
    const X = GAME_WIDTH / 2 - W / 2;
    const Y = 16;

    const bg = this.add.graphics();
    bg.fillStyle(COLORS.dangerCrimson, 0.88);
    bg.fillRoundedRect(X, Y, W, H, PANEL.cornerRadius);
    bg.lineStyle(2, 0xff6060, 1);
    bg.strokeRoundedRect(X, Y, W, H, PANEL.cornerRadius);
    bg.setScrollFactor(0).setDepth(100);

    const text = this.add.text(GAME_WIDTH / 2, Y + H / 2, '⚠  DANGER AREA', {
      fontFamily: FONTS.ui,
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#F3EBD2',
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101);

    this.hudDangerBadge = this.add.container(0, 0, [bg, text]);
    this.hudDangerBadge.setScrollFactor(0).setDepth(100).setVisible(false);
  }

  private createHintPanel(): void {
    const W = 320; const H = 38;
    const X = GAME_WIDTH / 2 - W / 2;
    const Y = GAME_HEIGHT - 58;

    this.hudHintPanel = drawPanel(this, { x: X, y: Y, width: W, height: H });
    this.hudHintPanel.setScrollFactor(0).setDepth(100).setVisible(false);

    this.hudHintText = this.add.text(GAME_WIDTH / 2, Y + H / 2, '', {
      fontFamily: FONTS.ui,
      fontSize: `${FONT_SIZES.hint}px`,
      color: COLOR_HEX.parchment,
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Input
  // ─────────────────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyWASD = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.keyMenu = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);
  }

  private openMenu(): void {
    this.menuActive = true;
    if (this.scene.isActive(SCENE_KEYS.GAME_MENU)) {
      this.scene.stop(SCENE_KEYS.GAME_MENU);
    }
    this.scene.get(SCENE_KEYS.GAME_MENU).events.once('close', () => {
      this.menuActive   = false;
      this.menuCooldown = true;
    });
    // The world map is never a valid save location.
    this.scene.launch(SCENE_KEYS.GAME_MENU, { canSave: false });
    this.scene.bringToTop(SCENE_KEYS.GAME_MENU);
  }

  private readInput(): MovementInput {
    return {
      up:    this.cursors.up.isDown    || this.keyWASD.W.isDown,
      down:  this.cursors.down.isDown  || this.keyWASD.S.isDown,
      left:  this.cursors.left.isDown  || this.keyWASD.A.isDown,
      right: this.cursors.right.isDown || this.keyWASD.D.isDown,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HUD per-frame updates
  // ─────────────────────────────────────────────────────────────────────────

  private updateHUD(): void {
    const zoneName    = this.activeZone?.displayName ?? 'Border Fields';
    const isEncounter = this.activeZone?.type === 'encounter';
    this.hudZoneText.setText(zoneName);
    this.hudZoneText.setColor(isEncounter ? COLOR_HEX.villainName : COLOR_HEX.parchment);

    this.hudDangerBadge.setVisible(isEncounter);

    const hasTrigger = this.activeTrigger !== null;
    this.hudHintPanel.setVisible(hasTrigger);
    this.hudHintText.setVisible(hasTrigger);
    if (hasTrigger) {
      this.hudHintText.setText(`[SPACE]  ${this.activeTrigger!.label}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Random encounter launch
  // ─────────────────────────────────────────────────────────────────────────

  private launchRandomEncounter(enemyIds: string[], _backgroundId: string): void {
    this.transitionPending = true;

    const battleData: BattleInitData = {
      enemyIds,
      returnSceneKey:     SCENE_KEYS.WORLD_MAP,
      backgroundColorHex: '#1a1428',
      returnX:            Math.round(this.px),
      returnY:            Math.round(this.py),
    };

    this.cameras.main.flash(180, 255, 255, 255, true);
    this.time.delayedCall(180, () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(SCENE_KEYS.BATTLE, battleData);
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Trigger activation
  // ─────────────────────────────────────────────────────────────────────────

  private activateTrigger(trigger: WorldTrigger): void {
    if (trigger.scriptedBattle) {
      const sb = trigger.scriptedBattle;

      if (sb.requiresFlag && !getStoryFlag(sb.requiresFlag)) return;
      if (sb.consumedByFlag && getStoryFlag(sb.consumedByFlag)) return;

      this.transitionPending = true;
      setCurrentLocation({
        locationId: trigger.targetLocationId,
        x: Math.round(this.px + PLAYER_W / 2),
        y: Math.round(this.py + PLAYER_H / 2),
      });

      const battleData: BattleInitData = {
        enemyIds:           sb.enemyIds,
        returnSceneKey:     SCENE_KEYS.WORLD_MAP,
        backgroundColorHex: sb.backgroundColorHex,
        returnX:            Math.round(this.px),
        returnY:            Math.round(this.py),
        introDialogueId:    sb.introDialogueId,
        outroDialogueId:    sb.outroDialogueId,
        isBoss:             sb.isBoss,
      };

      this.cameras.main.fadeOut(350, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(SCENE_KEYS.BATTLE, battleData);
      });
      return;
    }

    this.transitionPending = true;
    setCurrentLocation({
      locationId: trigger.targetLocationId,
      x: Math.round(this.px + PLAYER_W / 2),
      y: Math.round(this.py + PLAYER_H / 2),
    });

    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(trigger.targetSceneKey, {
        locationId: trigger.targetLocationId,
      } satisfies import('../../town/types/town-types').TownInitData);
    });
  }
}
