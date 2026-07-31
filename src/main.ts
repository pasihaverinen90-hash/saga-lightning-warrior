// src/main.ts
// Application entry point.
// Constructs the Phaser game instance and registers all scenes.

import Phaser from 'phaser';
import { PHASER_CONFIG_BASE } from './game/core/config';

// ── Scenes ────────────────────────────────────────────────────────────────────
import { BootScene }        from './game/core/scenes/BootScene';
import { PreloadScene }     from './game/core/scenes/PreloadScene';
import { TitleScene }       from './game/ui/title/TitleScene';
import { TileMapScene }     from './game/maps/scenes/TileMapScene';
import { TownScene }        from './game/town/scenes/TownScene';
import { BattleScene }      from './game/battle/scenes/BattleScene';
import { DialogueOverlay }  from './game/dialogue/DialogueOverlay';
import { GameMenuOverlay }  from './game/menu/GameMenuOverlay';

// ─────────────────────────────────────────────────────────────────────────────

const config: Phaser.Types.Core.GameConfig = {
  ...PHASER_CONFIG_BASE,
  scene: [
    BootScene,
    PreloadScene,
    TitleScene,
    // TileMapScene replaces the old procedural WorldMapScene: the overworld,
    // towns, field maps and interiors are all tilemaps now.
    TileMapScene,
    // TownScene is retained only for Eldric and Dreadshore, which have not been
    // ported to tilemaps yet and still hold the Serelle and Kael join events.
    TownScene,
    BattleScene,
    DialogueOverlay,
    GameMenuOverlay,
    // PauseMenuOverlay — added when implemented
  ],
};

// Launch
new Phaser.Game(config);
