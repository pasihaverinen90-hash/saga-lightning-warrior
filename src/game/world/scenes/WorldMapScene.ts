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
    this.cameras.main.setBackgroundColor('#3a8228');
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
  // World background drawing — top-down overhead, Suikoden 2 aesthetic.
  // Draw order matters: each layer paints over the previous.
  // ─────────────────────────────────────────────────────────────────────────

  private drawWorld(): void {
    this.drawSkyAndGround();         // base terrain grass
    this.drawMountainRange();        // overhead rocky range (top border)
    this.drawForestEdges();          // overhead canopy walls (side borders)
    this.drawThornwoodArea();        // corrupted SW forest canopy
    this.drawEncounterZoneOverlay(); // subtle encounter-zone tint
    this.drawWaterFeatures();        // decorative river + pond
    this.drawRoads();                // overhead dirt paths
    this.drawTownArea();             // Lumen Town overhead footprints
    this.drawAshenveilArea();        // Ashenveil overhead footprints
    this.drawNorthPassArea();        // stone gate from above
    this.drawTriggerMarkers();
  }

  // ── Base terrain ────────────────────────────────────────────────────────────

  private drawSkyAndGround(): void {
    const gfx = this.add.graphics();

    // Bright overhead daylight grass — the whole visible map
    gfx.fillStyle(0x58a038, 1);
    gfx.fillRect(0, 0, MAP_W, MAP_H);

    // Lighter meadow patches — gentle undulation across the plain
    gfx.fillStyle(0x72be4e, 0.28);
    const meadows: [number, number, number, number][] = [
      [560,  650,  720, 370], [1460, 790,  880, 460], [2080, 570,  800, 420],
      [2900, 1210, 980, 530], [620,  1590, 820, 430], [1580, 1300, 720, 370],
      [3380, 690,  620, 310], [2200, 1690, 760, 400], [840,  1090, 540, 290],
      [2640, 610,  640, 320], [1160, 1810, 600, 300], [3020, 910,  560, 270],
      [1900, 450,  480, 240], [3600, 1400, 500, 260],
    ];
    for (const [ex, ey, ew, eh] of meadows) gfx.fillEllipse(ex, ey, ew, eh);

    // Darker hollows — shaded dips and marshy ground
    gfx.fillStyle(0x3c7422, 0.22);
    const hollows: [number, number, number, number][] = [
      [920,  1190, 620, 320], [2400, 1010, 800, 420], [1820, 1720, 520, 280],
      [3000, 590,  520, 260], [440,  910,  420, 210], [3260, 1420, 600, 300],
      [1300, 630,  460, 230],
    ];
    for (const [ex, ey, ew, eh] of hollows) gfx.fillEllipse(ex, ey, ew, eh);
  }

  // ── Encounter zone tint ─────────────────────────────────────────────────────

  private drawEncounterZoneOverlay(): void {
    const gfx = this.add.graphics();
    for (const zone of CFG.zones) {
      if (zone.type !== 'encounter') continue;
      if (zone.id === 'north_pass_zone') {
        // Pass gap between mountains — add purple-shadow mystery tint
        gfx.fillStyle(0x200a30, 0.22);
        gfx.fillRect(zone.x, zone.y, zone.width, zone.height);
      } else if (zone.id === 'ashenveil_road_zone') {
        // Eastern corridor — slightly drier, dustier grass
        gfx.fillStyle(0x3a2808, 0.13);
        gfx.fillRect(zone.x, zone.y, zone.width, zone.height);
      }
      // thornwood_zone is handled entirely by drawThornwoodArea
    }
  }

  // ── Paths and roads ─────────────────────────────────────────────────────────

  private drawRoads(): void {
    const gfx = this.add.graphics();

    // Grass fringe either side of the main road — worn verge
    gfx.fillStyle(0x3e7828, 0.55);
    gfx.fillRect(180, 1048, 3280, 14);
    gfx.fillRect(180, 1148, 3280, 14);

    // Main horizontal road — sandy packed earth
    gfx.fillStyle(0xc4a866, 1);
    gfx.fillRect(180, 1062, 3280, 86);

    // Road texture — lighter central strip (high-traffic centre)
    gfx.fillStyle(0xd4bc7e, 0.4);
    gfx.fillRect(180, 1082, 3280, 44);

    // Cart-wheel ruts — two parallel lines along the road
    gfx.fillStyle(0xa08840, 0.45);
    for (let rx = 200; rx < 3440; rx += 80) {
      gfx.fillRect(rx, 1072, 30, 4);
      gfx.fillRect(rx, 1128, 30, 4);
    }

    // Road edge stones — small irregular pebble clusters
    gfx.fillStyle(0x9a8860, 0.5);
    for (let rx = 240; rx < 3380; rx += 160) {
      gfx.fillRect(rx,      1058, 10, 5);
      gfx.fillRect(rx + 50, 1148, 8,  5);
    }

    // North path grass fringe
    gfx.fillStyle(0x3e7828, 0.5);
    gfx.fillRect(1882, 380, 10, 682);
    gfx.fillRect(1962, 380, 10, 682);

    // North path — narrow packed dirt
    gfx.fillStyle(0xb89c5a, 1);
    gfx.fillRect(1892, 380, 70, 682);

    // Path central lighter strip
    gfx.fillStyle(0xcab470, 0.4);
    gfx.fillRect(1907, 380, 40, 682);

    // Path footstep marks
    gfx.fillStyle(0x9a7c40, 0.45);
    for (let ry = 410; ry < 1060; ry += 70) {
      gfx.fillRect(1914, ry, 14, 4);
      gfx.fillRect(1934, ry + 32, 14, 4);
    }
  }

  // ── Forest canopy walls ──────────────────────────────────────────────────────

  private drawForestEdges(): void {
    const gfx = this.add.graphics();

    // Forest floor base — dark ground under the canopy
    gfx.fillStyle(0x1c4416, 1);
    gfx.fillRect(0, 0, 180, MAP_H);
    gfx.fillRect(3916, 0, 180, MAP_H);

    // Leaf litter / undergrowth texture
    gfx.fillStyle(0x254e1c, 0.6);
    gfx.fillRect(0, 0, 180, MAP_H);
    gfx.fillRect(3916, 0, 180, MAP_H);

    // Tree canopies — overlapping circles viewed from above
    const drawCanopyStrip = (baseX: number, stripW: number): void => {
      for (let cy = 30; cy < MAP_H - 30; cy += 46) {
        const jitter = Math.abs(Math.sin(cy * 0.11)) * 20;
        const count  = 3;
        for (let ci = 0; ci < count; ci++) {
          const cx = baseX + 12 + ci * (stripW / count) + jitter * (ci % 2 === 0 ? 1 : -1);
          const r  = 22 + Math.abs(Math.sin(cy * 0.07 + ci * 1.7)) * 14;
          // SE shadow
          gfx.fillStyle(0x0c2208, 0.55);
          gfx.fillCircle(cx + 5, cy + 6, r);
          // Main canopy
          gfx.fillStyle(0x2e7020, 1);
          gfx.fillCircle(cx, cy, r);
          // Mid tone ring
          gfx.fillStyle(0x3a8c2a, 1);
          gfx.fillCircle(cx - 2, cy - 2, r * 0.72);
          // Sunlit NW highlight
          gfx.fillStyle(0x52a83a, 0.45);
          gfx.fillCircle(cx - 5, cy - 5, r * 0.44);
        }
      }
    };

    drawCanopyStrip(0, 180);
    drawCanopyStrip(3916, 180);
  }

  // ── Mountain range (top border) ─────────────────────────────────────────────

  private drawMountainRange(): void {
    const gfx = this.add.graphics();

    // Rocky base — both mountain blocks, viewed from above
    gfx.fillStyle(0x7a6c58, 1);
    gfx.fillRect(0,    0, 1600, 380);
    gfx.fillRect(2260, 0, 1836, 380);

    // Deeper shadow at the foot of each range (south edge)
    gfx.fillStyle(0x4e4030, 0.65);
    gfx.fillRect(0,    300, 1600, 80);
    gfx.fillRect(2260, 300, 1836, 80);

    // Individual peak / boulder shapes — sunlit tops (NW-lit)
    gfx.fillStyle(0x9a8c78, 1);
    const leftPeaks: [number, number, number, number][] = [
      [100,  50,  210, 130], [340,  30,  230, 140], [580,  60,  210, 125],
      [820,  40,  220, 135], [1060, 55,  205, 130], [1300, 35,  215, 140],
      [1480, 65,  185, 115],
      [180,  210, 190, 105], [420,  200, 200, 110], [660,  215, 185, 100],
      [900,  200, 200, 110], [1140, 210, 185, 100], [1360, 200, 195, 108],
    ];
    for (const [ex, ey, ew, eh] of leftPeaks) gfx.fillEllipse(ex, ey, ew, eh);

    gfx.fillStyle(0x9a8c78, 1);
    const rightPeaks: [number, number, number, number][] = [
      [2380, 40,  215, 135], [2620, 55,  225, 140], [2870, 40,  210, 130],
      [3110, 55,  220, 135], [3350, 40,  215, 140], [3590, 55,  210, 130],
      [3820, 60,  200, 125], [4010, 50,  180, 115],
      [2460, 205, 195, 108], [2700, 195, 205, 112], [2940, 205, 195, 106],
      [3180, 200, 205, 110], [3420, 210, 195, 105], [3660, 195, 205, 110],
      [3900, 205, 185, 100],
    ];
    for (const [ex, ey, ew, eh] of rightPeaks) gfx.fillEllipse(ex, ey, ew, eh);

    // SE shadow on each peak — gives overhead depth
    gfx.fillStyle(0x4e4030, 0.40);
    for (const [ex, ey, ew, eh] of [...leftPeaks, ...rightPeaks]) {
      gfx.fillEllipse(ex + ew * 0.18, ey + eh * 0.18, ew * 0.65, eh * 0.60);
    }

    // NW sunlit highlight on each peak
    gfx.fillStyle(0xbcb09a, 0.50);
    for (const [ex, ey, ew, eh] of [...leftPeaks, ...rightPeaks]) {
      gfx.fillEllipse(ex - ew * 0.14, ey - eh * 0.14, ew * 0.48, eh * 0.44);
    }

    // Snow caps on tallest peaks
    gfx.fillStyle(0xeeeef8, 0.88);
    for (const [ex, ey, ew, eh] of [
      [340,  30,  150,  80], [820,  40,  155,  82], [1300, 35,  150,  80],
      [2620, 55,  155,  82], [3110, 55,  150,  80], [3590, 55,  152,  80],
    ]) {
      gfx.fillEllipse(ex, ey, ew, eh);
    }
    // Snow shadow
    gfx.fillStyle(0xc8cce0, 0.45);
    for (const [ex, ey, ew, eh] of [
      [340,  30,  150,  80], [820,  40,  155,  82], [1300, 35,  150,  80],
      [2620, 55,  155,  82], [3110, 55,  150,  80], [3590, 55,  152,  80],
    ]) {
      gfx.fillEllipse(ex + ew * 0.15, ey + eh * 0.15, ew * 0.55, eh * 0.50);
    }

    // Treeline fringe at the mountain base — canopy crowns transitioning to grass
    const treeBaseY = 368;
    for (const tx of [
      130, 220, 360, 500, 640, 780, 920, 1060, 1200, 1380, 1520,
      2300, 2440, 2600, 2760, 2920, 3060, 3200, 3360, 3520, 3680, 3840, 3980,
    ]) {
      const r = 16 + Math.abs(Math.sin(tx * 0.09)) * 9;
      gfx.fillStyle(0x0e2a0c, 0.45);
      gfx.fillCircle(tx + 4, treeBaseY + 5, r);
      gfx.fillStyle(0x2e6e1e, 1);
      gfx.fillCircle(tx, treeBaseY, r);
      gfx.fillStyle(0x3e8e2a, 0.5);
      gfx.fillCircle(tx - 3, treeBaseY - 4, r * 0.52);
    }
  }

  // ── Thornwood corrupted forest ───────────────────────────────────────────────

  private drawThornwoodArea(): void {
    const gfx = this.add.graphics();
    // Zone: x:180–1100, y:1460–2224

    // Forest floor — dark, corrupted earth
    gfx.fillStyle(0x1a3010, 1);
    gfx.fillRect(180, 1460, 920, 764);

    // Dead ground patches — bare soil and rot
    gfx.fillStyle(0x2e2618, 0.55);
    for (const [ex, ey, ew, eh] of [
      [410, 1710, 310, 165], [730, 1860, 290, 145],
      [560, 2060, 330, 165], [360, 2190, 270, 135],
    ] as [number,number,number,number][]) {
      gfx.fillEllipse(ex, ey, ew, eh);
    }

    // Corrupted tree canopies viewed from above — muted brownish-green
    const positions: [number, number, number][] = [
      [210,1490,26],[290,1510,22],[372,1488,28],[458,1504,24],[548,1490,26],
      [636,1506,22],[726,1492,28],[816,1510,24],[906,1494,26],[988,1512,22],[1066,1492,24],
      [232,1582,24],[318,1564,26],[408,1578,22],[498,1562,28],[590,1580,24],
      [680,1564,26],[770,1582,22],[860,1566,28],[948,1580,24],[1036,1562,26],
      [208,1664,22],[308,1678,26],[408,1662,24],[518,1680,22],[618,1664,28],
      [718,1680,24],[818,1664,26],[918,1682,22],[1008,1670,24],[1086,1662,26],
      [228,1764,26],[338,1780,22],[448,1764,28],[558,1780,24],[668,1764,26],
      [778,1782,22],[888,1766,28],[978,1780,24],
      [208,1864,24],[318,1878,26],[438,1864,22],[558,1882,28],[678,1866,24],
      [798,1884,26],[908,1868,22],[1018,1882,28],
      [218,1964,22],[338,1978,26],[468,1964,24],[598,1982,22],[728,1966,28],
      [848,1982,24],[958,1968,26],
      [228,2064,26],[358,2078,22],[498,2064,28],[638,2082,24],[778,2066,26],
      [908,2084,22],[1028,2072,28],
      [218,2164,24],[368,2178,26],[518,2164,22],[668,2182,28],[828,2166,24],
      [968,2184,26],
    ];

    for (const [tx, ty, tr] of positions) {
      // SE shadow
      gfx.fillStyle(0x0a1208, 0.60);
      gfx.fillCircle(tx + 5, ty + 6, tr);
      // Canopy — muted gnarled green
      gfx.fillStyle(0x2a4418, 1);
      gfx.fillCircle(tx, ty, tr);
      // Dead-patch inner darker ring
      gfx.fillStyle(0x1e2e10, 0.50);
      gfx.fillCircle(tx, ty, tr * 0.55);
      // Faint sickly highlight
      gfx.fillStyle(0x3c5820, 0.30);
      gfx.fillCircle(tx - 4, ty - 4, tr * 0.38);
    }

    // Teal wisp glow dots — will-o'-wisps
    gfx.fillStyle(0x3a8888, 0.25);
    for (const [wx, wy] of [
      [318,1628],[528,1648],[738,1622],[948,1642],
      [260,1738],[476,1758],[678,1728],[878,1752],
      [342,1868],[578,1888],[812,1858],[1028,1878],
      [304,1988],[508,2008],[724,1982],[948,2004],
      [280,2108],[498,2128],[730,2098],[958,2120],
    ]) {
      gfx.fillCircle(wx, wy, 13);
    }
    gfx.fillStyle(0x5ababa, 0.14);
    for (const [wx, wy] of [
      [318,1628],[528,1648],[738,1622],
      [260,1738],[476,1758],
      [342,1868],[578,1888],
      [304,1988],[508,2008],
    ]) {
      gfx.fillCircle(wx, wy, 30);
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

  // ── Decorative water features ────────────────────────────────────────────────

  private drawWaterFeatures(): void {
    const gfx = this.add.graphics();

    // Sandy riverbank / shoreline
    gfx.fillStyle(0xc8b060, 1);
    const shores: [number, number, number, number][] = [
      [1840, 442, 38,  72], [1822, 504, 38,  72], [1806, 564, 38,  70],
      [1786, 622, 38,  68], [1760, 676, 40,  64], [1730, 724, 42,  60],
      [1692, 756, 44,  58], [1648, 774, 46,  54], [1596, 784, 48,  52],
      [1540, 790, 48,  50], [1482, 794, 52,  48],
    ];
    for (const [ex, ey, ew, eh] of shores) gfx.fillEllipse(ex, ey, ew, eh);
    // Pond shore
    gfx.fillEllipse(1390, 806, 214, 144);

    // River water body
    gfx.fillStyle(0x4a82c8, 1);
    const river: [number, number, number, number][] = [
      [1840, 442, 26,  60], [1822, 504, 26,  60], [1806, 564, 26,  58],
      [1786, 622, 26,  56], [1760, 674, 28,  52], [1730, 722, 30,  50],
      [1692, 754, 32,  46], [1648, 772, 34,  42], [1596, 782, 36,  40],
      [1540, 788, 36,  38], [1482, 792, 40,  36],
    ];
    for (const [ex, ey, ew, eh] of river) gfx.fillEllipse(ex, ey, ew, eh);
    // Pond
    gfx.fillEllipse(1390, 806, 172, 118);

    // Water shimmer highlights
    gfx.fillStyle(0x7aaee0, 0.50);
    for (const [ex, ey, ew, eh] of [
      [1840, 438, 13,  24], [1806, 562, 13,  22], [1760, 672, 14,  20],
      [1692, 752, 14,  18], [1596, 780, 16,  16], [1380, 796, 64,  32],
      [1418, 806, 32,  20],
    ] as [number,number,number,number][]) {
      gfx.fillEllipse(ex, ey, ew, eh);
    }

    // Lily pad dots on the pond
    gfx.fillStyle(0x3a7a28, 0.70);
    for (const [lx, ly] of [
      [1358,808],[1395,798],[1420,812],[1372,820],[1408,820],
    ]) {
      gfx.fillCircle(lx, ly, 5);
    }
  }

  // ── Lumen Town — overhead rooftop view ──────────────────────────────────────

  private drawTownArea(): void {
    const gfx = this.add.graphics();
    const cx = 2830; // trigger x:2720 + width:220/2

    // Packed earth ground inside town walls
    gfx.fillStyle(0xc8ac72, 1);
    gfx.fillRect(cx - 290, 578, 580, 506);

    // Town wall — stone perimeter
    gfx.fillStyle(0x9a8c6e, 1);
    gfx.fillRect(cx - 290, 578, 580, 14);   // north wall
    gfx.fillRect(cx - 290, 1070, 580, 14);  // south wall
    gfx.fillRect(cx - 290, 578, 14, 506);   // west wall
    gfx.fillRect(cx + 276, 578, 14, 506);   // east wall

    // Wall crenellations — top of north wall
    gfx.fillStyle(0x7a6c52, 1);
    for (let wx = cx - 280; wx < cx + 270; wx += 28) {
      gfx.fillRect(wx, 570, 14, 14);
    }

    // Gate opening — south wall centre (no wall tile here)
    gfx.fillStyle(0xc8ac72, 1);
    gfx.fillRect(cx - 32, 1070, 64, 14);

    // Stone plaza — central market square
    gfx.fillStyle(0xb09a7e, 1);
    gfx.fillRect(cx - 220, 850, 440, 62);
    // Plaza stone tile lines
    gfx.lineStyle(1, 0x9a8468, 0.4);
    for (let px = cx - 220; px < cx + 220; px += 44) {
      gfx.beginPath(); gfx.moveTo(px, 850); gfx.lineTo(px, 912); gfx.strokePath();
    }
    gfx.beginPath(); gfx.moveTo(cx - 220, 880); gfx.lineTo(cx + 220, 880); gfx.strokePath();

    // Inn (west, ochre roof)
    this.drawRooftop(gfx, cx - 270, 618, 132, 132, 0xb8722a, 0x7a3a14);
    // Shop (east, slate-blue roof)
    this.drawRooftop(gfx, cx + 128, 630, 122, 122, 0x5a7490, 0x3a5070);
    // Guardhouse (centre-north, stone)
    this.drawRooftop(gfx, cx - 54, 750, 108, 82, 0x7a6a58, 0x504840);
    // Manor (north corner, larger deep red roof)
    this.drawRooftop(gfx, cx - 78, 590, 156, 80, 0x983c2e, 0x601e18);

    // Well — stone circle in the plaza
    gfx.fillStyle(0x807060, 1);
    gfx.fillCircle(cx - 66, 924, 14);
    gfx.fillStyle(0x3a2c20, 1);
    gfx.fillCircle(cx - 66, 924, 8);
    gfx.fillStyle(0x6a5c48, 1);
    gfx.fillRect(cx - 70, 918, 8, 2);
    gfx.fillRect(cx - 68, 912, 4, 8);

    // Gate posts (south entrance)
    gfx.fillStyle(0xa09070, 1);
    gfx.fillRect(cx - 36, 1042, 24, 42);
    gfx.fillRect(cx + 12,  1042, 24, 42);

    // Town name label
    this.add.text(cx, 563, 'Lumen Town', {
      fontFamily: FONTS.ui,
      fontSize: '22px',
      color: COLOR_HEX.goldAccent,
      fontStyle: 'bold',
      stroke: '#0a0f1a',
      strokeThickness: 4,
    }).setOrigin(0.5, 1);
  }

  // ── Ashenveil — overhead rooftop view ───────────────────────────────────────

  private drawAshenveilArea(): void {
    const gfx = this.add.graphics();
    const cx = 3570; // trigger x:3460 + width:220/2

    // Packed earth ground
    gfx.fillStyle(0xbe9e62, 1);
    gfx.fillRect(cx - 220, 854, 440, 370);

    // Town wall
    gfx.fillStyle(0x8a7c5e, 1);
    gfx.fillRect(cx - 220, 854, 440, 12);
    gfx.fillRect(cx - 220, 1212, 440, 12);
    gfx.fillRect(cx - 220, 854, 12, 370);
    gfx.fillRect(cx + 208, 854, 12, 370);

    // Crenellations on north wall
    gfx.fillStyle(0x6a5c46, 1);
    for (let wx = cx - 210; wx < cx + 205; wx += 26) {
      gfx.fillRect(wx, 846, 12, 12);
    }

    // Gate opening
    gfx.fillStyle(0xbe9e62, 1);
    gfx.fillRect(cx - 28, 1212, 56, 12);

    // Central plaza
    gfx.fillStyle(0xa48e72, 1);
    gfx.fillRect(cx - 180, 1050, 360, 58);
    gfx.lineStyle(1, 0x8a7460, 0.4);
    for (let px = cx - 180; px < cx + 180; px += 40) {
      gfx.beginPath(); gfx.moveTo(px, 1050); gfx.lineTo(px, 1108); gfx.strokePath();
    }
    gfx.beginPath(); gfx.moveTo(cx - 180, 1078); gfx.lineTo(cx + 180, 1078); gfx.strokePath();

    // Inn (west, ochre)
    this.drawRooftop(gfx, cx - 208, 876, 116, 118, 0xb8722a, 0x7a3a14);
    // Elder's hall (east, blue-grey, larger)
    this.drawRooftop(gfx, cx + 30,  866, 168, 136, 0x5a7490, 0x3a5070);
    // Barracks (north, military green)
    this.drawRooftop(gfx, cx - 70,  862, 88,  68,  0x5a6e44, 0x384428);

    // Well
    gfx.fillStyle(0x706050, 1);
    gfx.fillCircle(cx - 90, 1028, 12);
    gfx.fillStyle(0x342820, 1);
    gfx.fillCircle(cx - 90, 1028, 7);

    // Gate posts
    gfx.fillStyle(0x9a8a68, 1);
    gfx.fillRect(cx - 30, 1184, 22, 38);
    gfx.fillRect(cx +  8, 1184, 22, 38);

    // Town name label
    this.add.text(cx, 838, 'Ashenveil', {
      fontFamily: FONTS.ui,
      fontSize: '20px',
      color: COLOR_HEX.goldAccent,
      fontStyle: 'bold',
      stroke: '#0a0f1a',
      strokeThickness: 4,
    }).setOrigin(0.5, 1);
  }

  // ── Rooftop helper ──────────────────────────────────────────────────────────

  private drawRooftop(
    gfx: Phaser.GameObjects.Graphics,
    x: number, y: number, w: number, h: number,
    roofColor: number, shadowColor: number,
  ): void {
    // Drop shadow (SE offset)
    gfx.fillStyle(shadowColor, 0.55);
    gfx.fillRect(x + 6, y + 6, w, h);
    // Roof body
    gfx.fillStyle(roofColor, 1);
    gfx.fillRect(x, y, w, h);
    // Ridge line highlight (NW face)
    gfx.fillStyle(0xffffff, 0.14);
    gfx.fillRect(x + 4, y + 4, w - 8, 7);
    gfx.fillRect(x + 4, y + 4, 7, h - 8);
    // Shadow edge (SE face)
    gfx.fillStyle(shadowColor, 0.45);
    gfx.fillRect(x, y + h - 8, w, 8);
    gfx.fillRect(x + w - 8, y, 8, h);
  }

  // ── North Pass gate — viewed from above ─────────────────────────────────────

  private drawNorthPassArea(): void {
    const gfx = this.add.graphics();
    const cx   = 1930;
    const topY = 62;

    // Stone foundation — two pillar rectangles from above
    gfx.fillStyle(0x706462, 1);
    gfx.fillRect(cx - 112, topY + 22, 48, 188);
    gfx.fillRect(cx +  64, topY + 22, 48, 188);

    // SE shadow on each pillar
    gfx.fillStyle(0x3a3030, 0.50);
    gfx.fillRect(cx - 64,  topY + 22, 10, 188);
    gfx.fillRect(cx + 112, topY + 22, 10, 188);
    gfx.fillRect(cx - 112, topY + 200, 48, 12);
    gfx.fillRect(cx + 64,  topY + 200, 48, 12);

    // NW highlight on each pillar
    gfx.fillStyle(0xa09898, 0.40);
    gfx.fillRect(cx - 112, topY + 22, 10, 188);
    gfx.fillRect(cx + 64,  topY + 22, 10, 188);

    // Lintel (arch top seen from above)
    gfx.fillStyle(0x5e5252, 1);
    gfx.fillRect(cx - 128, topY + 10, 256, 30);
    gfx.fillStyle(0x3a3030, 0.4);
    gfx.fillRect(cx - 128, topY + 32, 256, 10);

    // Stone joint lines on pillars
    gfx.lineStyle(1, 0x4a4040, 0.55);
    for (let sy = topY + 42; sy < topY + 205; sy += 30) {
      gfx.beginPath();
      gfx.moveTo(cx - 112, sy); gfx.lineTo(cx - 64, sy);
      gfx.moveTo(cx + 64,  sy); gfx.lineTo(cx + 112, sy);
      gfx.strokePath();
    }

    // Danger rune marks on lintel
    gfx.fillStyle(0x8a2020, 0.85);
    gfx.fillRect(cx - 18, topY + 15, 36, 6);
    gfx.fillRect(cx - 18, topY + 27, 36, 6);

    // Purple fog wisps drifting through the gap
    gfx.fillStyle(0x2a1040, 0.28);
    gfx.fillEllipse(cx,      topY + 120, 250, 110);
    gfx.fillStyle(0x1a0830, 0.18);
    gfx.fillEllipse(cx + 50, topY + 170, 190,  80);
    gfx.fillStyle(0x200840, 0.12);
    gfx.fillEllipse(cx - 40, topY + 200, 160,  60);

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

  // ─────────────────────────────────────────────────────────────────────────

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

    // Ground shadow
    g.fillStyle(0x2a5818, 0.38);
    g.fillEllipse(PLAYER_W / 2 + 2, PLAYER_H - 3, PLAYER_W, 10);

    // Cloak / body mass — royal blue, overhead view
    g.fillStyle(0x28388a, 1);
    g.fillEllipse(PLAYER_W / 2, PLAYER_H / 2 + 5, PLAYER_W - 4, PLAYER_H - 8);

    // Cloak inner highlight
    g.fillStyle(0x4058c0, 0.45);
    g.fillEllipse(PLAYER_W / 2 - 2, PLAYER_H / 2 + 2, PLAYER_W / 2, PLAYER_H / 3);

    // Shoulder pauldrons
    g.fillStyle(0x9090a8, 1);
    g.fillRect(2,            14, 6, 5);
    g.fillRect(PLAYER_W - 8, 14, 6, 5);

    // Helmet
    g.fillStyle(0x7a7890, 1);
    g.fillCircle(PLAYER_W / 2, 8, 7);

    // Helmet plume — gold crest
    g.fillStyle(0xe8c830, 1);
    g.fillRect(PLAYER_W / 2 - 2, 0, 4, 9);

    // Sword blade (right side, pointing south)
    g.fillStyle(0xc8ccd8, 1);
    g.fillRect(PLAYER_W - 3, 10, 3, 18);

    // Crossguard
    g.fillStyle(0xa07820, 1);
    g.fillRect(PLAYER_W - 6, 22, 8, 3);
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
