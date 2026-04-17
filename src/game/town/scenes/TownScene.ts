// src/game/town/scenes/TownScene.ts
// Lumen Town: movement, NPC interaction, dialogue, inn, shop, save crystal,
// story events, and world map return transition.
//
// Architecture:
//   Movement        → shared/movement-system.ts  (pure TS, no Phaser)
//   Interaction     → town/systems/interaction-system.ts (pure TS)
//   NPC dialogue    → town/systems/npc-system.ts         (pure TS)
//   Shop logic      → town/systems/shop-service.ts       (pure TS)
//   Dialogue UI     → dialogue/DialogueOverlay.ts        (parallel Phaser scene)
//   Town layout     → data/maps/lumen-town-config.ts
//   Inn/shop/save   → inline modals rendered in this scene

import Phaser from 'phaser';
import { SCENE_KEYS } from '../../core/scene-keys';
import {
  GAME_WIDTH, GAME_HEIGHT,
  COLORS, COLOR_HEX, FONTS, FONT_SIZES, PANEL,
} from '../../core/config';
import { drawPanel } from '../../ui/common/panel';
import { computeMovement, type MovementInput } from '../../shared/movement-system';
import { getNearbyInteractable, isInExitZone } from '../systems/interaction-system';
import { resolveNpcDialogueId } from '../systems/npc-system';
import { LUMEN_TOWN_CONFIG } from '../../data/maps/lumen-town-config';
import { ASHENVEIL_TOWN_CONFIG } from '../../data/maps/ashenveil-town-config';
import { DIALOGUE } from '../../data/dialogue/dialogue-data';
import { LOCATIONS } from '../../data/maps/locations';
import type { TownMapConfig } from '../types/town-types';
import { setCurrentLocation, restorePartyFull } from '../../state/state-actions';
import { getStoryFlags, getGold } from '../../state/state-selectors';
import { saveGame } from '../../save/save-service';
import { runEffects } from '../../dialogue/event-handler';
import { shopItemLabel, shopItemPreview, purchaseItem, purchaseEquipment, isEquipmentId, getInnRestCost } from '../systems/shop-service';
import { PLAYER_W, PLAYER_H } from '../../shared/constants/player';
import type { Interactable, TownInitData } from '../types/town-types';
import type { WorldMapInitData } from '../../world/types/world-types';

// ─── Config registry ──────────────────────────────────────────────────────────
// Maps locationId values (from WorldTrigger.targetLocationId) to their configs.
// Add new towns here — TownScene resolves the right config automatically.
const TOWN_CONFIGS: Record<string, TownMapConfig> = {
  lumen_town:     LUMEN_TOWN_CONFIG,
  ashenveil_town: ASHENVEIL_TOWN_CONFIG,
  // ashenveil_road was an alias used when the entrance trigger recorded 'ashenveil_road'
  // as the locationId. The trigger now uses 'ashenveil_town' directly.
};

/**
 * Returns the TownMapConfig for the given locationId.
 * Defaults to Lumen Town if the id is unknown, so TownScene always has a
 * valid config even if a trigger is misconfigured.
 */
function resolveTownConfig(locationId?: string): TownMapConfig {
  if (locationId !== undefined && Object.prototype.hasOwnProperty.call(TOWN_CONFIGS, locationId)) {
    return TOWN_CONFIGS[locationId];
  }
  return LUMEN_TOWN_CONFIG;
}

// ─── Modal types ──────────────────────────────────────────────────────────────

const PLAYER_SPEED = 180;

type ModalType  = 'none' | 'inn' | 'shop' | 'save';
type ModalPhase = 'select' | 'result';

interface ModalOption {
  label:    string;
  action:   () => void;
  /** Short effect/stat preview shown in the shop detail line while browsing. */
  preview?: string;
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export class TownScene extends Phaser.Scene {
  // ── Active config — set in init() based on incoming locationId ─────────────
  private cfg: TownMapConfig = LUMEN_TOWN_CONFIG;

  // ── Player ─────────────────────────────────────────────────────────────────
  private player!: Phaser.GameObjects.Graphics;
  private px = LUMEN_TOWN_CONFIG.playerEntryX;
  private py = LUMEN_TOWN_CONFIG.playerEntryY;

  // ── Input ──────────────────────────────────────────────────────────────────
  private cursors!:   Phaser.Types.Input.Keyboard.CursorKeys;
  private keyEnter!:  Phaser.Input.Keyboard.Key; // fix: registered once in setupInput, not per-frame
  private keyEsc!:    Phaser.Input.Keyboard.Key;
  private keyWASD!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  // ── HUD ────────────────────────────────────────────────────────────────────
  private hudLocationPanel!: Phaser.GameObjects.Graphics;
  private hudHintPanel!:     Phaser.GameObjects.Graphics;
  private hudHintText!:      Phaser.GameObjects.Text;

  // ── State ──────────────────────────────────────────────────────────────────
  private activeInteractable: Interactable | null = null;
  private dialogueActive    = false;
  private transitionPending = false;

  // ── Modal ──────────────────────────────────────────────────────────────────
  private modalType:         ModalType  = 'none';
  private modalPhase:        ModalPhase = 'select';
  private modalSelectedIdx   = 0;
  private modalOptions:      ModalOption[] = [];
  private modalContainer:    Phaser.GameObjects.Container | null = null;
  private modalOptionBgs:    Phaser.GameObjects.Graphics[] = [];
  private modalOptionTexts:  Phaser.GameObjects.Text[]    = [];
  private modalResultText:   Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: SCENE_KEYS.TOWN });
  }

  // ─── init ─────────────────────────────────────────────────────────────────

  init(data: TownInitData): void {
    // Select the correct town config based on which location triggered the transition.
    this.cfg = resolveTownConfig(data.locationId);

    // Entry position always uses the config default.
    this.px = this.cfg.playerEntryX;
    this.py = this.cfg.playerEntryY;
    this.dialogueActive    = false;
    this.transitionPending = false;
    // Reset all modal state — Phaser destroys game objects on scene restart,
    // so these references would be stale without an explicit null/clear here.
    this.modalType         = 'none';
    this.modalPhase        = 'select';
    this.modalSelectedIdx  = 0;
    this.modalOptions      = [];
    this.modalOptionBgs    = [];
    this.modalOptionTexts  = [];
    this.modalResultText   = null;
    this.modalContainer    = null;
  }

  // ─── create ───────────────────────────────────────────────────────────────

  create(): void {
    this.cameras.main.setBackgroundColor('#2a1e10');
    this.cameras.main.setBounds(0, 0, this.cfg.mapWidth, this.cfg.mapHeight);
    this.cameras.main.fadeIn(350, 0, 0, 0);

    this.drawTown();
    this.createPlayer();
    this.createHUD();
    this.setupInput();

    this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
    this.cameras.main.setFollowOffset(-PLAYER_W / 2, -PLAYER_H / 2);
  }

  // ─── update ───────────────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    if (this.transitionPending) return;

    // Dialogue overlay is running — pause all town input
    if (this.dialogueActive) return;

    // Modal is open — handle modal input only
    if (this.modalType !== 'none') {
      this.handleModalInput();
      return;
    }

    // ── Normal gameplay ──────────────────────────────────────────────────────

    const input = this.readInput();

    const result = computeMovement(
      this.px, this.py,
      input,
      PLAYER_SPEED,
      delta,
      this.cfg.mapWidth, this.cfg.mapHeight,
      PLAYER_W, PLAYER_H,
      this.cfg.collisionRects,
    );

    this.px = result.x;
    this.py = result.y;
    this.player.setPosition(this.px, this.py);

    // Check nearby interactable
    this.activeInteractable = getNearbyInteractable(
      this.px, this.py, PLAYER_W, PLAYER_H,
      this.getVisibleInteractables(),
    );

    // Check exit zone
    const { exit } = this.cfg;
    if (isInExitZone(this.px, this.py, PLAYER_W, PLAYER_H, exit.x, exit.y, exit.width, exit.height)) {
      this.exitToWorldMap();
      return;
    }

    // Update HUD
    this.updateHUD();

    // Handle interaction key
    if (this.activeInteractable && Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
      this.activateInteractable(this.activeInteractable);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Town rendering
  // ─────────────────────────────────────────────────────────────────────────

  private drawTown(): void {
    this.drawGround();
    this.drawBuildings();
    this.drawRoadsAndPaths();
    this.drawSaveCrystal();
    this.drawNPCPlaceholders();
    this.drawExitMarker();
    this.drawTownLabel();
  }

  private drawGround(): void {
    const gfx = this.add.graphics();
    // Base ground — warm stone/earth
    gfx.fillStyle(0x6a5a40, 1);
    gfx.fillRect(0, 0, this.cfg.mapWidth, this.cfg.mapHeight);
    // Lighter central area (the open plaza/road zone)
    gfx.fillStyle(0x7a6a50, 0.5);
    gfx.fillRect(100, 200, 1400, 680);
    // Stone path surface (main road)
    gfx.fillStyle(0x8a7c6a, 1);
    gfx.fillRect(100, 560, 1400, 80);
    // Stone tiles (horizontal lines for texture)
    gfx.lineStyle(1, 0x7a6e5e, 0.4);
    for (let tx = 120; tx < 1500; tx += 48) {
      gfx.beginPath();
      gfx.moveTo(tx, 560);
      gfx.lineTo(tx, 640);
      gfx.strokePath();
    }
    // Vertical center path (to exit)
    gfx.fillStyle(0x8a7c6a, 1);
    gfx.fillRect(740, 640, 120, 260);
    // Grass patches beside roads
    gfx.fillStyle(0x4a6a30, 0.6);
    for (let gx = 120; gx < 1500; gx += 120) {
      const gy = 540 - (Math.sin(gx * 0.04) * 8 | 0);
      gfx.fillRect(gx, gy - 6, 30, 12);
    }
    // Top boundary wall (stone blocks)
    gfx.fillStyle(0x5a5040, 1);
    gfx.fillRect(0, 0, this.cfg.mapWidth, 80);
    gfx.lineStyle(2, 0x3a3028, 0.7);
    for (let wx = 0; wx < this.cfg.mapWidth; wx += 60) {
      gfx.beginPath();
      gfx.moveTo(wx, 0);
      gfx.lineTo(wx, 80);
      gfx.strokePath();
    }
    gfx.lineStyle(1, 0x3a3028, 0.5);
    gfx.beginPath();
    gfx.moveTo(0, 40); gfx.lineTo(this.cfg.mapWidth, 40);
    gfx.strokePath();
  }

  private drawBuildings(): void {
    const gfx = this.add.graphics();

    // ── Inn (left side) ─────────────────────────────────────────────────────
    // Foundation / shadow
    gfx.fillStyle(0x3a2a10, 0.5);
    gfx.fillRect(118, 524, 244, 12);
    // Body
    gfx.fillStyle(0xb8722a, 1);
    gfx.fillRect(120, 300, 240, 224);
    // Roof
    gfx.fillStyle(0x7a3a14, 1);
    gfx.fillTriangle(104, 300, 240, 210, 376, 300);
    // Roof ridge tiles
    gfx.fillStyle(0x5a2a0a, 1);
    gfx.fillRect(104, 296, 272, 8);
    // Door (darker arch in building face)
    gfx.fillStyle(0x5a3010, 1);
    gfx.fillRect(216, 448, 48, 76);
    gfx.fillStyle(0x3a1e08, 1);
    gfx.fillCircle(240, 448, 24);
    // Windows (two, warm glow)
    gfx.fillStyle(0xffe0a0, 0.85);
    gfx.fillRect(138, 354, 40, 36);
    gfx.fillRect(202, 354, 40, 36);
    gfx.fillRect(302, 354, 40, 36);
    // Window cross bars
    gfx.lineStyle(2, 0x7a3a14, 1);
    for (const wx of [138, 202, 302]) {
      gfx.beginPath();
      gfx.moveTo(wx + 20, 354); gfx.lineTo(wx + 20, 390);
      gfx.moveTo(wx, 372);     gfx.lineTo(wx + 40, 372);
      gfx.strokePath();
    }
    // Inn sign
    gfx.fillStyle(0xc89040, 1);
    gfx.fillRect(194, 436, 92, 24);
    gfx.lineStyle(2, 0x8a5010, 1);
    gfx.strokeRect(194, 436, 92, 24);
    this.add.text(240, 448, 'INN', {
      fontFamily: FONTS.ui,
      fontSize:   '13px',
      fontStyle:  'bold',
      color:      '#3a1e08',
    }).setOrigin(0.5);

    // ── Shop (right side) ────────────────────────────────────────────────────
    // Foundation
    gfx.fillStyle(0x3a2a10, 0.5);
    gfx.fillRect(1238, 524, 244, 12);
    // Body (blue-grey)
    gfx.fillStyle(0x5a7490, 1);
    gfx.fillRect(1240, 300, 240, 224);
    // Roof
    gfx.fillStyle(0x3a5070, 1);
    gfx.fillTriangle(1224, 300, 1360, 210, 1496, 300);
    gfx.fillStyle(0x2a3a54, 1);
    gfx.fillRect(1224, 296, 272, 8);
    // Door
    gfx.fillStyle(0x3a4a5a, 1);
    gfx.fillRect(1336, 448, 48, 76);
    gfx.fillStyle(0x2a3444, 1);
    gfx.fillCircle(1360, 448, 24);
    // Windows
    gfx.fillStyle(0xc0e0ff, 0.7);
    gfx.fillRect(1258, 354, 40, 36);
    gfx.fillRect(1322, 354, 40, 36);
    gfx.fillRect(1422, 354, 40, 36);
    gfx.lineStyle(2, 0x3a5070, 1);
    for (const wx of [1258, 1322, 1422]) {
      gfx.beginPath();
      gfx.moveTo(wx + 20, 354); gfx.lineTo(wx + 20, 390);
      gfx.moveTo(wx, 372);     gfx.lineTo(wx + 40, 372);
      gfx.strokePath();
    }
    // Shop sign
    gfx.fillStyle(0x4a8aaa, 1);
    gfx.fillRect(1314, 436, 92, 24);
    gfx.lineStyle(2, 0x2a5a7a, 1);
    gfx.strokeRect(1314, 436, 92, 24);
    this.add.text(1360, 448, 'SHOP', {
      fontFamily: FONTS.ui,
      fontSize:   '13px',
      fontStyle:  'bold',
      color:      '#ddeeff',
    }).setOrigin(0.5);

    // ── Town Hall (upper center) ──────────────────────────────────────────────
    // Foundation
    gfx.fillStyle(0x3a2a10, 0.5);
    gfx.fillRect(618, 304, 364, 14);
    // Body
    gfx.fillStyle(0x9a8060, 1);
    gfx.fillRect(620, 80, 360, 224);
    // Roof
    gfx.fillStyle(0x6a5040, 1);
    gfx.fillTriangle(604, 80, 800, -10, 996, 80);
    gfx.fillStyle(0x5a4030, 1);
    gfx.fillRect(604, 76, 392, 10);
    // Pillars
    gfx.fillStyle(0xb0a080, 1);
    for (const px of [638, 698, 882, 942]) {
      gfx.fillRect(px, 170, 22, 134);
    }
    // Door (large)
    gfx.fillStyle(0x5a4030, 1);
    gfx.fillRect(762, 214, 76, 90);
    gfx.fillStyle(0x3a2818, 1);
    gfx.fillCircle(800, 214, 38);
    // Windows
    gfx.fillStyle(0xffe8c0, 0.7);
    gfx.fillRect(638, 110, 50, 44);
    gfx.fillRect(912, 110, 50, 44);
    // Banner poles
    gfx.fillStyle(0x3a2a10, 1);
    gfx.fillRect(716, 80, 6, 60);
    gfx.fillRect(878, 80, 6, 60);
    // Banners
    gfx.fillStyle(0xd9b35b, 1);
    gfx.fillRect(718, 80, 36, 52);
    gfx.fillStyle(0xb87820, 1);
    gfx.fillTriangle(718, 132, 736, 116, 754, 132);
    gfx.fillStyle(0xd9b35b, 1);
    gfx.fillRect(880, 80, 36, 52);
    gfx.fillStyle(0xb87820, 1);
    gfx.fillTriangle(880, 132, 898, 116, 916, 132);

    // Town Hall label
    this.add.text(800, 64, 'Town Hall', {
      fontFamily: FONTS.ui,
      fontSize:   '16px',
      fontStyle:  'bold',
      color:      COLOR_HEX.goldAccent,
      stroke:     '#0a0f1a',
      strokeThickness: 3,
    }).setOrigin(0.5, 1);

    // ── Side boundary walls ───────────────────────────────────────────────────
    // Left wall is always at x:0 width 100.
    // Right wall is derived from the config's right-perimeter collision rect
    // (the tallest rect anchored to the right edge) so it works for any mapWidth.
    gfx.fillStyle(0x5a4830, 1);
    gfx.fillRect(0, 0, 100, this.cfg.mapHeight);
    const rightWall = this.cfg.collisionRects
      .filter(r => r.x > this.cfg.mapWidth / 2 && r.y === 0 && r.height >= this.cfg.mapHeight - 80)
      .sort((a, b) => a.x - b.x)[0];
    if (rightWall) {
      gfx.fillRect(rightWall.x, 0, rightWall.width, this.cfg.mapHeight);
    }
    // South walls — derived from config so each town's exit gap is respected.
    // Filter: any collision rect in the bottom 80px of the map (excludes
    // perimeter walls which start at y:0 and buildings which start above).
    gfx.fillStyle(0x5a4830, 1);
    for (const r of this.cfg.collisionRects.filter(r => r.y >= this.cfg.mapHeight - 80)) {
      gfx.fillRect(r.x, r.y, r.width, r.height);
    }

    // ── Fence posts along road ────────────────────────────────────────────────
    gfx.fillStyle(0x8a6840, 1);
    for (let fp = 380; fp < 1300; fp += 80) {
      gfx.fillRect(fp, 556, 8, 30);
    }
  }

  private drawRoadsAndPaths(): void {
    const gfx = this.add.graphics();
    // Already drawn in drawGround — add some extra detail here
    // Flower patches between the road and inn/shop
    gfx.fillStyle(0xe87070, 1);
    for (const [fx, fy] of [[400,538],[440,542],[480,536],[900,540],[960,538],[1020,542]]) {
      gfx.fillCircle(fx, fy, 4);
    }
    gfx.fillStyle(0x70a0e0, 1);
    for (const [fx, fy] of [[420,530],[460,534],[860,532],[940,530]]) {
      gfx.fillCircle(fx, fy, 4);
    }
    // Lamp posts
    gfx.fillStyle(0x6a5a30, 1);
    for (const lx of [320, 700, 900, 1280]) {
      gfx.fillRect(lx, 500, 8, 68);
      gfx.fillStyle(0xffe090, 0.9);
      gfx.fillCircle(lx + 4, 500, 14);
      gfx.fillStyle(0x6a5a30, 1);
    }
    // Barrels near inn
    gfx.fillStyle(0x7a5a30, 1);
    gfx.fillCircle(396, 533, 14);
    gfx.fillCircle(416, 533, 14);
    gfx.lineStyle(2, 0x5a3a18, 1);
    gfx.strokeCircle(396, 533, 14);
    gfx.strokeCircle(416, 533, 14);
  }

  private drawSaveCrystal(): void {
    const crystal = this.cfg.interactables.find(i => i.type === 'save_crystal');
    if (!crystal) return;   // town has no save crystal — skip
    const cx = crystal.x;
    const cy = crystal.y;
    const gfx = this.add.graphics();

    // Pedestal
    gfx.fillStyle(0x8a7860, 1);
    gfx.fillRect(cx - 16, cy + 18, 32, 14);
    gfx.fillRect(cx - 10, cy + 12, 20, 8);

    // Glow halo
    gfx.fillStyle(0x8fc8ff, 0.15);
    gfx.fillCircle(cx, cy, 36);
    gfx.fillStyle(0x8fc8ff, 0.10);
    gfx.fillCircle(cx, cy, 50);

    // Crystal body (diamond shape)
    gfx.fillStyle(0x8fc8ff, 0.85);
    gfx.fillTriangle(cx, cy - 26, cx - 16, cy, cx + 16, cy);
    gfx.fillStyle(0x60a0e0, 0.9);
    gfx.fillTriangle(cx - 16, cy, cx + 16, cy, cx, cy + 22);
    // Inner highlight
    gfx.fillStyle(0xffffff, 0.5);
    gfx.fillTriangle(cx + 2, cy - 20, cx - 4, cy - 4, cx + 10, cy - 4);

    // Borders
    gfx.lineStyle(1, 0xffffff, 0.7);
    gfx.strokeTriangle(cx, cy - 26, cx - 16, cy, cx + 16, cy);
    gfx.strokeTriangle(cx - 16, cy, cx + 16, cy, cx, cy + 22);

    // Label
    this.add.text(cx, cy - 38, '✦ Save Crystal', {
      fontFamily: FONTS.ui,
      fontSize:   '13px',
      color:      '#8fc8ff',
      stroke:     '#0a0f1a',
      strokeThickness: 2,
    }).setOrigin(0.5, 1);
  }

  private getVisibleInteractables(): Interactable[] {
    const flags = getStoryFlags();
    return this.cfg.interactables.filter(
      item => !item.hideWhenFlag || !flags[item.hideWhenFlag],
    );
  }

  private drawNPCPlaceholders(): void {
    // Cycle through distinct palette entries so adjacent NPCs are distinguishable.
    const NPC_PALETTE: Array<[number, number]> = [
      [0xd0b060, 0xa08040],  // warm tan
      [0x6090d0, 0x4060a0],  // cool blue
      [0x708060, 0x506040],  // muted green
      [0xc07050, 0x8a4028],  // terracotta
    ];
    let npcIndex = 0;

    for (const item of this.getVisibleInteractables()) {
      if (item.type === 'npc') {
        const [body, accent] = NPC_PALETTE[npcIndex % NPC_PALETTE.length];
        this.drawNPCShape(item.x, item.y, body, accent, String(npcIndex + 1));
        npcIndex++;
      } else if (item.type === 'sign') {
        this.drawSignShape(item.x, item.y);
      }
    }
  }

  private drawSignShape(cx: number, cy: number): void {
    const gfx = this.add.graphics();
    // Post
    gfx.fillStyle(0x7a5a30, 1);
    gfx.fillRect(cx - 3, cy - 4, 6, 24);
    // Board
    gfx.fillStyle(0xc8a040, 1);
    gfx.fillRect(cx - 20, cy - 24, 40, 20);
    gfx.lineStyle(2, 0x8a6020, 1);
    gfx.strokeRect(cx - 20, cy - 24, 40, 20);
    // Three horizontal text-line suggestions
    gfx.fillStyle(0x5a3a10, 1);
    gfx.fillRect(cx - 14, cy - 20, 28, 2);
    gfx.fillRect(cx - 12, cy - 15, 22, 2);
    gfx.fillRect(cx - 14, cy - 10, 16, 2);

    this.add.text(cx, cy - 36, '!', {
      fontFamily: FONTS.ui, fontSize: '13px', fontStyle: 'bold',
      color: COLOR_HEX.goldAccent, stroke: '#0a0f1a', strokeThickness: 2,
    }).setOrigin(0.5, 1);
  }

  private drawNPCShape(
    cx: number, cy: number,
    bodyColor: number, accentColor: number,
    initial: string,
  ): void {
    const gfx = this.add.graphics();
    // Shadow
    gfx.fillStyle(0x000000, 0.3);
    gfx.fillEllipse(cx, cy + 16, 24, 8);
    // Body
    gfx.fillStyle(bodyColor, 1);
    gfx.fillRect(cx - 12, cy - 14, 24, 28);
    // Accent collar
    gfx.fillStyle(accentColor, 1);
    gfx.fillRect(cx - 12, cy - 14, 24, 6);
    // Head
    gfx.fillStyle(0xf0d888, 1);
    gfx.fillCircle(cx, cy - 22, 12);
    // Eyes
    gfx.fillStyle(0x1a1a1a, 1);
    gfx.fillRect(cx - 5, cy - 25, 3, 3);
    gfx.fillRect(cx + 2, cy - 25, 3, 3);

    // Name initial label
    this.add.text(cx, cy - 42, initial, {
      fontFamily: FONTS.ui,
      fontSize:   '14px',
      fontStyle:  'bold',
      color:      COLOR_HEX.parchment,
      stroke:     '#0a0f1a',
      strokeThickness: 2,
    }).setOrigin(0.5, 1);
  }

  private drawExitMarker(): void {
    const { exit } = this.cfg;
    const cx = exit.x + exit.width / 2;
    const gfx = this.add.graphics();

    // Exit path visual
    gfx.fillStyle(0x6a5a40, 1);
    gfx.fillRect(exit.x, exit.y, exit.width, exit.height);
    // Dotted border
    gfx.lineStyle(2, COLORS.goldAccent, 0.6);
    gfx.strokeRect(exit.x, exit.y, exit.width, exit.height);

    // Arrow indicators
    gfx.fillStyle(COLORS.goldAccent, 0.7);
    gfx.fillTriangle(cx - 10, exit.y + 14, cx, exit.y + 30, cx + 10, exit.y + 14);
    gfx.fillTriangle(cx - 10, exit.y + 28, cx, exit.y + 44, cx + 10, exit.y + 28);

    const destName = LOCATIONS[exit.targetLocationId]?.displayName ?? exit.targetLocationId;
    this.add.text(cx, exit.y - 8, `← To ${destName}`, {
      fontFamily: FONTS.ui,
      fontSize:   '13px',
      color:      COLOR_HEX.goldAccent,
      stroke:     '#0a0f1a',
      strokeThickness: 2,
    }).setOrigin(0.5, 1);
  }

  private drawTownLabel(): void {
    this.add.text(this.cfg.mapWidth / 2, 44, this.cfg.displayName, {
      fontFamily: FONTS.title,
      fontSize:   '28px',
      fontStyle:  'bold',
      color:      COLOR_HEX.goldAccent,
      stroke:     '#0a0f1a',
      strokeThickness: 4,
    }).setOrigin(0.5);
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
    g.fillStyle(0x8a6a10, 0.4);
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
  // HUD  (setScrollFactor(0) keeps elements fixed to the viewport)
  // ─────────────────────────────────────────────────────────────────────────

  private createHUD(): void {
    // Location label — top-left. Static for TownScene; demoted to local since it never changes.
    const W = 200; const H = 38;
    this.hudLocationPanel = drawPanel(this, { x: 16, y: 16, width: W, height: H });
    this.hudLocationPanel.setScrollFactor(0).setDepth(100);

    this.add.text(30, 35, this.cfg.displayName, {
      fontFamily: FONTS.ui,
      fontSize:   `${FONT_SIZES.locationLabel}px`,
      fontStyle:  'bold',
      color:      COLOR_HEX.goldAccent,
    })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(101);
    const HW = 320; const HH = 38;
    const HX = GAME_WIDTH / 2 - HW / 2;
    const HY = GAME_HEIGHT - 58;

    this.hudHintPanel = drawPanel(this, { x: HX, y: HY, width: HW, height: HH });
    this.hudHintPanel.setScrollFactor(0).setDepth(100).setVisible(false);

    this.hudHintText = this.add.text(GAME_WIDTH / 2, HY + HH / 2, '', {
      fontFamily: FONTS.ui,
      fontSize:   `${FONT_SIZES.hint}px`,
      color:      COLOR_HEX.parchment,
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false);
  }

  private updateHUD(): void {
    const hasInteractable = this.activeInteractable !== null;
    this.hudHintPanel.setVisible(hasInteractable);
    this.hudHintText.setVisible(hasInteractable);
    if (hasInteractable) {
      this.hudHintText.setText(`[SPACE]  ${this.activeInteractable!.label}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Input
  // ─────────────────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.cursors  = this.input.keyboard!.createCursorKeys();
    this.keyEnter = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.keyEsc   = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyWASD  = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
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
  // Interactable activation — switches on type, stays clean
  // ─────────────────────────────────────────────────────────────────────────

  private activateInteractable(item: Interactable): void {
    switch (item.type) {
      case 'npc':
      case 'sign': {
        const dialogueId = resolveNpcDialogueId(
          item.dialogueId ?? '',
          getStoryFlags(),
          item.dialogueOverrides,
        );
        const sequence = DIALOGUE[dialogueId];
        if (sequence) {
          this.startDialogue(sequence);
        }
        break;
      }
      case 'building_inn':
        this.openModal('inn');
        break;
      case 'building_shop':
        this.openModal('shop');
        break;
      case 'save_crystal':
        this.openModal('save');
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Dialogue  (launches DialogueOverlay as a parallel scene)
  // ─────────────────────────────────────────────────────────────────────────

  private startDialogue(
    sequence: import('../../dialogue/dialogue-types').DialogueSequence,
    onComplete?: () => void,
  ): void {
    this.dialogueActive = true;
    this.hudHintPanel.setVisible(false);
    this.hudHintText.setVisible(false);

    // Stop any previous instance first so the scene is in a clean state.
    if (this.scene.isActive(SCENE_KEYS.DIALOGUE_OVERLAY)) {
      this.scene.stop(SCENE_KEYS.DIALOGUE_OVERLAY);
    }

    // Register the completion listener BEFORE launch so it is guaranteed to be
    // in place before the overlay's create() runs. scene.get() returns the
    // registered scene instance (present from game start); its EventEmitter
    // exists independently of whether the scene is currently active.
    this.scene.get(SCENE_KEYS.DIALOGUE_OVERLAY).events.once('complete', (seq: import('../../dialogue/dialogue-types').DialogueSequence) => {
      // Execute any declared side-effects (flag sets, party activations, etc.)
      runEffects(seq.onComplete);
      this.dialogueActive = false;
      onComplete?.();
    });

    this.scene.launch(SCENE_KEYS.DIALOGUE_OVERLAY, { sequence });
    this.scene.bringToTop(SCENE_KEYS.DIALOGUE_OVERLAY);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Modals  (inn, shop, save — rendered inline at depth 200)
  // ─────────────────────────────────────────────────────────────────────────

  private openModal(type: ModalType): void {
    this.closeModal();  // safety: close any existing modal first
    this.modalType        = type;
    this.modalPhase       = 'select';
    this.modalSelectedIdx = 0;
    this.modalOptions     = this.buildModalOptions(type);
    this.modalContainer   = this.add.container(0, 0).setDepth(200).setScrollFactor(0);
    this.renderModal();
  }

  private buildModalOptions(type: ModalType): ModalOption[] {
    switch (type) {
      case 'inn': {
        const cost = getInnRestCost();
        const restLabel = cost > 0
          ? `Rest — restore full HP and MP  (${cost}g)`
          : 'Rest — restore full HP and MP';
        return [
          {
            label:  restLabel,
            action: () => {
              if (cost > 0 && getGold() < cost) {
                this.showModalResult("You can't afford a room tonight.", false);
                return;
              }
              restorePartyFull();
              this.showModalResult('Your party rests deeply.\nAll HP and MP restored.', true);
            },
          },
          {
            label:  'Save Game',
            action: () => {
              const ok = saveGame();
              this.showModalResult(
                ok ? 'Journey saved.' : 'Save failed — please try again.',
                ok,
              );
            },
          },
          { label: 'Leave', action: () => this.closeModal() },
        ];
      }

      case 'shop':
        // One buy option per stocked item, drawn from this town's config.
        // Equipment IDs are routed to purchaseEquipment; consumables to purchaseItem.
        return [
          ...this.cfg.shopStock.map(itemId => ({
            label:   shopItemLabel(itemId),
            preview: shopItemPreview(itemId),
            action:  () => {
              const result = isEquipmentId(itemId)
                ? purchaseEquipment(itemId)
                : purchaseItem(itemId);
              this.showModalResult(result.message, result.ok);
            },
          })),
          { label: 'Leave', action: () => this.closeModal() },
        ];

      case 'save':
        return [
          {
            label:  'Save Journey',
            action: () => {
              const ok = saveGame();
              this.showModalResult(
                ok
                  ? 'The crystal pulses softly.\nYour journey has been saved.'
                  : 'The crystal flickers. Save failed.',
                ok,
              );
            },
          },
          { label: 'Cancel', action: () => this.closeModal() },
        ];

      default:
        return [{ label: 'Close', action: () => this.closeModal() }];
    }
  }

  private renderModal(): void {
    if (!this.modalContainer) return;
    this.modalContainer.removeAll(true);
    this.modalOptionBgs    = [];
    this.modalOptionTexts  = [];
    this.modalResultText   = null;

    // Panel dimensions  (spec: 70% screen width, 70% screen height)
    const MW = Math.round(GAME_WIDTH  * 0.70);  // 896
    const MH = Math.round(GAME_HEIGHT * 0.68);  // 490
    const MX = (GAME_WIDTH  - MW) / 2;           // 192
    const MY = (GAME_HEIGHT - MH) / 2;           // 115

    // Panel background
    const bg = this.add.graphics().setScrollFactor(0);
    bg.fillStyle(COLORS.panelBg, 0.97);
    bg.fillRoundedRect(MX, MY, MW, MH, PANEL.cornerRadius + 2);
    bg.lineStyle(PANEL.borderWidth, COLORS.panelBorder, 1);
    bg.strokeRoundedRect(MX, MY, MW, MH, PANEL.cornerRadius + 2);
    bg.lineStyle(1, COLORS.panelHighlight, 0.5);
    bg.strokeRoundedRect(MX + 5, MY + 5, MW - 10, MH - 10, PANEL.cornerRadius);
    this.modalContainer.add(bg);

    // Title
    const titleMap: Record<ModalType, string> = {
      none:  '',
      inn:   'Hearthstone Inn',
      shop:  "Merchant's Stall",
      save:  'Save Crystal',
    };
    const title = this.add.text(MX + MW / 2, MY + 34, titleMap[this.modalType], {
      fontFamily: FONTS.title,
      fontSize:   '28px',
      fontStyle:  'bold',
      color:      COLOR_HEX.goldAccent,
    }).setOrigin(0.5).setScrollFactor(0);
    this.modalContainer.add(title);

    // Gold display — shown in shop and inn (top-right of modal)
    if (this.modalType === 'shop' || this.modalType === 'inn') {
      const goldTxt = this.add.text(MX + MW - 18, MY + 18, `Gold: ${getGold()}g`, {
        fontFamily: FONTS.ui,
        fontSize:   '18px',
        fontStyle:  'bold',
        color:      COLOR_HEX.goldAccent,
      }).setOrigin(1, 0).setScrollFactor(0);
      this.modalContainer.add(goldTxt);
    }

    // Divider line
    const div = this.add.graphics().setScrollFactor(0);
    div.lineStyle(1, COLORS.goldAccent, 0.4);
    div.beginPath();
    div.moveTo(MX + 32, MY + 66);
    div.lineTo(MX + MW - 32, MY + 66);
    div.strokePath();
    this.modalContainer.add(div);

    // Flavour message
    const msgMap: Record<ModalType, string> = {
      none:  '',
      inn:   'The fire crackles warmly. The innkeeper nods.\n"A weary traveler deserves a proper rest."',
      shop:  'The merchant looks up from their ledger.\n"What can I get for you today?"',
      save:  'The crystal glows with a steady blue light.\n"Your journey can be recorded here."',
    };
    const msg = this.add.text(MX + MW / 2, MY + 100, msgMap[this.modalType], {
      fontFamily: FONTS.ui,
      fontSize:   '20px',
      color:      COLOR_HEX.textSecondary,
      align:      'center',
      wordWrap:   { width: MW - 64 },
      lineSpacing: 4,
    }).setOrigin(0.5, 0).setScrollFactor(0);
    this.modalContainer.add(msg);

    // ── Item preview line (shop only — shown for the currently selected option) ─
    // Sits between the flavour message and the option buttons.
    // Gives the player stat/effect info before committing to a purchase.
    const selectedPreview = this.modalOptions[this.modalSelectedIdx]?.preview ?? '';
    if (selectedPreview) {
      const prevLine = this.add.text(MX + MW / 2, MY + 175, selectedPreview, {
        fontFamily: FONTS.ui,
        fontSize:   '17px',
        fontStyle:  'italic',
        color:      COLOR_HEX.goldAccent,
        align:      'center',
      }).setOrigin(0.5, 0).setScrollFactor(0);
      this.modalContainer.add(prevLine);
    }

    // ── Result message (shown in 'result' phase) ───────────────────────────
    const result = this.add.text(MX + MW / 2, MY + 200, '', {
      fontFamily:  FONTS.ui,
      fontSize:    '22px',
      fontStyle:   'bold',
      color:       '#5E9B63',
      align:       'center',
      wordWrap:    { width: MW - 64 },
      lineSpacing: 6,
    }).setOrigin(0.5, 0).setScrollFactor(0).setVisible(false);
    this.modalContainer.add(result);
    this.modalResultText = result;

    // ── Option buttons ─────────────────────────────────────────────────────
    const OPTS_START_Y = MY + 240;
    const OPT_W       = MW - 80;
    const OPT_H       = 52;
    const OPT_GAP     = 12;
    const OPT_X       = MX + 40;

    this.modalOptions.forEach((opt, i) => {
      const oy  = OPTS_START_Y + i * (OPT_H + OPT_GAP);
      const isSelected = i === this.modalSelectedIdx && this.modalPhase === 'select';

      const optBg = this.add.graphics().setScrollFactor(0);
      if (isSelected) {
        optBg.fillStyle(COLORS.selectionFill, 1);
        optBg.fillRoundedRect(OPT_X, oy, OPT_W, OPT_H, PANEL.cornerRadius);
        optBg.lineStyle(PANEL.borderWidth, COLORS.selectionBorder, 1);
        optBg.strokeRoundedRect(OPT_X, oy, OPT_W, OPT_H, PANEL.cornerRadius);
      } else {
        optBg.fillStyle(COLORS.panelBg, 0.6);
        optBg.fillRoundedRect(OPT_X, oy, OPT_W, OPT_H, PANEL.cornerRadius);
        optBg.lineStyle(1, COLORS.panelBorder, 0.5);
        optBg.strokeRoundedRect(OPT_X, oy, OPT_W, OPT_H, PANEL.cornerRadius);
      }
      this.modalContainer!.add(optBg);
      this.modalOptionBgs.push(optBg);

      const optTxt = this.add.text(OPT_X + OPT_W / 2, oy + OPT_H / 2, opt.label, {
        fontFamily: FONTS.ui,
        fontSize:   `${FONT_SIZES.menuButton}px`,
        fontStyle:  'bold',
        color:      COLOR_HEX.parchment,
      }).setOrigin(0.5).setScrollFactor(0);
      this.modalContainer!.add(optTxt);
      this.modalOptionTexts.push(optTxt);
    });

    // ESC hint
    const hint = this.add.text(MX + MW - 16, MY + MH - 16, 'ESC — close', {
      fontFamily: FONTS.ui,
      fontSize:   '13px',
      color:      COLOR_HEX.textSecondary,
    }).setOrigin(1, 1).setScrollFactor(0);
    this.modalContainer.add(hint);
  }

  private showModalResult(message: string, success = true): void {
    this.modalPhase = 'result';
    if (this.modalResultText) {
      // Green for success, red for failure
      this.modalResultText
        .setText(message)
        .setColor(success ? '#5E9B63' : '#D97A7A')
        .setVisible(true);
    }
    // Hide option buttons during result phase
    this.modalOptionBgs.forEach(b => b.setVisible(false));
    this.modalOptionTexts.forEach(t => t.setVisible(false));
    // Auto-close after 1.8 s then reopen fresh so gold/inventory updates show
    this.time.delayedCall(1800, () => {
      const currentType = this.modalType;
      this.closeModal();
      if (currentType !== 'none') {
        this.openModal(currentType);
      }
    });
  }

  private handleModalInput(): void {
    if (this.modalPhase === 'result') return; // auto-closing, ignore input

    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
      this.closeModal();
      return;
    }

    const up   = Phaser.Input.Keyboard.JustDown(this.cursors.up)   || Phaser.Input.Keyboard.JustDown(this.keyWASD.W);
    const down = Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.keyWASD.S);
    const confirm =
      Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
      Phaser.Input.Keyboard.JustDown(this.keyEnter);

    if (up) {
      this.modalSelectedIdx = (this.modalSelectedIdx - 1 + this.modalOptions.length) % this.modalOptions.length;
      this.renderModal();
    } else if (down) {
      this.modalSelectedIdx = (this.modalSelectedIdx + 1) % this.modalOptions.length;
      this.renderModal();
    } else if (confirm) {
      this.modalOptions[this.modalSelectedIdx].action();
    }
  }

  private closeModal(): void {
    if (this.modalContainer) {
      this.modalContainer.destroy(true);
      this.modalContainer = null;
    }
    this.modalType        = 'none';
    this.modalPhase       = 'select';
    this.modalOptionBgs   = [];
    this.modalOptionTexts = [];
    this.modalResultText  = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Exit to world map
  // ─────────────────────────────────────────────────────────────────────────

  private exitToWorldMap(): void {
    this.transitionPending = true;

    const { exit } = this.cfg;

    // Store player CENTER in state — convention used everywhere else in the save system.
    // exit.worldReturnX/Y are TOP-LEFT, so add half-player-size to get center.
    setCurrentLocation({
      locationId: exit.targetLocationId,
      x: exit.worldReturnX + PLAYER_W / 2,
      y: exit.worldReturnY + PLAYER_H / 2,
    });

    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // Stop dialogue overlay if still running
      if (this.scene.isActive(SCENE_KEYS.DIALOGUE_OVERLAY)) {
        this.scene.stop(SCENE_KEYS.DIALOGUE_OVERLAY);
      }
      this.scene.start(SCENE_KEYS.WORLD_MAP, {
        returnX: exit.worldReturnX,
        returnY: exit.worldReturnY,
      } satisfies WorldMapInitData);
    });
  }
}
