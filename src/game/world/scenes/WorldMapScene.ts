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
  private previousZoneId: string | null = null;   // used to detect zone transitions
  private transitionPending = false;
  private menuActive        = false;
  // Prevents the M press that closed the menu from immediately reopening it.
  // Cleared once M is physically released.
  private menuCooldown      = false;
  private encounterTracker = new EncounterTracker(6); // 6 safe steps after battle

  // ─────────────────────────────────────────────────────────────────────────

  constructor() {
    super({ key: SCENE_KEYS.WORLD_MAP });
  }

  // ─── init ─────────────────────────────────────────────────────────────────
  // Receives optional return position when transitioning back from another scene.

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
    // Clear stale query results so no trigger/zone carries over from a previous run.
    this.activeTrigger  = null;
    this.activeZone     = null;
    this.previousZoneId = null;
    // Grant safe steps when returning from a battle so we don't immediately re-trigger.
    this.encounterTracker.onBattleFired();
  }

  // ─── create ───────────────────────────────────────────────────────────────

  create(): void {
    this.cameras.main.setBackgroundColor('#1e3a20');
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.fadeIn(350, 0, 0, 0);

    this.drawWorld();
    this.createPlayer();
    this.createHUD();
    this.setupInput();

    // Smooth camera follow — lerp factor keeps movement comfortable
    this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
    // Adjust follow offset so camera centres on the player rect body
    this.cameras.main.setFollowOffset(-PLAYER_W / 2, -PLAYER_H / 2);
  }

  // ─── update ───────────────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    if (this.transitionPending) return;
    if (this.menuActive) return;

    // Clear M-key cooldown once the key is physically released
    if (this.menuCooldown && !this.keyMenu.isDown) {
      this.menuCooldown = false;
    }

    // Open in-game menu
    if (!this.menuCooldown && Phaser.Input.Keyboard.JustDown(this.keyMenu)) {
      this.openMenu();
      return;
    }

    // 1. Read input
    const input = this.readInput();

    // 2. Capture position before movement so we can compute distance traveled
    const prevX = this.px;
    const prevY = this.py;

    // 3. Compute movement (pure system — no Phaser inside)
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

    // 4. Sync Phaser player object to new position
    this.player.setPosition(this.px, this.py);

    // 4b. Keep currentLocation in sync so saves (menu / save crystal later) resume
    //     at the player's current world-map position. Only on actual movement so
    //     we don't churn patchState every frame. Stored as CENTER per convention.
    //     Trigger activation below overrides this with its own locationId; its
    //     transitionPending flag stops further update() calls from clobbering it.
    if (result.moving && (result.x !== prevX || result.y !== prevY)) {
      setCurrentLocation({
        locationId: 'border_fields',
        x: Math.round(this.px + PLAYER_W / 2),
        y: Math.round(this.py + PLAYER_H / 2),
      });
    }

    // 5. Query systems
    // Consumed triggers are filtered out here so the HUD hint never advertises
    // a completed event. The activate path also silently no-ops on consumed
    // triggers, but filtering up front is what prevents the stale "Investigate
    // Clearing" / "Enter North Pass" text from appearing.
    this.activeTrigger = getActiveTrigger(
      this.px, this.py, PLAYER_W, PLAYER_H,
      CFG.triggers.filter(t => !this.isTriggerConsumed(t)),
    );
    this.activeZone    = getActiveZone(this.px, this.py, PLAYER_W, PLAYER_H, CFG.zones);

    // 6. Detect zone transitions and reset encounter tracker when zone changes.
    //    Resetting on zone-id change (not just encounter→safe) guarantees the
    //    step counter always starts clean in every zone, even when two encounter
    //    zones are adjacent with no safe zone between them.
    const currentZoneId = this.activeZone?.id ?? null;
    if (currentZoneId !== this.previousZoneId) {
      this.encounterTracker.resetSteps();
      this.previousZoneId = currentZoneId;
    }

    // 7. Random encounter check — only when player actually moved in an encounter zone
    if (result.moving && this.activeZone?.type === 'encounter') {
      const table = ENCOUNTER_TABLES[this.activeZone.id];
      if (table) {
        // Compute actual pixels traveled this frame for distance-based step tracking
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

    // 8. Update HUD
    this.updateHUD();

    // 9. Handle trigger input
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
    this.drawNorthPassArea();
    this.drawThornwoodArea();
    this.drawTriggerMarkers();
  }

  private drawSkyAndGround(): void {
    const gfx = this.add.graphics();

    // Sky gradient — layered horizontal bands
    gfx.fillStyle(0x0d1f3c, 1); gfx.fillRect(0,   0,   MAP_W, 260);
    gfx.fillStyle(0x163354, 1); gfx.fillRect(0,   120, MAP_W, 180);
    gfx.fillStyle(0x1e4a30, 1); gfx.fillRect(0,   260, MAP_W, 80);
    // Ground grass
    gfx.fillStyle(0x2d6b35, 1); gfx.fillRect(0,   310, MAP_W, MAP_H - 310);
    // Subtle lighter midground
    gfx.fillStyle(0x366e3e, 0.3); gfx.fillRect(110, 380, 1700, 680);

    // Stars
    gfx.fillStyle(0xffffff, 0.55);
    const stars = [
      [80,40],[200,25],[360,55],[520,30],[700,65],
      [880,38],[1060,70],[1240,28],[1400,55],[1580,42],
      [1760,68],[1880,30],[140,110],[420,95],[660,130],
      [820,88],[1020,115],[1300,100],[1500,80],[1700,120],
    ];
    for (const [sx, sy] of stars) gfx.fillRect(sx, sy, 2, 2);
  }

  private drawEncounterZoneOverlay(): void {
    const gfx = this.add.graphics();
    for (const zone of CFG.zones) {
      if (zone.type !== 'encounter') continue;
      // Each encounter zone gets a distinct atmospheric tint.
      if (zone.id === 'north_pass_zone') {
        // Dark purple — cold mountain menace
        gfx.fillStyle(0x000000, 0.28);
        gfx.fillRect(zone.x, zone.y, zone.width, zone.height);
        gfx.fillStyle(0x1a0a2a, 0.22);
        gfx.fillRect(zone.x, zone.y + zone.height - 70, zone.width, 70);
      } else if (zone.id === 'thornwood_zone') {
        // Dark sickly green — corruption tint
        gfx.fillStyle(0x001a00, 0.32);
        gfx.fillRect(zone.x, zone.y, zone.width, zone.height);
        gfx.fillStyle(0x0a1a0a, 0.20);
        gfx.fillRect(zone.x, zone.y, zone.width, 60);   // fade in at top
      } else if (zone.id === 'ashenveil_road_zone') {
        // Slight dusty amber — contested road, less dramatic than the others
        gfx.fillStyle(0x1a0e00, 0.18);
        gfx.fillRect(zone.x, zone.y, zone.width, zone.height);
      }
    }
  }

  private drawRoads(): void {
    const gfx = this.add.graphics();

    // Main horizontal road
    gfx.fillStyle(0x8b7340, 1);
    gfx.fillRect(110, 510, 1700, 72);
    // Edge shadows
    gfx.fillStyle(0x6b5828, 0.6);
    gfx.fillRect(110, 510, 1700, 6);
    gfx.fillRect(110, 576, 1700, 6);

    // North-bound path
    gfx.fillStyle(0x7a6535, 1);
    gfx.fillRect(920, 80, 60, 440);
    // Path edge shadow
    gfx.fillStyle(0x6b5828, 0.4);
    gfx.fillRect(920, 80, 4, 440);
    gfx.fillRect(976, 80, 4, 440);

    // Tread marks
    gfx.fillStyle(0x6b5828, 0.4);
    for (let rx = 200; rx < 1750; rx += 80) {
      gfx.fillRect(rx, 530, 30, 4);
    }
    for (let ry = 130; ry < 510; ry += 60) {
      gfx.fillRect(938, ry, 24, 4);
    }
  }

  private drawForestEdges(): void {
    const gfx = this.add.graphics();

    // Left forest wall fill
    gfx.fillStyle(0x1a4a20, 1);
    gfx.fillRect(0, 0, 110, MAP_H);

    // Right forest wall fill
    gfx.fillStyle(0x1a4a20, 1);
    gfx.fillRect(1810, 0, 110, MAP_H);

    // Tree silhouettes along edges
    gfx.fillStyle(0x1e5c24, 1);
    for (let ty = 60; ty < MAP_H - 60; ty += 52) {
      // Left side trees
      const lx = 8 + Math.abs(Math.sin(ty * 0.08)) * 20;
      gfx.fillTriangle(lx, ty + 38, lx + 20, ty, lx + 40, ty + 38);
      gfx.fillStyle(0x164d1a, 1);
      gfx.fillTriangle(lx + 4, ty + 30, lx + 20, ty - 10, lx + 36, ty + 30);
      gfx.fillStyle(0x1e5c24, 1);

      // Right side trees
      const rx = 1820 + Math.abs(Math.sin(ty * 0.09)) * 16;
      gfx.fillTriangle(rx, ty + 38, rx + 20, ty, rx + 40, ty + 38);
      gfx.fillStyle(0x164d1a, 1);
      gfx.fillTriangle(rx + 4, ty + 30, rx + 20, ty - 10, rx + 36, ty + 30);
      gfx.fillStyle(0x1e5c24, 1);
    }
  }

  private drawMountainRange(): void {
    const gfx = this.add.graphics();

    // Mountain blocks (match collision rects)
    gfx.fillStyle(0x142a18, 1);
    gfx.fillRect(0,    0, 780, 200);
    gfx.fillRect(1140, 0, 780, 200);

    // Peak silhouettes
    gfx.fillStyle(0x0f2010, 1);
    const peaks = [
      [60,200, 200,60, 340,200],
      [280,200, 440,40, 600,200],
      [520,200, 680,80, 840,200],
      [1080,200, 1240,50, 1400,200],
      [1320,200, 1480,70, 1640,200],
      [1560,200, 1720,40, 1880,200],
    ];
    for (const [x1,y1,x2,y2,x3,y3] of peaks) {
      gfx.fillTriangle(x1, y1, x2, y2, x3, y3);
    }

    // Snow caps
    gfx.fillStyle(0xc8d8c0, 0.6);
    gfx.fillTriangle(200,60, 240,90, 160,90);
    gfx.fillTriangle(440,40, 490,76, 390,76);
    gfx.fillTriangle(1240,50, 1296,82, 1185,82);
    gfx.fillTriangle(1480,70, 1532,100, 1428,100);

    // Foot trees (decorative)
    gfx.fillStyle(0x1a4820, 1);
    for (const [tx, ty] of [[130,195],[200,205],[330,198],[460,202],[590,196],
                             [1200,200],[1345,204],[1480,197],[1625,201],[1762,198]]) {
      gfx.fillTriangle(tx, ty + 28, tx + 16, ty, tx + 32, ty + 28);
    }
  }

  private drawTownArea(): void {
    const gfx = this.add.graphics();

    // Town ground
    gfx.fillStyle(0x7a6040, 0.5);
    gfx.fillRect(1340, 340, 420, 320);

    // Stone plaza
    gfx.fillStyle(0x9a8c76, 1);
    gfx.fillRect(1380, 490, 340, 50);

    // Inn (ochre)
    gfx.fillStyle(0xb8722a, 1);
    gfx.fillRect(1360, 370, 100, 90);
    gfx.fillStyle(0x7a3a14, 1);
    gfx.fillTriangle(1345,370, 1410,320, 1475,370);

    // Shop (blue-grey)
    gfx.fillStyle(0x5a7490, 1);
    gfx.fillRect(1490, 385, 88, 80);
    gfx.fillStyle(0x3a5070, 1);
    gfx.fillTriangle(1480,385, 1534,340, 1588,385);

    // Guard house
    gfx.fillStyle(0x6a6a5a, 1);
    gfx.fillRect(1420, 445, 70, 55);
    gfx.fillStyle(0x4a4a3a, 1);
    gfx.fillTriangle(1412,445, 1455,415, 1498,445);

    // Gate posts
    gfx.fillStyle(0x8a7860, 1);
    gfx.fillRect(1442, 510, 18, 32);
    gfx.fillRect(1498, 510, 18, 32);
    gfx.fillRect(1440, 506, 80, 10);

    // Windows
    gfx.fillStyle(0xffe0a0, 0.8);
    gfx.fillRect(1375, 390, 16, 14);
    gfx.fillRect(1420, 390, 16, 14);
    gfx.fillRect(1505, 400, 14, 12);

    // Town name label
    this.add.text(1535, 312, 'Lumen Town', {
      fontFamily: FONTS.ui,
      fontSize: '18px',
      color: COLOR_HEX.goldAccent,
      fontStyle: 'bold',
      stroke: '#0a0f1a',
      strokeThickness: 3,
    }).setOrigin(0.5, 1);
  }

  private drawNorthPassArea(): void {
    const gfx = this.add.graphics();
    const cx = 960;
    const topY = 60;

    // Stone pillars
    gfx.fillStyle(0x5a5a60, 1);
    gfx.fillRect(cx - 80, topY + 20, 28, 120);
    gfx.fillRect(cx + 52, topY + 20, 28, 120);

    // Lintel
    gfx.fillStyle(0x484850, 1);
    gfx.fillRect(cx - 90, topY + 12, 180, 22);

    // Cracks
    gfx.lineStyle(1, 0x2a2a30, 0.8);
    gfx.beginPath();
    gfx.moveTo(cx - 72, topY + 30); gfx.lineTo(cx - 60, topY + 70);
    gfx.moveTo(cx + 60, topY + 40); gfx.lineTo(cx + 72, topY + 80);
    gfx.strokePath();

    // Danger marks
    gfx.fillStyle(0x8a2020, 0.7);
    gfx.fillRect(cx - 10, topY + 20, 20, 4);
    gfx.fillRect(cx - 10, topY + 30, 20, 4);

    // Fog wisps
    gfx.fillStyle(0x1a0a2a, 0.30);
    gfx.fillEllipse(cx, topY + 50, 140, 40);
    gfx.fillStyle(0x1a0a2a, 0.15);
    gfx.fillEllipse(cx + 30, topY + 80, 100, 30);

    // Label
    this.add.text(cx, topY - 6, 'North Pass', {
      fontFamily: FONTS.ui,
      fontSize: '17px',
      color: '#D97A7A',
      fontStyle: 'bold',
      stroke: '#0a0f1a',
      strokeThickness: 3,
    }).setOrigin(0.5, 1);
  }

  private drawThornwoodArea(): void {
    const gfx = this.add.graphics();
    // The Thornwood zone (x:110–590, y:680–1010) sits below the main road.
    // Corrupted ground: darker, sickly colour vs the healthy midground.
    gfx.fillStyle(0x1a3014, 1);
    gfx.fillRect(110, 680, 480, 330);
    // Undergrowth texture — layered dark patches
    gfx.fillStyle(0x142810, 1);
    gfx.fillRect(110, 700, 480, 80);
    gfx.fillStyle(0x0e1e0c, 0.6);
    gfx.fillRect(140, 820, 400, 60);

    // Corrupted tree silhouettes — irregular, hunched shapes
    gfx.fillStyle(0x0a1c08, 1);
    const thornTrees: [number, number, number][] = [
      [120, 760, 22],  [180, 730, 26], [250, 750, 20], [320, 720, 28],
      [390, 745, 24],  [455, 710, 30], [520, 755, 22], [150, 840, 20],
      [240, 860, 26],  [350, 830, 22], [450, 850, 28], [540, 820, 20],
      [130, 920, 24],  [220, 940, 20], [310, 910, 26], [410, 930, 22],
    ];
    for (const [tx, ty, tw] of thornTrees) {
      // Hunched irregular canopy (not clean triangles like the healthy forest)
      gfx.fillTriangle(tx, ty + tw, tx + tw * 0.6, ty - tw * 0.3, tx + tw * 1.3, ty + tw * 0.6);
      gfx.fillStyle(0x081408, 1);
      gfx.fillTriangle(tx + 4, ty + tw * 0.8, tx + tw * 0.65, ty - tw * 0.5, tx + tw * 1.1, ty + tw * 0.8);
      gfx.fillStyle(0x0a1c08, 1);
    }

    // Wisp glow dots — corruption markers
    gfx.fillStyle(0x3a7878, 0.30);
    for (const [wx, wy] of [[200, 790], [360, 810], [480, 770], [160, 900], [440, 890]]) {
      gfx.fillCircle(wx, wy, 8);
    }
    gfx.fillStyle(0x5ababa, 0.15);
    for (const [wx, wy] of [[200, 790], [360, 810], [480, 770]]) {
      gfx.fillCircle(wx, wy, 18);
    }

    // Zone label
    this.add.text(310, 674, 'Thornwood', {
      fontFamily: FONTS.ui,
      fontSize: '15px',
      color: '#6ab87a',
      fontStyle: 'bold',
      stroke: '#0a1408',
      strokeThickness: 3,
    }).setOrigin(0.5, 1);
  }

  /**
   * True if the trigger's scripted battle has already been won (its
   * consumedByFlag is set in story flags). Used to hide both the marker and
   * the HUD hint for completed events.
   */
  private isTriggerConsumed(trigger: WorldTrigger): boolean {
    const sb = trigger.scriptedBattle;
    return !!(sb?.consumedByFlag && getStoryFlag(sb.consumedByFlag));
  }

  private drawTriggerMarkers(): void {
    for (const trigger of CFG.triggers) {
      // Skip consumed triggers — their event is over and the marker is misleading.
      if (this.isTriggerConsumed(trigger)) continue;

      const gfx = this.add.graphics();

      // Derive color from what the trigger does, not from its specific ID.
      // Town entrances → gold. Battle/boss triggers → danger crimson.
      const isTownEntry = trigger.targetSceneKey === SCENE_KEYS.TOWN;
      const color       = isTownEntry ? COLORS.goldAccent : COLORS.dangerCrimson;
      const labelColor  = isTownEntry ? COLOR_HEX.goldAccent : '#D97A7A';

      // Fill
      gfx.fillStyle(color, 0.18);
      gfx.fillRoundedRect(trigger.x, trigger.y, trigger.width, trigger.height, 4);
      // Border
      gfx.lineStyle(2, color, 0.55);
      gfx.strokeRoundedRect(trigger.x, trigger.y, trigger.width, trigger.height, 4);

      // Label above trigger (world-space, always visible)
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

    // Cape shadow
    g.fillStyle(0x8a6a10, 0.5);
    g.fillEllipse(PLAYER_W / 2 + 2, PLAYER_H - 4, PLAYER_W - 4, 10);

    // Body
    g.fillStyle(0xe8d25f, 1);
    g.fillRect(4, 8, PLAYER_W - 8, PLAYER_H - 12);

    // Cape wings
    g.fillStyle(0xb87820, 1);
    g.fillRect(0, 10, 6, PLAYER_H - 18);
    g.fillRect(PLAYER_W - 6, 10, 6, PLAYER_H - 18);

    // Head
    g.fillStyle(0xf0d080, 1);
    g.fillRect(6, 0, PLAYER_W - 12, 12);

    // Eye
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(PLAYER_W - 10, 3, 3, 3);

    // Sword
    g.fillStyle(0xc0c8e0, 1);
    g.fillRect(PLAYER_W - 2, 6, 3, PLAYER_H - 12);

    // Lightning sparkle
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
      this.menuCooldown = true;   // require M release before menu can reopen
    });
    this.scene.launch(SCENE_KEYS.GAME_MENU);
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
    // Zone label
    const zoneName    = this.activeZone?.displayName ?? 'Border Fields';
    const isEncounter = this.activeZone?.type === 'encounter';
    this.hudZoneText.setText(zoneName);
    this.hudZoneText.setColor(isEncounter ? COLOR_HEX.villainName : COLOR_HEX.parchment);

    // Danger badge
    this.hudDangerBadge.setVisible(isEncounter);

    // Interaction hint
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

    // Brief white flash before fade — classic encounter feel
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
    // ── Scripted battle trigger ────────────────────────────────────────────
    // All data comes from trigger.scriptedBattle — WorldMapScene owns no
    // boss-specific knowledge. Guard checks happen BEFORE transitionPending
    // so a blocked trigger does nothing and leaves the scene fully intact.
    if (trigger.scriptedBattle) {
      const sb = trigger.scriptedBattle;

      // requiresFlag: silently do nothing until the flag is set
      if (sb.requiresFlag && !getStoryFlag(sb.requiresFlag)) return;

      // consumedByFlag: silently do nothing once the battle has been won
      if (sb.consumedByFlag && getStoryFlag(sb.consumedByFlag)) return;

      // Guards passed — lock the scene and launch the battle
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

    // ── Standard scene transition trigger (town entrance, etc.) ───────────
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
