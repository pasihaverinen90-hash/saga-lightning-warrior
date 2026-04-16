// src/game/core/config.ts
// Central game configuration. All layout, color, and font constants live here.

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// ─── Color Palette ───────────────────────────────────────────────────────────
export const COLORS = {
  // Panels
  panelBg: 0x14233b,
  panelBorder: 0xd9b35b,
  panelHighlight: 0x324f78,

  // Primary palette
  fantasyBlue: 0x2c4e86,
  navyDeep: 0x14233b,

  // Text
  parchment: 0xf3ebd2,
  textSecondary: 0xd6d1c1,
  textDisabled: 0x888888,

  // Accents
  goldAccent: 0xd9b35b,
  iceBlue: 0x8fc8ff,
  lightningYellow: 0xe8d25f,
  dangerCrimson: 0xa84747,
  successGreen: 0x5e9b63,

  // Character name colors
  hugoName: 0xe8d25f,
  serelleName: 0x8fc8ff,
  villainName: 0xd97a7a,

  // Selection
  selectionFill: 0x2c4e86,
  selectionBorder: 0x8fc8ff,
} as const;

// CSS hex strings for Phaser Text styles
export const COLOR_HEX = {
  parchment: '#F3EBD2',
  textSecondary: '#D6D1C1',
  textDisabled: '#888888',
  goldAccent: '#D9B35B',
  iceBlue: '#8FC8FF',
  lightningYellow: '#E8D25F',
  panelBg: '#14233B',
  hugoName: '#E8D25F',
  serelleName: '#8FC8FF',
  villainName: '#D97A7A',
} as const;

// ─── Fonts ───────────────────────────────────────────────────────────────────
export const FONTS = {
  title: 'Georgia, "Times New Roman", serif',
  ui: '"Trebuchet MS", Arial, sans-serif',
} as const;

export const FONT_SIZES = {
  titleLogo: 64,
  subtitle: 22,
  menuButton: 28,
  dialogueSpeaker: 24,
  dialogueBody: 24,
  battleCommand: 26,
  hpMp: 20,
  locationLabel: 18,
  hint: 16,
  debug: 14,
} as const;

// ─── Panel defaults ───────────────────────────────────────────────────────────
export const PANEL = {
  alpha: 0.92,
  borderWidth: 3,
  cornerRadius: 6,
} as const;

// ─── Phaser game config (used in main.ts) ─────────────────────────────────────
import Phaser from 'phaser';

export const PHASER_CONFIG_BASE: Omit<Phaser.Types.Core.GameConfig, 'scene'> = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0a0f1a',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: false,
    pixelArt: false,
  },
};
