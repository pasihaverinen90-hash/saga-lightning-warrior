// src/game/ui/common/panel.ts
// Reusable Phaser graphics helpers for drawing fantasy panels.
// All scenes that need a bordered panel should use these functions
// rather than re-implementing the same graphics logic.

import Phaser from 'phaser';
import { COLORS, PANEL } from '../../core/config';

export interface PanelOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor?: number;
  fillAlpha?: number;
  borderColor?: number;
  borderWidth?: number;
  radius?: number;
}

/**
 * Draws a rounded fantasy panel (fill + border) onto a Graphics object.
 * Returns the Graphics object so callers can add it to a Container if needed.
 */
export function drawPanel(
  scene: Phaser.Scene,
  opts: PanelOptions
): Phaser.GameObjects.Graphics {
  const {
    x, y, width, height,
    fillColor = COLORS.panelBg,
    fillAlpha = PANEL.alpha,
    borderColor = COLORS.panelBorder,
    borderWidth = PANEL.borderWidth,
    radius = PANEL.cornerRadius,
  } = opts;

  const gfx = scene.add.graphics();

  // Fill
  gfx.fillStyle(fillColor, fillAlpha);
  gfx.fillRoundedRect(x, y, width, height, radius);

  // Border
  gfx.lineStyle(borderWidth, borderColor, 1);
  gfx.strokeRoundedRect(x, y, width, height, radius);

  return gfx;
}

/**
 * Draws a highlighted selection row (used in menus and command lists).
 */
export function drawSelectionRow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number
): Phaser.GameObjects.Graphics {
  const gfx = scene.add.graphics();
  gfx.fillStyle(COLORS.selectionFill, 1);
  gfx.fillRoundedRect(x, y, width, height, 4);
  gfx.lineStyle(2, COLORS.selectionBorder, 1);
  gfx.strokeRoundedRect(x, y, width, height, 4);
  return gfx;
}
