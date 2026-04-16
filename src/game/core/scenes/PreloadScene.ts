// src/game/core/scenes/PreloadScene.ts
// Loads all game assets before TitleScene starts.
// All placeholder visuals are drawn at runtime using Phaser graphics primitives,
// so no assets are loaded yet. This is the correct hook for future sprite/audio loading.

import Phaser from 'phaser';
import { SCENE_KEYS } from '../scene-keys';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, COLOR_HEX, FONTS, FONT_SIZES } from '../config';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.PRELOAD });
  }

  preload(): void {
    this.createLoadingBar();

    // ── Game assets ───────────────────────────────────────────────────────────
    // Damage digit sprite sheet — 10 frames (0–9), fire-styled, 154×1024 per frame.
    this.load.spritesheet('damage-digits', 'assets/images/damage-digits.png', {
      frameWidth:  154,
      frameHeight: 1024,
    });
    // Healing digit sprite sheet — 10 frames (0–9), green glow, 154×1024 per frame.
    this.load.spritesheet('heal-digits', 'assets/images/heal-digits.png', {
      frameWidth:  154,
      frameHeight: 1024,
    });
    // Dialogue box background art — 1536×1024 RGBA, displayed at 1200×521.
    // Includes the portrait oval frame (left) and text area (right).
    // All dialogue text is rendered by code on top.
    this.load.image('dialogue-box', 'assets/ui/dialogue-box.png');
    // Result panel background — 1536×1024 RGBA, displayed at 920×613.
    // Text is rendered by code on top; this is decorative background art only.
    this.load.image('result-panel', 'assets/ui/result-panel.png');
    // Command button art — four visual states, 624×256 px source each.
    // Labels are rendered in code on top; these are background art only.
    this.load.image('btn-normal',   'assets/ui/btn-normal.png');
    this.load.image('btn-selected', 'assets/ui/btn-selected.png');
    this.load.image('btn-disabled', 'assets/ui/btn-disabled.png');
    this.load.image('btn-pressed',  'assets/ui/btn-pressed.png');
    // ─────────────────────────────────────────────────────────────────────────
  }

  create(): void {
    this.scene.start(SCENE_KEYS.TITLE);
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private createLoadingBar(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Background fill
    this.cameras.main.setBackgroundColor('#0a0f1a');

    // "Loading…" label
    this.add.text(cx, cy - 48, 'Loading...', {
      fontFamily: FONTS.ui,
      fontSize: `${FONT_SIZES.menuButton}px`,
      color: COLOR_HEX.parchment,
    }).setOrigin(0.5);

    // Bar track
    const barW = 400;
    const barH = 20;
    const barX = cx - barW / 2;
    const barY = cy - 10;

    this.add.rectangle(cx, cy + 10, barW + 6, barH + 6, COLORS.panelBorder)
      .setOrigin(0.5);
    this.add.rectangle(cx, cy + 10, barW, barH, COLORS.navyDeep)
      .setOrigin(0.5);

    // Fill bar driven by Phaser's load progress event
    const fill = this.add.rectangle(barX, barY, 0, barH, COLORS.goldAccent)
      .setOrigin(0, 0);

    this.load.on('progress', (value: number) => {
      fill.width = barW * value;
    });
  }
}
