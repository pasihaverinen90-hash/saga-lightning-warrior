// src/game/world/scenes/WorldMapScene.ts
// World map exploration: movement, collision, zone tracking, trigger
// interaction, and step-based random encounters.
//
// Architecture:
//   Rendering         → world/systems/world-renderer.ts (data-driven)
//   Movement math     → shared/movement-system.ts        (pure TS, no Phaser)
//   Trigger logic     → world/systems/transition-system.ts (pure TS)
//   Zone / encounter  → world/systems/encounter-system.ts  (pure TS)
//   Scripted battles  → trigger.scriptedBattle data        (flag-gated, data-driven)
//   Map data          → data/maps/elerion-world-config.ts

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
import { ELERION_WORLD_CONFIG } from '../../data/maps/elerion-world-config';
import { renderWorld } from '../systems/world-renderer';
import { setCurrentLocation } from '../../state/state-actions';
import { getStoryFlag } from '../../state/state-selectors';
import type { WorldTrigger, WorldZone, WorldMapInitData } from '../types/world-types';
import { PLAYER_W, PLAYER_H } from '../../shared/constants/player';
import type { BattleInitData } from '../../battle/engine/battle-types';

// ─── Constants ────────────────────────────────────────────────────────────────

const CFG = ELERION_WORLD_CONFIG;
const MAP_W = CFG.mapWidth;
const MAP_H = CFG.mapHeight;

const PLAYER_SPEED = 200; // px/sec

// locationId recorded in game state while the player is walking the overworld.
// Town entrances overwrite this with their own locationId on trigger activation.
const WORLD_LOCATION_ID = 'world_map';

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
  private encounterTracker  = new EncounterTracker(6);

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
    this.activeTrigger     = null;
    this.activeZone        = null;
    this.previousZoneId    = null;
    this.encounterTracker.onBattleFired();
  }

  // ─── create ───────────────────────────────────────────────────────────────

  create(): void {
    // Outside the painted map the camera should show a dark void — but with
    // setBounds the camera never leaves the map, so this is a safety default.
    this.cameras.main.setBackgroundColor('#0a0f1a');
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.fadeIn(350, 0, 0, 0);

    // Data-driven world paint — terrain, rivers, roads, landmarks.
    renderWorld(this, CFG);
    // Trigger markers and active-trigger label depend on story flags, so they
    // stay in the scene rather than the (pure) renderer module.
    this.drawTriggerMarkers();

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
        locationId: WORLD_LOCATION_ID,
        x: Math.round(this.px + PLAYER_W / 2),
        y: Math.round(this.py + PLAYER_H / 2),
      });
    }

    this.activeTrigger = getActiveTrigger(
      this.px, this.py, PLAYER_W, PLAYER_H,
      CFG.triggers.filter(t => !this.isTriggerConsumed(t)),
    );
    this.activeZone = getActiveZone(this.px, this.py, PLAYER_W, PLAYER_H, CFG.zones);

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
  // Trigger markers (drawn over the renderer's landmarks)
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

      gfx.fillStyle(color, 0.20);
      gfx.fillRoundedRect(trigger.x, trigger.y, trigger.width, trigger.height, 4);
      gfx.lineStyle(2, color, 0.65);
      gfx.strokeRoundedRect(trigger.x, trigger.y, trigger.width, trigger.height, 4);

      this.add.text(
        trigger.x + trigger.width / 2,
        trigger.y - 4,
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
    g.fillStyle(0x2a2818, 0.45);
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
    const W = 240; const H = 38;
    const X = 16;  const Y = 16;

    this.hudZonePanel = drawPanel(this, { x: X, y: Y, width: W, height: H });
    this.hudZonePanel.setScrollFactor(0).setDepth(100);

    this.hudZoneText = this.add.text(X + 14, Y + H / 2, 'Elerion', {
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
    const zoneName    = this.activeZone?.displayName ?? 'Elerion';
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
