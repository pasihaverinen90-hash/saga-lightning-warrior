// src/game/ui/title/TitleScene.ts
// Title screen: gradient sky background, game logo, New Game / Load Game buttons.
// Keyboard-only navigation (Up/Down to select, Enter/Space to confirm).
// Load Game is disabled and dimmed when no save data exists.
// When a save exists, a slot info line shows the location and elapsed time.

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
import { hasSaveData, loadGame, getSaveMeta } from '../../save/save-service';
import { initNewGame } from '../../state/state-actions';
import { getState } from '../../state/game-state';
import { getResumeScene } from '../../core/scene-router';
import { LOCATIONS } from '../../data/maps/locations';
import { formatElapsedTime } from '../../core/utils';

// ─── Menu item definition ─────────────────────────────────────────────────────

interface MenuItem {
  label: string;
  enabled: boolean;
  action: () => void;
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const BUTTON_WIDTH = 300;
const BUTTON_HEIGHT = 58;
const BUTTON_GAP = 16;
// First button Y position (center of button) — ~60% down the screen
const BUTTON_START_Y = GAME_HEIGHT * 0.60;

export class TitleScene extends Phaser.Scene {
  private menuItems: MenuItem[] = [];
  private selectedIndex = 0;

  // Phaser objects for each button (parallel arrays to menuItems)
  private buttonBgs: Phaser.GameObjects.Graphics[] = [];
  private buttonTexts: Phaser.GameObjects.Text[] = [];

  // Keyboard cursors
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyEnter!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

  // Input debounce — prevents repeated triggers on held keys
  private inputCooldown = false;

  constructor() {
    super({ key: SCENE_KEYS.TITLE });
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  create(): void {
    this.selectedIndex = 0;
    this.buttonBgs = [];
    this.buttonTexts = [];
    this.inputCooldown = false;

    this.buildMenuItems();
    this.drawBackground();
    this.drawTitleText();
    this.drawSubtitle();
    this.drawButtons();
    this.drawSaveInfo();
    this.setupInput();
    this.refreshButtonVisuals();
  }

  update(): void {
    this.handleMenuInput();
  }

  // ─── Menu setup ────────────────────────────────────────────────────────────

  private buildMenuItems(): void {
    const saveExists = hasSaveData();

    this.menuItems = [
      {
        label: 'New Game',
        enabled: true,
        action: () => this.startNewGame(),
      },
      {
        label: 'Load Game',
        enabled: saveExists,
        action: () => this.loadSavedGame(),
      },
    ];

    // Default selection: first enabled item
    this.selectedIndex = this.menuItems.findIndex(item => item.enabled);
    if (this.selectedIndex === -1) this.selectedIndex = 0;
  }

  // ─── Background ────────────────────────────────────────────────────────────

  private drawBackground(): void {
    // Sky gradient — layered rectangles from deep navy to lighter horizon blue
    const skyTop = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.65, 0x0d1a2e)
      .setOrigin(0, 0);
    const skyMid = this.add.rectangle(0, GAME_HEIGHT * 0.35, GAME_WIDTH, GAME_HEIGHT * 0.30, 0x1a3050)
      .setOrigin(0, 0);
    const ground = this.add.rectangle(0, GAME_HEIGHT * 0.65, GAME_WIDTH, GAME_HEIGHT * 0.35, 0x0f1e14)
      .setOrigin(0, 0);

    // Distant mountain silhouettes
    const gfx = this.add.graphics();

    // Far mountains (dark, desaturated)
    gfx.fillStyle(0x1a2e1c, 1);
    gfx.fillTriangle(160, 465, 320, 280, 480, 465);
    gfx.fillTriangle(300, 465, 500, 230, 700, 465);
    gfx.fillTriangle(600, 465, 820, 260, 1040, 465);
    gfx.fillTriangle(900, 465, 1080, 290, 1280, 465);

    // Near treeline
    gfx.fillStyle(0x0d1a10, 1);
    for (let tx = -20; tx < GAME_WIDTH + 40; tx += 48) {
      const h = 60 + Math.sin(tx * 0.07) * 20;
      gfx.fillTriangle(tx, 500, tx + 24, 500 - h, tx + 48, 500);
    }

    // Ground band fill (cover triangle gaps)
    gfx.fillStyle(0x0f1e14, 1);
    gfx.fillRect(0, 500, GAME_WIDTH, GAME_HEIGHT);

    // Subtle star field — small bright dots in upper sky
    gfx.fillStyle(0xffffff, 0.6);
    const starPositions = [
      [110, 60], [230, 45], [390, 90], [510, 35], [650, 70],
      [780, 50], [900, 85], [1040, 42], [1160, 68], [1240, 95],
      [180, 130], [440, 115], [720, 140], [960, 120], [1100, 150],
      [80, 170], [340, 180], [580, 160], [820, 195], [1200, 175],
    ];
    for (const [sx, sy] of starPositions) {
      gfx.fillRect(sx, sy, 2, 2);
    }

    // Lightning accent — faint bolt shape near title area
    const bolt = this.add.graphics();
    bolt.lineStyle(2, COLORS.lightningYellow, 0.18);
    bolt.beginPath();
    bolt.moveTo(GAME_WIDTH / 2 - 18, 100);
    bolt.lineTo(GAME_WIDTH / 2 - 6, 138);
    bolt.lineTo(GAME_WIDTH / 2 + 4, 138);
    bolt.lineTo(GAME_WIDTH / 2 - 8, 176);
    bolt.strokePath();

    // Silence TS "no-unused" for purely visual objects
    void skyTop;
    void skyMid;
    void ground;
  }

  // ─── Title text ────────────────────────────────────────────────────────────

  private drawTitleText(): void {
    const cx = GAME_WIDTH / 2;
    // Top of title ~22% down
    const titleY = GAME_HEIGHT * 0.24;

    // Shadow layer (offset dark text behind main text)
    this.add.text(cx + 3, titleY + 3, 'Saga of the', {
      fontFamily: FONTS.title,
      fontSize: `${FONT_SIZES.titleLogo * 0.52}px`,
      color: '#0a0f1a',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    this.add.text(cx + 3, titleY + 46, 'Lightning Warrior', {
      fontFamily: FONTS.title,
      fontSize: `${FONT_SIZES.titleLogo}px`,
      color: '#0a0f1a',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    // Main title text
    this.add.text(cx, titleY, 'Saga of the', {
      fontFamily: FONTS.title,
      fontSize: `${FONT_SIZES.titleLogo * 0.52}px`,
      color: COLOR_HEX.parchment,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    const mainTitle = this.add.text(cx, titleY + 46, 'Lightning Warrior', {
      fontFamily: FONTS.title,
      fontSize: `${FONT_SIZES.titleLogo}px`,
      color: COLOR_HEX.lightningYellow,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    // Gold underline accent below the main title
    const lineY = mainTitle.y + mainTitle.height + 6;
    const lineW = mainTitle.width * 0.75;
    const lineGfx = this.add.graphics();
    lineGfx.lineStyle(3, COLORS.goldAccent, 0.85);
    lineGfx.beginPath();
    lineGfx.moveTo(cx - lineW / 2, lineY);
    lineGfx.lineTo(cx + lineW / 2, lineY);
    lineGfx.strokePath();

    void lineGfx;
  }

  // ─── Subtitle ──────────────────────────────────────────────────────────────

  private drawSubtitle(): void {
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.51, 'v0.1  —  Prototype', {
      fontFamily: FONTS.ui,
      fontSize: `${FONT_SIZES.subtitle}px`,
      color: COLOR_HEX.textSecondary,
    }).setOrigin(0.5);
  }

  // ─── Buttons ───────────────────────────────────────────────────────────────

  private drawButtons(): void {
    const cx = GAME_WIDTH / 2;

    this.menuItems.forEach((item, index) => {
      const buttonY = BUTTON_START_Y + index * (BUTTON_HEIGHT + BUTTON_GAP);

      // Background panel — drawn/updated in refreshButtonVisuals()
      const bg = this.add.graphics();
      this.buttonBgs.push(bg);

      // Label text
      const label = this.add.text(cx, buttonY, item.label, {
        fontFamily: FONTS.ui,
        fontSize: `${FONT_SIZES.menuButton}px`,
        fontStyle: 'bold',
        color: item.enabled ? COLOR_HEX.parchment : COLOR_HEX.textDisabled,
      }).setOrigin(0.5);

      if (!item.enabled) label.setAlpha(0.5);

      this.buttonTexts.push(label);
    });
  }

  // ─── Visual refresh ────────────────────────────────────────────────────────

  private refreshButtonVisuals(): void {
    const cx = GAME_WIDTH / 2;

    this.menuItems.forEach((item, index) => {
      const bg = this.buttonBgs[index];
      const label = this.buttonTexts[index];
      const buttonY = BUTTON_START_Y + index * (BUTTON_HEIGHT + BUTTON_GAP);
      const bx = cx - BUTTON_WIDTH / 2;
      const by = buttonY - BUTTON_HEIGHT / 2;
      const isSelected = index === this.selectedIndex;

      bg.clear();

      if (isSelected && item.enabled) {
        // Selected state
        bg.fillStyle(COLORS.selectionFill, 1);
        bg.fillRoundedRect(bx, by, BUTTON_WIDTH, BUTTON_HEIGHT, PANEL.cornerRadius);
        bg.lineStyle(PANEL.borderWidth, COLORS.selectionBorder, 1);
        bg.strokeRoundedRect(bx, by, BUTTON_WIDTH, BUTTON_HEIGHT, PANEL.cornerRadius);
        label.setColor(COLOR_HEX.parchment);
        label.setAlpha(1);
      } else {
        // Default / unselected state
        bg.fillStyle(COLORS.panelBg, PANEL.alpha);
        bg.fillRoundedRect(bx, by, BUTTON_WIDTH, BUTTON_HEIGHT, PANEL.cornerRadius);
        bg.lineStyle(PANEL.borderWidth, COLORS.panelBorder, item.enabled ? 1 : 0.4);
        bg.strokeRoundedRect(bx, by, BUTTON_WIDTH, BUTTON_HEIGHT, PANEL.cornerRadius);
        label.setColor(item.enabled ? COLOR_HEX.parchment : COLOR_HEX.textDisabled);
        label.setAlpha(item.enabled ? 1 : 0.5);
      }
    });
  }

  // ─── Input ─────────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyEnter = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  private handleMenuInput(): void {
    if (this.inputCooldown) return;

    const upPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up);
    const downPressed = Phaser.Input.Keyboard.JustDown(this.cursors.down);
    const confirmPressed =
      Phaser.Input.Keyboard.JustDown(this.keyEnter) ||
      Phaser.Input.Keyboard.JustDown(this.keySpace);

    if (upPressed) {
      this.moveSelection(-1);
    } else if (downPressed) {
      this.moveSelection(1);
    } else if (confirmPressed) {
      this.confirmSelection();
    }
  }

  private moveSelection(direction: -1 | 1): void {
    const count = this.menuItems.length;
    let next = this.selectedIndex;

    // Skip disabled items
    for (let i = 0; i < count; i++) {
      next = (next + direction + count) % count;
      if (this.menuItems[next].enabled) break;
    }

    if (next !== this.selectedIndex) {
      this.selectedIndex = next;
      this.refreshButtonVisuals();
    }
  }

  private confirmSelection(): void {
    const item = this.menuItems[this.selectedIndex];
    if (!item.enabled) return;

    // Brief cooldown to prevent double-trigger
    this.inputCooldown = true;
    this.time.delayedCall(200, () => { this.inputCooldown = false; });

    item.action();
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  private startNewGame(): void {
    initNewGame();
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENE_KEYS.WORLD_MAP);
    });
  }

  private loadSavedGame(): void {
    const success = loadGame();
    if (!success) return;

    // Determine the correct scene and position from the loaded state.
    const target = getResumeScene(getState());

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(target.sceneKey, target.initData);
    });
  }

  // ─── Save slot info ────────────────────────────────────────────────────────
  // Shown below the button stack when a valid save exists.

  private drawSaveInfo(): void {
    const meta = getSaveMeta();
    if (!meta) return;

    const locationName = LOCATIONS[meta.locationId]?.displayName ?? 'Unknown';
    const elapsed      = formatElapsedTime(meta.timestamp);

    // Position: just below the last button
    const lastButtonCenterY =
      BUTTON_START_Y + (this.menuItems.length - 1) * (BUTTON_HEIGHT + BUTTON_GAP);
    const textY = lastButtonCenterY + BUTTON_HEIGHT / 2 + 28;

    // Small separator line
    const lineGfx = this.add.graphics();
    lineGfx.lineStyle(1, COLORS.panelBorder, 0.3);
    lineGfx.beginPath();
    lineGfx.moveTo(GAME_WIDTH / 2 - 120, textY - 10);
    lineGfx.lineTo(GAME_WIDTH / 2 + 120, textY - 10);
    lineGfx.strokePath();

    // Save slot text
    this.add.text(
      GAME_WIDTH / 2,
      textY,
      `↩  ${locationName}  ·  ${elapsed}`,
      {
        fontFamily: FONTS.ui,
        fontSize:   '15px',
        fontStyle:  'italic',
        color:      COLOR_HEX.textSecondary,
      },
    ).setOrigin(0.5, 0);
  }
}
