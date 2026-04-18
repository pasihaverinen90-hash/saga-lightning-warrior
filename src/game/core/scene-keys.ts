// src/game/core/scene-keys.ts
// All scene keys in one place. Import from here — never use raw strings.

export const SCENE_KEYS = {
  BOOT:             'BootScene',
  PRELOAD:          'PreloadScene',
  TITLE:            'TitleScene',
  WORLD_MAP:        'WorldMapScene',
  TOWN:             'TownScene',
  BATTLE:           'BattleScene',
  DIALOGUE_OVERLAY: 'DialogueOverlay',
  GAME_MENU:        'GameMenuOverlay',
  PAUSE_MENU:       'PauseMenuOverlay', // reserved for future implementation
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
