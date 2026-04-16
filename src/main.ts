// src/main.ts
// Application entry point.
// Constructs the Phaser game instance and registers all scenes.

import Phaser from 'phaser';
import { PHASER_CONFIG_BASE } from './game/core/config';

// ── Scenes ────────────────────────────────────────────────────────────────────
import { BootScene }        from './game/core/scenes/BootScene';
import { PreloadScene }     from './game/core/scenes/PreloadScene';
import { TitleScene }       from './game/ui/title/TitleScene';
import { WorldMapScene }    from './game/world/scenes/WorldMapScene';
import { TownScene }        from './game/town/scenes/TownScene';
import { BattleScene }      from './game/battle/scenes/BattleScene';
import { DialogueOverlay }  from './game/dialogue/DialogueOverlay';

// ─────────────────────────────────────────────────────────────────────────────

const config: Phaser.Types.Core.GameConfig = {
  ...PHASER_CONFIG_BASE,
  scene: [
    BootScene,
    PreloadScene,
    TitleScene,
    WorldMapScene,
    TownScene,
    BattleScene,
    DialogueOverlay,
    // PauseMenuOverlay — added when implemented
  ],
};

// Launch
new Phaser.Game(config);
