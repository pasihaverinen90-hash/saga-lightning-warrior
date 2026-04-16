// src/game/core/scenes/BootScene.ts
// First scene to run. Sets up any global game settings then moves to PreloadScene.
// Keep this minimal — no asset loading here.

import Phaser from 'phaser';
import { SCENE_KEYS } from '../scene-keys';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.BOOT });
  }

  create(): void {
    // Any one-time global setup goes here in the future.
    // For now, immediately proceed to preload.
    this.scene.start(SCENE_KEYS.PRELOAD);
  }
}
