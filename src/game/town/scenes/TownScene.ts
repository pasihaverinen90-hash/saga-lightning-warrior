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
import { getStoryFlags, getGold, getPartyMember } from '../../state/state-selectors';
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
  // ── locationId this scene was entered with — used when writing currentLocation
  // so a save inside this town records the right location id for resume.
  private currentLocationId: string = 'lumen_town';

  // ── Player ─────────────────────────────────────────────────────────────────
  private player!: Phaser.GameObjects.Graphics;
  private px = LUMEN_TOWN_CONFIG.playerEntryX;
  private py = LUMEN_TOWN_CONFIG.playerEntryY;

  // ── Input ──────────────────────────────────────────────────────────────────
  private cursors!:   Phaser.Types.Input.Keyboard.CursorKeys;
  private keyEnter!:  Phaser.Input.Keyboard.Key; // fix: registered once in setupInput, not per-frame
  private keyEsc!:    Phaser.Input.Keyboard.Key;
  private keyMenu!:   Phaser.Input.Keyboard.Key;
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

  // ── NPC / sign visuals ────────────────────────────────────────────────────
  // Tracked so drawNPCPlaceholders() can tear them down and redraw when a
  // dialogue effect toggles an item's hideWhenFlag (e.g. a recruitable joins
  // and must disappear immediately, without re-entering the scene).
  private interactableVisuals: Phaser.GameObjects.GameObject[] = [];

  // ── State ──────────────────────────────────────────────────────────────────
  private activeInteractable:  Interactable | null = null;
  private dialogueActive      = false;
  private transitionPending   = false;
  // Prevents the Space press that closes a dialogue from immediately retriggering
  // the same NPC. Cleared once Space is physically released.
  private interactionCooldown = false;
  private menuActive          = false;
  // Prevents the M press that closed the menu from immediately reopening it.
  // Cleared once M is physically released.
  private menuCooldown        = false;

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
    // Record the canonical locationId for this town so state writes below tag
    // saves with the right id. Falls back to 'lumen_town' to match the config default.
    this.currentLocationId = data.locationId ?? 'lumen_town';

    // Entry position: resume coords from scene-router win if present (load path);
    // otherwise the config's default entry (normal trigger-entry path).
    this.px = data.startX ?? this.cfg.playerEntryX;
    this.py = data.startY ?? this.cfg.playerEntryY;
    this.dialogueActive      = false;
    this.transitionPending   = false;
    this.interactionCooldown = false;
    this.menuActive          = false;
    this.menuCooldown        = false;
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

    // Tag currentLocation with this town's id and the player's in-town spawn
    // position so a save taken before the player moves (e.g. immediately
    // opening the menu on entry) resumes in this town, not at the world-map
    // coords the entry trigger wrote. Stored as CENTER per save convention.
    this.writeCurrentLocation();
  }

  // ─── update ───────────────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    if (this.transitionPending) return;

    // Dialogue overlay is running — pause all town input
    if (this.dialogueActive) return;

    // In-game menu is open — pause all town input
    if (this.menuActive) return;

    // Modal is open — handle modal input only
    if (this.modalType !== 'none') {
      this.handleModalInput();
      return;
    }

    // ── Normal gameplay ──────────────────────────────────────────────────────

    // Clear M-key cooldown once the key is physically released
    if (this.menuCooldown && !this.keyMenu.isDown) {
      this.menuCooldown = false;
    }

    // Open in-game menu
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
      this.cfg.mapWidth, this.cfg.mapHeight,
      PLAYER_W, PLAYER_H,
      this.cfg.collisionRects,
    );

    this.px = result.x;
    this.py = result.y;
    this.player.setPosition(this.px, this.py);

    // Keep state.currentLocation in sync with the player's in-town position so
    // saving inside the town resumes at the exact tile the player stood on.
    // Only write when the player actually moved — avoids per-frame churn when
    // idle. Writes use CENTER coords (scene-router converts to top-left on load).
    if (result.x !== prevX || result.y !== prevY) {
      this.writeCurrentLocation();
    }

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

    // Clear post-dialogue cooldown once Space is physically released
    if (this.interactionCooldown && !this.cursors.space.isDown) {
      this.interactionCooldown = false;
    }

    // Handle interaction key
    if (this.activeInteractable && !this.interactionCooldown && Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
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
    const { plaza, road, exitPath } = this.cfg.layout;
    const gfx = this.add.graphics();
    // Base ground — warm stone/earth
    gfx.fillStyle(0x6a5a40, 1);
    gfx.fillRect(0, 0, this.cfg.mapWidth, this.cfg.mapHeight);
    // Lighter central area (the open plaza/road zone)
    gfx.fillStyle(0x7a6a50, 0.5);
    gfx.fillRect(plaza.x, plaza.y, plaza.width, plaza.height);
    // Stone path surface (main road)
    gfx.fillStyle(0x8a7c6a, 1);
    gfx.fillRect(road.x, road.y, road.width, road.height);
    // Stone tiles (horizontal lines for texture)
    gfx.lineStyle(1, 0x7a6e5e, 0.4);
    for (let tx = road.x + 20; tx < road.x + road.width; tx += 48) {
      gfx.beginPath();
      gfx.moveTo(tx, road.y);
      gfx.lineTo(tx, road.y + road.height);
      gfx.strokePath();
    }
    // Vertical center path (to exit)
    gfx.fillStyle(0x8a7c6a, 1);
    gfx.fillRect(exitPath.x, exitPath.y, exitPath.width, exitPath.height);
    // Grass patches beside roads
    gfx.fillStyle(0x4a6a30, 0.6);
    for (let gx = road.x + 20; gx < road.x + road.width; gx += 120) {
      const gy = road.y - 20 - (Math.sin(gx * 0.04) * 8 | 0);
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
    const { inn, shop, hall, hallLabel, fencePosts } = this.cfg.layout;
    const gfx = this.add.graphics();

    // ── Inn (left side) ─────────────────────────────────────────────────────
    // Foundation / shadow
    gfx.fillStyle(0x3a2a10, 0.5);
    gfx.fillRect(inn.x - 2, inn.y + inn.height, inn.width + 4, 12);
    // Body
    gfx.fillStyle(0xb8722a, 1);
    gfx.fillRect(inn.x, inn.y, inn.width, inn.height);
    // Roof
    gfx.fillStyle(0x7a3a14, 1);
    gfx.fillTriangle(inn.x - 16, inn.y, inn.x + inn.width / 2, inn.y - 90, inn.x + inn.width + 16, inn.y);
    // Roof ridge tiles
    gfx.fillStyle(0x5a2a0a, 1);
    gfx.fillRect(inn.x - 16, inn.y - 4, inn.width + 32, 8);
    // Door (darker arch in building face)
    const innDoorCX = inn.x + inn.width / 2;
    const innDoorY  = inn.y + inn.height - 76;
    gfx.fillStyle(0x5a3010, 1);
    gfx.fillRect(innDoorCX - 24, innDoorY, 48, 76);
    gfx.fillStyle(0x3a1e08, 1);
    gfx.fillCircle(innDoorCX, innDoorY, 24);
    // Windows (warm glow)
    const innWinXs = [inn.x + 18, inn.x + 82, inn.x + 182];
    const innWinY  = inn.y + 54;
    gfx.fillStyle(0xffe0a0, 0.85);
    for (const wx of innWinXs) gfx.fillRect(wx, innWinY, 40, 36);
    // Window cross bars
    gfx.lineStyle(2, 0x7a3a14, 1);
    for (const wx of innWinXs) {
      gfx.beginPath();
      gfx.moveTo(wx + 20, innWinY);      gfx.lineTo(wx + 20, innWinY + 36);
      gfx.moveTo(wx,      innWinY + 18); gfx.lineTo(wx + 40, innWinY + 18);
      gfx.strokePath();
    }
    // Inn sign
    const innSignX = inn.x + inn.width / 2 - 46;
    const innSignY = inn.y + inn.height - 88;
    gfx.fillStyle(0xc89040, 1);
    gfx.fillRect(innSignX, innSignY, 92, 24);
    gfx.lineStyle(2, 0x8a5010, 1);
    gfx.strokeRect(innSignX, innSignY, 92, 24);
    this.add.text(inn.x + inn.width / 2, innSignY + 12, 'INN', {
      fontFamily: FONTS.ui,
      fontSize:   '13px',
      fontStyle:  'bold',
      color:      '#3a1e08',
    }).setOrigin(0.5);

    // ── Shop (right side) ────────────────────────────────────────────────────
    // Foundation
    gfx.fillStyle(0x3a2a10, 0.5);
    gfx.fillRect(shop.x - 2, shop.y + shop.height, shop.width + 4, 12);
    // Body (blue-grey)
    gfx.fillStyle(0x5a7490, 1);
    gfx.fillRect(shop.x, shop.y, shop.width, shop.height);
    // Roof
    gfx.fillStyle(0x3a5070, 1);
    gfx.fillTriangle(shop.x - 16, shop.y, shop.x + shop.width / 2, shop.y - 90, shop.x + shop.width + 16, shop.y);
    gfx.fillStyle(0x2a3a54, 1);
    gfx.fillRect(shop.x - 16, shop.y - 4, shop.width + 32, 8);
    // Door
    const shopDoorCX = shop.x + shop.width / 2;
    const shopDoorY  = shop.y + shop.height - 76;
    gfx.fillStyle(0x3a4a5a, 1);
    gfx.fillRect(shopDoorCX - 24, shopDoorY, 48, 76);
    gfx.fillStyle(0x2a3444, 1);
    gfx.fillCircle(shopDoorCX, shopDoorY, 24);
    // Windows
    const shopWinXs = [shop.x + 18, shop.x + 82, shop.x + 182];
    const shopWinY  = shop.y + 54;
    gfx.fillStyle(0xc0e0ff, 0.7);
    for (const wx of shopWinXs) gfx.fillRect(wx, shopWinY, 40, 36);
    gfx.lineStyle(2, 0x3a5070, 1);
    for (const wx of shopWinXs) {
      gfx.beginPath();
      gfx.moveTo(wx + 20, shopWinY);      gfx.lineTo(wx + 20, shopWinY + 36);
      gfx.moveTo(wx,      shopWinY + 18); gfx.lineTo(wx + 40, shopWinY + 18);
      gfx.strokePath();
    }
    // Shop sign
    const shopSignX = shop.x + shop.width / 2 - 46;
    const shopSignY = shop.y + shop.height - 88;
    gfx.fillStyle(0x4a8aaa, 1);
    gfx.fillRect(shopSignX, shopSignY, 92, 24);
    gfx.lineStyle(2, 0x2a5a7a, 1);
    gfx.strokeRect(shopSignX, shopSignY, 92, 24);
    this.add.text(shop.x + shop.width / 2, shopSignY + 12, 'SHOP', {
      fontFamily: FONTS.ui,
      fontSize:   '13px',
      fontStyle:  'bold',
      color:      '#ddeeff',
    }).setOrigin(0.5);

    // ── Hall (upper center) ───────────────────────────────────────────────────
    // Foundation
    gfx.fillStyle(0x3a2a10, 0.5);
    gfx.fillRect(hall.x - 2, hall.y + hall.height, hall.width + 4, 14);
    // Body
    gfx.fillStyle(0x9a8060, 1);
    gfx.fillRect(hall.x, hall.y, hall.width, hall.height);
    // Roof
    gfx.fillStyle(0x6a5040, 1);
    gfx.fillTriangle(hall.x - 16, hall.y, hall.x + hall.width / 2, hall.y - 90, hall.x + hall.width + 16, hall.y);
    gfx.fillStyle(0x5a4030, 1);
    gfx.fillRect(hall.x - 16, hall.y - 4, hall.width + 32, 10);
    // Pillars
    gfx.fillStyle(0xb0a080, 1);
    const pillarY = hall.y + 90;
    const pillarH = hall.height - 90;
    for (const px of [hall.x + 18, hall.x + 78, hall.x + hall.width - 98, hall.x + hall.width - 38]) {
      gfx.fillRect(px, pillarY, 22, pillarH);
    }
    // Door (large)
    const hallDoorCX = hall.x + hall.width / 2;
    const hallDoorY  = hall.y + hall.height - 90;
    gfx.fillStyle(0x5a4030, 1);
    gfx.fillRect(hallDoorCX - 38, hallDoorY, 76, 90);
    gfx.fillStyle(0x3a2818, 1);
    gfx.fillCircle(hallDoorCX, hallDoorY, 38);
    // Windows
    gfx.fillStyle(0xffe8c0, 0.7);
    gfx.fillRect(hall.x + 18,               hall.y + 30, 50, 44);
    gfx.fillRect(hall.x + hall.width - 68,  hall.y + 30, 50, 44);
    // Banner poles
    gfx.fillStyle(0x3a2a10, 1);
    gfx.fillRect(hall.x + 96,               hall.y, 6, 60);
    gfx.fillRect(hall.x + hall.width - 102, hall.y, 6, 60);
    // Banners
    gfx.fillStyle(0xd9b35b, 1);
    gfx.fillRect(hall.x + 98, hall.y, 36, 52);
    gfx.fillStyle(0xb87820, 1);
    gfx.fillTriangle(
      hall.x + 98,  hall.y + 52,
      hall.x + 116, hall.y + 36,
      hall.x + 134, hall.y + 52,
    );
    gfx.fillStyle(0xd9b35b, 1);
    gfx.fillRect(hall.x + hall.width - 100, hall.y, 36, 52);
    gfx.fillStyle(0xb87820, 1);
    gfx.fillTriangle(
      hall.x + hall.width - 100, hall.y + 52,
      hall.x + hall.width - 82,  hall.y + 36,
      hall.x + hall.width - 64,  hall.y + 52,
    );
    // Hall label
    this.add.text(hall.x + hall.width / 2, hall.y - 16, hallLabel, {
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

    // ── Fence posts along road (optional — omitted for large walled cities) ───
    if (fencePosts) {
      gfx.fillStyle(0x8a6840, 1);
      for (let x = fencePosts.startX; x < fencePosts.endX; x += fencePosts.step) {
        gfx.fillRect(x, fencePosts.y, 8, 30);
      }
    }

    // ── Optional large-scale features ────────────────────────────────────────
    const { mansion, cityGate, extraBuildings } = this.cfg.layout;
    if (mansion)  this.drawMansion(gfx, mansion);
    if (cityGate) this.drawCityGate(gfx, cityGate);
    if (extraBuildings) for (const b of extraBuildings) this.drawExtraBuilding(gfx, b);
  }

  private drawRoadsAndPaths(): void {
    const { road, lampPostsX, redFlowers, blueFlowers, barrels } = this.cfg.layout;
    const gfx = this.add.graphics();
    // Already drawn in drawGround — add some extra detail here
    // Flower patches between the road and inn/shop
    gfx.fillStyle(0xe87070, 1);
    for (const [fx, fy] of redFlowers)  gfx.fillCircle(fx, fy, 4);
    gfx.fillStyle(0x70a0e0, 1);
    for (const [fx, fy] of blueFlowers) gfx.fillCircle(fx, fy, 4);
    // Lamp posts — base Y is 60px above the road top edge
    const lampY = road.y - 60;
    gfx.fillStyle(0x6a5a30, 1);
    for (const lx of lampPostsX) {
      gfx.fillRect(lx, lampY, 8, 68);
      gfx.fillStyle(0xffe090, 0.9);
      gfx.fillCircle(lx + 4, lampY, 14);
      gfx.fillStyle(0x6a5a30, 1);
    }
    // Barrels near inn
    gfx.fillStyle(0x7a5a30, 1);
    for (const [bx, by] of barrels) gfx.fillCircle(bx, by, 14);
    gfx.lineStyle(2, 0x5a3a18, 1);
    for (const [bx, by] of barrels) gfx.strokeCircle(bx, by, 14);

    // ── Optional city features ─────────────────────────────────────────────
    const { additionalRoads, lampPosts: absLamps, trees, marketStalls, fountain } = this.cfg.layout;
    if (additionalRoads) {
      for (const r of additionalRoads) {
        gfx.fillStyle(0x8a7c6a, 1);
        gfx.fillRect(r.x, r.y, r.width, r.height);
        gfx.lineStyle(1, 0x7a6e5e, 0.4);
        for (let tx = r.x + 20; tx < r.x + r.width; tx += 48) {
          gfx.beginPath(); gfx.moveTo(tx, r.y); gfx.lineTo(tx, r.y + r.height); gfx.strokePath();
        }
      }
    }
    if (absLamps) {
      gfx.fillStyle(0x6a5a30, 1);
      for (const [lx, ly] of absLamps) {
        gfx.fillRect(lx - 4, ly, 8, 68);
        gfx.fillStyle(0xffe090, 0.9);
        gfx.fillCircle(lx, ly, 14);
        gfx.fillStyle(0x6a5a30, 1);
      }
    }
    if (trees)       for (const [tx, ty] of trees) this.drawTree(gfx, tx, ty);
    if (marketStalls) marketStalls.forEach(([sx, sy], i) => this.drawMarketStall(gfx, sx, sy, i));
    if (fountain)    this.drawFountain(gfx, fountain.x, fountain.y);
  }

  private drawMansion(
    gfx: Phaser.GameObjects.Graphics,
    m: { x: number; y: number; width: number; height: number; label: string },
  ): void {
    // Foundation shadow
    gfx.fillStyle(0x2a1a08, 0.5);
    gfx.fillRect(m.x - 6, m.y + m.height, m.width + 12, 20);
    // Main body — pale sandstone
    gfx.fillStyle(0xd0c090, 1);
    gfx.fillRect(m.x, m.y, m.width, m.height);
    // Horizontal stone coursing
    gfx.lineStyle(1, 0xb8a870, 0.5);
    for (let ry = m.y + 40; ry < m.y + m.height; ry += 40) {
      gfx.beginPath(); gfx.moveTo(m.x, ry); gfx.lineTo(m.x + m.width, ry); gfx.strokePath();
    }
    // Grand peaked central roof
    gfx.fillStyle(0x8a6a40, 1);
    gfx.fillTriangle(m.x - 24, m.y, m.x + m.width / 2, m.y - 100, m.x + m.width + 24, m.y);
    gfx.fillStyle(0x6a4a20, 1);
    gfx.fillRect(m.x - 24, m.y - 8, m.width + 48, 16);
    // Corner turrets
    for (const tx of [m.x - 28, m.x + m.width - 28]) {
      gfx.fillStyle(0xc8b888, 1);
      gfx.fillRect(tx, m.y - 70, 56, m.height + 70);
      gfx.fillStyle(0x7a5a30, 1);
      gfx.fillTriangle(tx, m.y - 70, tx + 28, m.y - 118, tx + 56, m.y - 70);
      gfx.fillStyle(0xb0c8d8, 0.8);
      gfx.fillRect(tx + 12, m.y - 38, 32, 28);
      gfx.fillStyle(0xb0c8d8, 0.8);
      gfx.fillCircle(tx + 28, m.y - 38, 16);
    }
    // Portico entablature and columns
    const doorCX = m.x + m.width / 2;
    const porticoW = 300;
    gfx.fillStyle(0xe0d4a0, 1);
    gfx.fillRect(doorCX - porticoW / 2 - 8, m.y + 60, porticoW + 16, 20);
    gfx.fillStyle(0xe8dcc0, 1);
    for (let i = 0; i <= 4; i++) {
      gfx.fillRect(doorCX - porticoW / 2 + i * (porticoW / 4) - 10, m.y + 80, 20, m.height - 80);
    }
    // Grand double door
    const doorY = m.y + m.height - 110;
    gfx.fillStyle(0x5a3a18, 1);
    gfx.fillRect(doorCX - 40, doorY, 80, 110);
    gfx.fillStyle(0x3a2008, 1);
    gfx.fillCircle(doorCX, doorY, 40);
    gfx.lineStyle(2, 0x8a6030, 0.8);
    gfx.strokeRect(doorCX - 36, doorY + 6, 32, 64);
    gfx.strokeRect(doorCX + 4,  doorY + 6, 32, 64);
    // Large arched windows (two pairs flanking portico)
    gfx.fillStyle(0xb0c8e0, 0.8);
    for (const wx of [m.x + 80, m.x + 200, m.x + m.width - 260, m.x + m.width - 140]) {
      gfx.fillRect(wx, m.y + 50, 70, 90);
      gfx.fillStyle(0xb0c8e0, 0.8);
      gfx.fillCircle(wx + 35, m.y + 50, 35);
      gfx.lineStyle(1, 0x8aaabb, 0.6);
      gfx.strokeRect(wx, m.y + 50, 70, 90);
      gfx.fillStyle(0xb0c8e0, 0.8);
    }
    // Gold crest above door arch
    gfx.fillStyle(0xd9b35b, 1);
    gfx.fillCircle(doorCX, m.y + 36, 18);
    gfx.fillStyle(0xb87820, 1);
    gfx.fillCircle(doorCX, m.y + 36, 11);
    // Flanking banners
    for (const bx of [doorCX - 170, doorCX + 130]) {
      gfx.fillStyle(0xd9b35b, 1);
      gfx.fillRect(bx, m.y, 40, 65);
      gfx.fillStyle(0xb87820, 1);
      gfx.fillTriangle(bx, m.y + 65, bx + 20, m.y + 47, bx + 40, m.y + 65);
    }
    // Label
    this.add.text(m.x + m.width / 2, m.y - 18, m.label, {
      fontFamily: FONTS.title,
      fontSize:   '24px',
      fontStyle:  'bold',
      color:      COLOR_HEX.goldAccent,
      stroke:     '#0a0f1a',
      strokeThickness: 4,
    }).setOrigin(0.5, 1);
  }

  private drawCityGate(
    gfx: Phaser.GameObjects.Graphics,
    gate: { wallY: number; gateX: number; gateWidth: number },
  ): void {
    const { wallY, gateX, gateWidth } = gate;
    const cx = gateX + gateWidth / 2;
    // Gate towers flanking the opening
    gfx.fillStyle(0x5a4830, 1);
    gfx.fillRect(gateX - 48, wallY - 100, 48, 180);
    gfx.fillRect(gateX + gateWidth, wallY - 100, 48, 180);
    // Tower crenellations
    gfx.fillStyle(0x4a3820, 1);
    for (let bx = gateX - 44; bx < gateX - 4; bx += 14) gfx.fillRect(bx, wallY - 112, 10, 16);
    for (let bx = gateX + gateWidth + 4; bx < gateX + gateWidth + 46; bx += 14) gfx.fillRect(bx, wallY - 112, 10, 16);
    // Archway lintel
    gfx.fillStyle(0x6a5840, 1);
    gfx.fillRect(gateX - 8, wallY - 60, gateWidth + 16, 60);
    // Arch opening (simulate cut-out with road surface colour)
    gfx.fillStyle(0x8a7c6a, 1);
    gfx.fillRect(gateX + 12, wallY - 48, gateWidth - 24, 48);
    gfx.fillCircle(cx, wallY - 48, gateWidth / 2 - 12);
    // Keystone
    gfx.fillStyle(0x8a7060, 1);
    gfx.fillTriangle(cx - 14, wallY - 60, cx, wallY - 80, cx + 14, wallY - 60);
    // Gate label
    this.add.text(cx, wallY - 86, 'South Gate', {
      fontFamily: FONTS.ui,
      fontSize:   '14px',
      fontStyle:  'bold',
      color:      COLOR_HEX.goldAccent,
      stroke:     '#0a0f1a',
      strokeThickness: 2,
    }).setOrigin(0.5, 1);
  }

  private drawFountain(
    gfx: Phaser.GameObjects.Graphics,
    fx: number,
    fy: number,
  ): void {
    // Outer basin rim
    gfx.fillStyle(0x8a9aaa, 1);
    gfx.fillCircle(fx, fy, 62);
    // Water surface
    gfx.fillStyle(0x4880a8, 0.9);
    gfx.fillCircle(fx, fy, 54);
    // Inner raised basin
    gfx.fillStyle(0x6090b8, 1);
    gfx.fillCircle(fx, fy, 30);
    gfx.fillStyle(0x78b0d8, 0.85);
    gfx.fillCircle(fx, fy, 24);
    // Centre pillar and bowl
    gfx.fillStyle(0xa89870, 1);
    gfx.fillRect(fx - 6, fy - 44, 12, 52);
    gfx.fillCircle(fx, fy - 44, 12);
    gfx.fillRect(fx - 10, fy - 22, 20, 8);
    // Water ripple rings
    gfx.lineStyle(1, 0x90c8e8, 0.5);
    gfx.strokeCircle(fx, fy, 40);
    gfx.strokeCircle(fx, fy, 48);
    // Rim highlight
    gfx.lineStyle(2, 0xaabbc8, 0.8);
    gfx.strokeCircle(fx, fy, 62);
  }

  private drawTree(
    gfx: Phaser.GameObjects.Graphics,
    tx: number,
    ty: number,
  ): void {
    gfx.fillStyle(0x6a4a20, 1);
    gfx.fillRect(tx - 5, ty - 8, 10, 30);
    gfx.fillStyle(0x2e6028, 0.9);
    gfx.fillCircle(tx, ty - 30, 26);
    gfx.fillStyle(0x3a7834, 0.85);
    gfx.fillCircle(tx - 8, ty - 40, 18);
    gfx.fillStyle(0x4a9040, 0.8);
    gfx.fillCircle(tx + 6, ty - 42, 16);
    gfx.fillStyle(0x5aa850, 0.5);
    gfx.fillCircle(tx - 4, ty - 44, 10);
  }

  private drawMarketStall(
    gfx: Phaser.GameObjects.Graphics,
    sx: number,
    sy: number,
    colorIdx: number,
  ): void {
    const AWNING_COLORS = [0xe07040, 0x40a860, 0x4070c8, 0xc8a030, 0xa040a0, 0x4098a0];
    const aColor = AWNING_COLORS[colorIdx % AWNING_COLORS.length];
    // Legs
    gfx.fillStyle(0x7a5a28, 1);
    gfx.fillRect(sx - 26, sy, 6, 18);
    gfx.fillRect(sx + 20, sy, 6, 18);
    // Counter top
    gfx.fillStyle(0xc8a060, 1);
    gfx.fillRect(sx - 30, sy - 12, 60, 14);
    gfx.lineStyle(1, 0x9a7040, 0.8);
    gfx.strokeRect(sx - 30, sy - 12, 60, 14);
    // Awning
    gfx.fillStyle(aColor, 0.88);
    gfx.fillTriangle(sx - 36, sy - 12, sx, sy - 52, sx + 36, sy - 12);
    gfx.fillStyle(0xffffff, 0.18);
    gfx.fillTriangle(sx - 20, sy - 12, sx - 4, sy - 44, sx + 4,  sy - 44);
    gfx.fillTriangle(sx + 4,  sy - 12, sx + 12, sy - 36, sx + 20, sy - 12);
    gfx.lineStyle(1, 0x3a2808, 0.5);
    gfx.strokeTriangle(sx - 36, sy - 12, sx, sy - 52, sx + 36, sy - 12);
  }

  private drawExtraBuilding(
    gfx: Phaser.GameObjects.Graphics,
    b: { x: number; y: number; width: number; height: number; colorBody: number; colorRoof: number; label?: string; style?: string },
  ): void {
    // Foundation shadow
    gfx.fillStyle(0x3a2a10, 0.4);
    gfx.fillRect(b.x - 2, b.y + b.height, b.width + 4, 10);
    // Body
    gfx.fillStyle(b.colorBody, 1);
    gfx.fillRect(b.x, b.y, b.width, b.height);

    if (b.style === 'wide') {
      // Low-pitch roof — market halls and guild buildings
      const roofPeak = Math.round(b.height * 0.22);
      gfx.fillStyle(b.colorRoof, 1);
      gfx.fillTriangle(b.x - 8, b.y, b.x + b.width / 2, b.y - roofPeak, b.x + b.width + 8, b.y);
      gfx.fillStyle(0x3a2810, 1);
      gfx.fillRect(b.x - 8, b.y - 3, b.width + 16, 5);
      // Multiple evenly-spaced doorways
      const numDoors = Math.max(1, Math.floor(b.width / 90));
      const doorW    = Math.min(20, Math.round(b.width * 0.13));
      const doorH    = Math.min(48, b.height - 16);
      const spacing  = b.width / numDoors;
      for (let i = 0; i < numDoors; i++) {
        const doorCX = b.x + spacing * (i + 0.5);
        gfx.fillStyle(0x5a3818, 1);
        gfx.fillRect(doorCX - doorW, b.y + b.height - doorH, doorW * 2, doorH);
        gfx.fillStyle(0x3a2008, 1);
        gfx.fillCircle(doorCX, b.y + b.height - doorH, doorW);
      }
      // Flanking windows
      const winY = b.y + 12;
      const winH = Math.min(18, Math.round(b.height / 5));
      gfx.fillStyle(0xffd090, 0.75);
      gfx.fillRect(b.x + 8, winY, 22, winH);
      gfx.fillRect(b.x + b.width - 30, winY, 22, winH);
    } else {
      // Peaked roof — 'tall' uses a deeper peak, default/standard is shallower
      const peakRatio = b.style === 'tall' ? 0.46 : 0.34;
      const roofPeak  = Math.min(72, Math.round(b.height * peakRatio));
      gfx.fillStyle(b.colorRoof, 1);
      gfx.fillTriangle(b.x - 10, b.y, b.x + b.width / 2, b.y - roofPeak, b.x + b.width + 10, b.y);
      gfx.fillStyle(0x3a2810, 1);
      gfx.fillRect(b.x - 10, b.y - 3, b.width + 20, 6);
      // Door
      const doorCX = b.x + b.width / 2;
      const doorW  = Math.min(26, Math.round(b.width * 0.22));
      const doorH  = Math.min(56, b.height - 20);
      gfx.fillStyle(0x5a3818, 1);
      gfx.fillRect(doorCX - doorW, b.y + b.height - doorH, doorW * 2, doorH);
      gfx.fillStyle(0x3a2008, 1);
      gfx.fillCircle(doorCX, b.y + b.height - doorH, doorW);
      // Windows
      if (b.width >= 100) {
        const winY = b.y + 20;
        const winH = Math.min(20, Math.round(b.height / 4));
        gfx.fillStyle(0xffd090, 0.75);
        gfx.fillRect(b.x + 10,            winY, 26, winH);
        gfx.fillRect(b.x + b.width - 36,  winY, 26, winH);
        gfx.lineStyle(1, b.colorBody, 0.9);
        gfx.beginPath();
        gfx.moveTo(b.x + 23, winY);            gfx.lineTo(b.x + 23,            winY + winH);
        gfx.moveTo(b.x + 10, winY + winH / 2); gfx.lineTo(b.x + 36,            winY + winH / 2);
        gfx.moveTo(b.x + b.width - 23, winY);  gfx.lineTo(b.x + b.width - 23,  winY + winH);
        gfx.moveTo(b.x + b.width - 36, winY + winH / 2); gfx.lineTo(b.x + b.width - 10, winY + winH / 2);
        gfx.strokePath();
      }
    }
    if (b.label) {
      this.add.text(b.x + b.width / 2, b.y - 8, b.label, {
        fontFamily: FONTS.ui,
        fontSize:   '11px',
        color:      COLOR_HEX.goldAccent,
        stroke:     '#0a0f1a',
        strokeThickness: 2,
      }).setOrigin(0.5, 1);
    }
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

    // Destroy any previously drawn NPC/sign visuals so a redraw (after a
    // hideWhenFlag-gated recruit joins) does not leave stale sprites behind.
    for (const obj of this.interactableVisuals) obj.destroy();
    this.interactableVisuals = [];

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
    this.interactableVisuals.push(gfx);

    const label = this.add.text(cx, cy - 36, '!', {
      fontFamily: FONTS.ui, fontSize: '13px', fontStyle: 'bold',
      color: COLOR_HEX.goldAccent, stroke: '#0a0f1a', strokeThickness: 2,
    }).setOrigin(0.5, 1);
    this.interactableVisuals.push(label);
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
    this.interactableVisuals.push(gfx);

    // Name initial label
    const label = this.add.text(cx, cy - 42, initial, {
      fontFamily: FONTS.ui,
      fontSize:   '14px',
      fontStyle:  'bold',
      color:      COLOR_HEX.parchment,
      stroke:     '#0a0f1a',
      strokeThickness: 2,
    }).setOrigin(0.5, 1);
    this.interactableVisuals.push(label);
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
    this.keyMenu  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.keyWASD  = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
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
    // Save is only allowed from the menu when the player is standing near a valid
    // save point. The same activeInteractable that shows the HUD hint drives this.
    const canSave = this.activeInteractable?.type === 'save_crystal'
                 || this.activeInteractable?.type === 'building_inn';
    this.scene.launch(SCENE_KEYS.GAME_MENU, { canSave });
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
      // Translate those effects into scene-level consequences: refresh NPC
      // visuals for any hideWhenFlag change, show a join banner on recruit.
      this.handlePostDialogueEffects(seq);
      this.dialogueActive      = false;
      // Require Space to be physically released before another interaction can
      // fire — prevents the closing keypress from immediately retriggering.
      this.interactionCooldown = true;
      onComplete?.();
    });

    this.scene.launch(SCENE_KEYS.DIALOGUE_OVERLAY, { sequence });
    this.scene.bringToTop(SCENE_KEYS.DIALOGUE_OVERLAY);
  }

  /**
   * Data-driven post-dialogue scene reactions.
   * Runs AFTER runEffects() has applied state mutations — so story flags and
   * party activations are already in effect.
   *
   * • any `set_flag` effect     → redraw NPC/sign placeholders so newly-hidden
   *                               recruitables disappear immediately.
   * • each `activate_party_member` effect → show a short "X joined the party."
   *                               banner. Works for Serelle, Kael, or any
   *                               future recruitable — the memberId is looked
   *                               up in state-selectors, no hardcoded names.
   */
  private handlePostDialogueEffects(
    seq: import('../../dialogue/dialogue-types').DialogueSequence,
  ): void {
    const effects = seq.onComplete;
    if (!effects || effects.length === 0) return;

    let refreshedVisuals = false;
    for (const effect of effects) {
      if (effect.type === 'set_flag' && !refreshedVisuals) {
        this.drawNPCPlaceholders();
        refreshedVisuals = true;
      }
      if (effect.type === 'activate_party_member') {
        const name = getPartyMember(effect.memberId)?.name ?? 'A new companion';
        this.showJoinBanner(`${name} joined the party.`);
      }
    }
  }

  /**
   * Short gold-accent confirmation banner shown at the top of the viewport.
   * Fades out on its own and destroys all its game objects — safe to fire
   * multiple times in sequence (each call owns its own graphics + text).
   */
  private showJoinBanner(message: string): void {
    const BW = 460;
    const BH = 62;
    const BX = (GAME_WIDTH - BW) / 2;
    const BY = 96;

    const bg = drawPanel(this, { x: BX, y: BY, width: BW, height: BH });
    bg.setScrollFactor(0).setDepth(180);

    const txt = this.add.text(GAME_WIDTH / 2, BY + BH / 2, message, {
      fontFamily: FONTS.title,
      fontSize:   '22px',
      fontStyle:  'bold',
      color:      COLOR_HEX.goldAccent,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(181);

    this.tweens.add({
      targets:  [bg, txt],
      alpha:    { from: 1, to: 0 },
      delay:    1700,
      duration: 500,
      onComplete: () => {
        bg.destroy();
        txt.destroy();
      },
    });
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
  // State sync — records the player's in-town position in GameState so a save
  // taken here resumes inside this town at this spot (not at the world-map
  // coords the entry trigger wrote). Stored as CENTER to match the global
  // convention documented in scene-router.ts.
  // ─────────────────────────────────────────────────────────────────────────

  private writeCurrentLocation(): void {
    setCurrentLocation({
      locationId: this.currentLocationId,
      x: Math.round(this.px + PLAYER_W / 2),
      y: Math.round(this.py + PLAYER_H / 2),
    });
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
