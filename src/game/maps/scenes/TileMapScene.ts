// src/game/maps/scenes/TileMapScene.ts
//
// The single scene that renders every tilemap in the game: the travel map,
// towns, field locations and building interiors.
//
// One data-driven scene rather than separate Overworld/Town/Interior scenes.
// What differs between those is data — which layers exist, whether encounters
// roll, whether saving is allowed — and the repository already proves the
// pattern with TownScene accepting any TownMapConfig. Three near-identical
// scenes would be three places to fix every bug.
//
// Architecture:
//   Map parsing     -> maps/map-loader.ts             (pure TS)
//   Collision       -> maps/systems/tile-collision.ts (pure TS)
//   Movement math   -> shared/movement-system.ts      (pure TS)
//   Zones/encounters-> world/systems/encounter-system.ts (pure TS, reused)
//   Map data        -> public/assets/maps/*.json (Tiled), maps/map-registry.ts
//
// Depth model: tile layers occupy fixed depths; the player, NPCs and every
// placed object are sorted by the y of their ground contact point, so walking
// north of a tree puts you behind its canopy and south of it puts you in front.

import Phaser from 'phaser';
import { SCENE_KEYS } from '../../core/scene-keys';
import { COLORS, COLOR_HEX, FONTS, FONT_SIZES, GAME_WIDTH, GAME_HEIGHT } from '../../core/config';
import { computeMovement, type MovementInput } from '../../shared/movement-system';
import {
  PLAYER_SPRITE_H, PLAYER_BODY_W, PLAYER_BODY_H,
} from '../../shared/constants/player';
import { getActiveZone, EncounterTracker } from '../../world/systems/encounter-system';
import { ENCOUNTER_TABLES } from '../../data/maps/encounter-tables';
import { DIALOGUE } from '../../data/dialogue/dialogue-data';
import { runEffects } from '../../dialogue/event-handler';
import { setCurrentLocation } from '../../state/state-actions';
import { getStoryFlag } from '../../state/state-selectors';
import type { BattleInitData } from '../../battle/engine/battle-types';
import type { DialogueSequence } from '../../dialogue/dialogue-types';
import type { TownInitData } from '../../town/types/town-types';
import { loadMap, buildCollisionGrid, buildObjectMetadataIndex, resolveSpawn } from '../map-loader';
import type { ObjectMetadataIndex } from '../map-loader';
import type { TileCollisionGrid } from '../systems/tile-collision';
import { getMapEntry, isTileMapId, STARTING_MAP_ID, STARTING_SPAWN_ID } from '../map-registry';
import { ABOVE_PLAYER_LAYERS } from '../map-types';
import type {
  LoadedMap, MapTrigger, MapNpc, MapZone, TiledMap, TileMapInitData,
} from '../map-types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Fallback walk speed (px/sec) when a map does not specify one. */
const DEFAULT_WALK_SPEED = 175;

/**
 * Caps the per-frame movement delta. A tab-switch or GC pause can hand Phaser a
 * single 500ms delta that would teleport the player across the map; 50ms
 * (~20fps floor) keeps movement sane while normal 16.7ms frames pass untouched.
 */
const MAX_DELTA_MS = 50;

/**
 * Camera zoom is fixed at 1.0 and never changed.
 *
 * With 64px tiles that shows 20 x 11.25 tiles, which is close to classic
 * SNES-era JRPG framing. Holding it at exactly 1.0 also means tiles map 1:1 to
 * screen pixels: any other zoom makes NEAREST filtering sample tile edges
 * unevenly and the whole map shimmers as the camera moves.
 */
const CAMERA_ZOOM = 1;
const CAMERA_LERP = 0.14;

/** How often (ms) the player's position is written to game state while walking. */
const LOCATION_UPDATE_INTERVAL_MS = 250;

/** One encounter step is one tile. */
const PIXELS_PER_STEP = 64;
/** Safe steps granted after a battle so the player is not immediately caught. */
const POST_BATTLE_SAFE_STEPS = 6;

/** Depth bands. Object/actor depths are y-derived and sit between these. */
const DEPTH = {
  tileLayers: 0,      // 0..6, one per tile layer
  actors: 100,        // + y, so 100..100+mapHeight
  aboveLayers: 20000, // Foreground tile layers
  hud: 30000,
} as const;

const WALK_ANIM_FRAMERATE = 8;
const DIRECTION_ROW = { down: 0, left: 1, right: 2, up: 3 } as const;
type Facing = keyof typeof DIRECTION_ROW;

/** Debug mode is opt-in via `?debug=1`; normal play never sees any of it. */
function isDebugEnabled(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export class TileMapScene extends Phaser.Scene {
  // ── Map ────────────────────────────────────────────────────────────────────
  private mapId = STARTING_MAP_ID;
  private spawnId: string | undefined = STARTING_SPAWN_ID;
  private startX: number | undefined;
  private startY: number | undefined;

  private map!: LoadedMap;
  private collision!: TileCollisionGrid;
  private objectMetadata: ObjectMetadataIndex = {};

  // ── Player ─────────────────────────────────────────────────────────────────
  private player!: Phaser.GameObjects.Sprite;
  /** Top-left of the player's COLLISION BODY (feet), not of the sprite. */
  private px = 0;
  private py = 0;
  private facing: Facing = 'down';

  // ── Actors and objects needing depth sorting ──────────────────────────────
  private npcSprites: Array<{ npc: MapNpc; sprite: Phaser.GameObjects.Sprite }> = [];

  // ── Input ──────────────────────────────────────────────────────────────────
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyWASD!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private keyConfirm!: Phaser.Input.Keyboard.Key;
  private keyMenu!: Phaser.Input.Keyboard.Key;

  // ── HUD ────────────────────────────────────────────────────────────────────
  private hudLocation!: Phaser.GameObjects.Container;
  private hudHint!: Phaser.GameObjects.Container;
  private hudHintText!: Phaser.GameObjects.Text;

  // ── State ──────────────────────────────────────────────────────────────────
  private activeTrigger: MapTrigger | null = null;
  private activeNpc: MapNpc | null = null;
  private activeZone: MapZone | null = null;
  private previousZoneId: string | null = null;
  private transitionPending = false;
  private dialogueActive = false;
  private menuActive = false;
  private inputCooldown = false;
  private encounterTracker = new EncounterTracker(POST_BATTLE_SAFE_STEPS, PIXELS_PER_STEP);

  private locationAccum = 0;
  private locationDirty = false;

  // ── Debug ──────────────────────────────────────────────────────────────────
  private debugEnabled = false;
  private debugGraphics: Phaser.GameObjects.Graphics | null = null;
  private debugText: Phaser.GameObjects.Text | null = null;
  private noClip = false;
  private encountersDisabled = false;
  private speedMultiplier = 1;
  private debugKeys: Record<string, Phaser.Input.Keyboard.Key> = {};

  constructor() {
    super({ key: SCENE_KEYS.TILE_MAP });
  }

  // ─── init ─────────────────────────────────────────────────────────────────

  init(data: TileMapInitData): void {
    this.mapId = data?.mapId && isTileMapId(data.mapId) ? data.mapId : STARTING_MAP_ID;
    this.spawnId = data?.spawnId;
    this.startX = data?.startX;
    this.startY = data?.startY;

    this.transitionPending = false;
    this.dialogueActive = false;
    this.menuActive = false;
    this.inputCooldown = false;
    this.activeTrigger = null;
    this.activeNpc = null;
    this.activeZone = null;
    this.previousZoneId = null;
    this.locationAccum = 0;
    this.locationDirty = false;
    this.npcSprites = [];
    this.encounterTracker.onBattleFired();

    // Re-read the URL each time so the flag can be toggled across reloads.
    this.debugEnabled = isDebugEnabled();
    this.noClip = false;
    this.encountersDisabled = false;
    this.speedMultiplier = 1;
  }

  // ─── create ───────────────────────────────────────────────────────────────

  create(): void {
    const entry = getMapEntry(this.mapId);
    const rawTiled = this.cache.tilemap.get(this.mapId)?.data as TiledMap | undefined;
    if (!entry || !rawTiled) {
      // Failing loudly beats rendering an empty blue screen with no explanation.
      this.showLoadFailure(`Map "${this.mapId}" is not loaded.`);
      return;
    }

    this.map = loadMap(this.mapId, rawTiled);
    this.objectMetadata = buildObjectMetadataIndex([
      this.cache.json.get('overworld-objects-manifest') ?? {},
      this.cache.json.get('structures-manifest') ?? {},
    ]);
    this.collision = buildCollisionGrid(this.map, rawTiled, this.objectMetadata);

    this.buildTileLayers();
    this.placeObjects();
    this.placeNpcs();
    this.placePlayer();
    this.setupCamera();
    this.setupInput();
    this.buildHud();
    this.setupDebug();

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private showLoadFailure(message: string): void {
    this.cameras.main.setBackgroundColor('#14233b');
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `${message}\nReturning to title...`, {
      fontFamily: FONTS.ui,
      fontSize: '20px',
      color: COLOR_HEX.parchment,
      align: 'center',
    }).setOrigin(0.5).setScrollFactor(0);
    this.time.delayedCall(2000, () => this.scene.start(SCENE_KEYS.TITLE));
  }

  // ─── Map rendering ────────────────────────────────────────────────────────

  private buildTileLayers(): void {
    const tilemap = this.make.tilemap({ key: this.mapId });
    // Every map embeds exactly one tileset; its image key matches its name.
    const tilesetName = tilemap.tilesets[0]?.name ?? 'overworld-terrain';
    const tileset = tilemap.addTilesetImage(tilesetName, tilesetName);
    if (!tileset) {
      this.showLoadFailure(`Tileset "${tilesetName}" missing for map "${this.mapId}".`);
      return;
    }

    this.map.tileLayers.forEach((layerName, index) => {
      const layer = tilemap.createLayer(layerName, tileset, 0, 0);
      if (!layer) return;
      const above = ABOVE_PLAYER_LAYERS.includes(layerName);
      layer.setDepth(above ? DEPTH.aboveLayers + index : DEPTH.tileLayers + index);
    });
  }

  /**
   * Places scenery and buildings. Each object is drawn from its bottom-centre
   * origin and given a depth derived from that contact point, so it interleaves
   * with the player and with other objects by how far "down" the screen it is.
   */
  private placeObjects(): void {
    for (const obj of this.map.objects) {
      if (!this.textures.exists(obj.atlas)) continue;
      const sprite = this.add.image(obj.x, obj.y, obj.atlas, obj.frame);
      sprite.setOrigin(0.5, 1);
      sprite.setDepth(obj.above ? DEPTH.aboveLayers + 100 : DEPTH.actors + obj.y);
    }
  }

  private placeNpcs(): void {
    for (const npc of this.map.npcs) {
      if (npc.hideWhenFlag && getStoryFlag(npc.hideWhenFlag)) continue;
      if (!this.textures.exists(npc.sprite)) continue;
      const sprite = this.add.sprite(
        npc.x, npc.y, npc.sprite,
        DIRECTION_ROW[npc.facing] * 4,
      );
      sprite.setOrigin(0.5, 1);
      sprite.setDepth(DEPTH.actors + npc.y);
      this.npcSprites.push({ npc, sprite });
    }
  }

  private placePlayer(): void {
    // Explicit coordinates win (save resume); otherwise use the named spawn.
    if (this.startX !== undefined && this.startY !== undefined) {
      this.px = this.startX;
      this.py = this.startY;
    } else {
      const spawn = resolveSpawn(this.map, this.spawnId);
      if (spawn) {
        // Spawn x is the centre of the tile, y is the feet line.
        this.px = spawn.x - PLAYER_BODY_W / 2;
        this.py = spawn.y - PLAYER_BODY_H;
        this.facing = spawn.facing;
      } else {
        this.px = this.map.widthInPixels / 2;
        this.py = this.map.heightInPixels / 2;
      }
    }
    this.clampToMap();

    this.player = this.add.sprite(0, 0, 'hugo', DIRECTION_ROW[this.facing] * 4);
    this.player.setOrigin(0.5, 1);
    this.createPlayerAnimations();
    this.syncPlayerSprite();
  }

  private createPlayerAnimations(): void {
    for (const [direction, row] of Object.entries(DIRECTION_ROW)) {
      const key = `hugo_walk_${direction}`;
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers('hugo', {
          start: row * 4,
          end: row * 4 + 3,
        }),
        frameRate: WALK_ANIM_FRAMERATE,
        repeat: -1,
      });
    }
  }

  /** Aligns the sprite to the collision body and refreshes its depth. */
  private syncPlayerSprite(): void {
    const feetY = this.py + PLAYER_BODY_H;
    this.player.setPosition(this.px + PLAYER_BODY_W / 2, feetY);
    this.player.setDepth(DEPTH.actors + feetY);
  }

  private clampToMap(): void {
    this.px = Math.max(0, Math.min(this.map.widthInPixels - PLAYER_BODY_W, this.px));
    this.py = Math.max(0, Math.min(this.map.heightInPixels - PLAYER_BODY_H, this.py));
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#1b2a3a');
    cam.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    cam.setZoom(CAMERA_ZOOM);
    // roundPixels stops the camera landing on a fractional offset, which would
    // otherwise shimmer the tile grid while walking.
    cam.setRoundPixels(true);
    cam.centerOn(this.player.x, this.player.y);
    cam.startFollow(this.player, true, CAMERA_LERP, CAMERA_LERP);
    // Follow the character's middle rather than their feet, so the view is not
    // biased toward the ground in front of them.
    cam.setFollowOffset(0, PLAYER_SPRITE_H / 2 - PLAYER_BODY_H);
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  private setupInput(): void {
    const keyboard = this.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.keyWASD = {
      W: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.keyConfirm = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyMenu = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);

    if (this.debugEnabled) {
      for (const [name, code] of Object.entries({
        collision: Phaser.Input.Keyboard.KeyCodes.C,
        noClip: Phaser.Input.Keyboard.KeyCodes.N,
        encounters: Phaser.Input.Keyboard.KeyCodes.E,
        faster: Phaser.Input.Keyboard.KeyCodes.PLUS,
        slower: Phaser.Input.Keyboard.KeyCodes.MINUS,
        cycleMap: Phaser.Input.Keyboard.KeyCodes.T,
      })) {
        this.debugKeys[name] = keyboard.addKey(code);
      }
    }
  }

  private readInput(): MovementInput {
    return {
      up: this.cursors.up.isDown || this.keyWASD.W.isDown,
      down: this.cursors.down.isDown || this.keyWASD.S.isDown,
      left: this.cursors.left.isDown || this.keyWASD.A.isDown,
      right: this.cursors.right.isDown || this.keyWASD.D.isDown,
    };
  }

  // ─── update ───────────────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    if (!this.map || this.transitionPending || this.dialogueActive || this.menuActive) return;

    // The keypress that closed a dialogue or menu must be released before it
    // can activate anything else.
    if (this.inputCooldown) {
      if (!this.keyConfirm.isDown && !this.keyMenu.isDown) this.inputCooldown = false;
      else return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyMenu)) {
      this.openMenu();
      return;
    }

    if (this.debugEnabled) this.updateDebugToggles();

    const movementDelta = Math.min(delta, MAX_DELTA_MS);
    const prevX = this.px;
    const prevY = this.py;
    const input = this.readInput();

    const speed = (this.map.walkSpeed ?? DEFAULT_WALK_SPEED) * this.speedMultiplier;
    const result = computeMovement(
      this.px, this.py,
      input,
      speed,
      movementDelta,
      this.map.widthInPixels, this.map.heightInPixels,
      PLAYER_BODY_W, PLAYER_BODY_H,
      // No-clip still respects the map edges, only the solid grid is bypassed.
      this.noClip ? [] : this.collision,
    );

    this.px = result.x;
    this.py = result.y;
    this.updateFacingAndAnimation(input, result.moving);
    this.syncPlayerSprite();

    const dx = this.px - prevX;
    const dy = this.py - prevY;
    const distance = Math.hypot(dx, dy);

    if (distance > 0) this.locationDirty = true;
    this.locationAccum += delta;
    if (this.locationDirty && this.locationAccum >= LOCATION_UPDATE_INTERVAL_MS) {
      this.writeLocation();
      this.locationDirty = false;
      this.locationAccum = 0;
    }

    this.updateZone();
    if (this.rollEncounter(distance, result.moving)) return;

    this.updateInteractables();

    if (Phaser.Input.Keyboard.JustDown(this.keyConfirm)) this.activateNearest();

    if (this.debugEnabled) this.drawDebug();
  }

  private updateFacingAndAnimation(input: MovementInput, moving: boolean): void {
    if (moving) {
      // Vertical wins ties so diagonal movement keeps a stable facing rather
      // than flickering between two directions.
      if (input.up) this.facing = 'up';
      else if (input.down) this.facing = 'down';
      else if (input.left) this.facing = 'left';
      else if (input.right) this.facing = 'right';

      const key = `hugo_walk_${this.facing}`;
      if (this.player.anims.currentAnim?.key !== key || !this.player.anims.isPlaying) {
        this.player.play(key, true);
      }
    } else {
      this.player.stop();
      this.player.setFrame(DIRECTION_ROW[this.facing] * 4);
    }
  }

  private writeLocation(): void {
    setCurrentLocation({
      locationId: this.mapId,
      x: Math.round(this.px + PLAYER_BODY_W / 2),
      y: Math.round(this.py + PLAYER_BODY_H / 2),
    });
  }

  // ─── Zones and encounters ─────────────────────────────────────────────────

  private updateZone(): void {
    this.activeZone = getActiveZone(
      this.px, this.py, PLAYER_BODY_W, PLAYER_BODY_H, this.map.zones,
    ) as MapZone | null;

    const zoneId = this.activeZone?.id ?? null;
    if (zoneId !== this.previousZoneId) {
      this.encounterTracker.resetSteps();
      this.previousZoneId = zoneId;
    }
  }

  /** Returns true if a battle was launched and update() should stop. */
  private rollEncounter(distance: number, moving: boolean): boolean {
    if (!moving || distance <= 0) return false;
    if (this.encountersDisabled) return false;
    // Towns and interiors never roll, regardless of what zones they declare.
    if (this.map.kind === 'town' || this.map.kind === 'interior') return false;
    if (this.activeZone?.type !== 'encounter') return false;

    const table = ENCOUNTER_TABLES[this.activeZone.id];
    if (!table) return false;

    const group = this.encounterTracker.onMove(distance, table);
    if (!group) return false;

    this.launchBattle({
      enemyIds: group.enemyIds,
      backgroundColorHex: '#1a1428',
    });
    return true;
  }

  // ─── Interaction ──────────────────────────────────────────────────────────

  private triggerIsActive(trigger: MapTrigger): boolean {
    if (trigger.requiresFlag && !getStoryFlag(trigger.requiresFlag)) return false;
    if (trigger.consumedByFlag && getStoryFlag(trigger.consumedByFlag)) return false;
    return true;
  }

  private bodyOverlaps(rect: { x: number; y: number; width: number; height: number }): boolean {
    return this.px < rect.x + rect.width
      && this.px + PLAYER_BODY_W > rect.x
      && this.py < rect.y + rect.height
      && this.py + PLAYER_BODY_H > rect.y;
  }

  private updateInteractables(): void {
    this.activeTrigger = null;
    this.activeNpc = null;

    for (const trigger of this.map.triggers) {
      if (!this.triggerIsActive(trigger)) continue;
      if (!this.bodyOverlaps(trigger)) continue;
      // A contact trigger fires the moment it is entered.
      if (trigger.activation === 'contact') {
        this.fireTrigger(trigger);
        return;
      }
      this.activeTrigger = trigger;
      break;
    }

    if (!this.activeTrigger) {
      const reach = 56;
      let nearest: MapNpc | null = null;
      let nearestDistance = Infinity;
      const cx = this.px + PLAYER_BODY_W / 2;
      const cy = this.py + PLAYER_BODY_H / 2;
      for (const { npc } of this.npcSprites) {
        const d = Math.hypot(cx - npc.x, cy - (npc.y - PLAYER_BODY_H));
        if (d <= reach && d < nearestDistance) {
          nearest = npc;
          nearestDistance = d;
        }
      }
      this.activeNpc = nearest;
    }

    this.refreshHint();
  }

  private activateNearest(): void {
    if (this.activeTrigger) {
      this.fireTrigger(this.activeTrigger);
      return;
    }
    if (this.activeNpc?.dialogueId) {
      this.startDialogue(this.activeNpc.dialogueId);
    }
  }

  private fireTrigger(trigger: MapTrigger): void {
    switch (trigger.kind) {
      case 'map':
        this.goToMap(trigger);
        break;
      case 'battle':
        this.launchBattle({
          enemyIds: trigger.enemyIds ?? [],
          backgroundColorHex: trigger.backgroundColorHex ?? '#1a1428',
          introDialogueId: trigger.introDialogueId,
          outroDialogueId: trigger.outroDialogueId,
          isBoss: trigger.isBoss,
          locationId: trigger.targetMapId,
        });
        break;
      case 'dialogue':
      case 'sign':
        if (trigger.dialogueId) this.startDialogue(trigger.dialogueId);
        break;
      case 'save':
        this.openMenu();
        break;
    }
  }

  // ─── Transitions ──────────────────────────────────────────────────────────

  private goToMap(trigger: MapTrigger): void {
    const targetId = trigger.targetMapId;
    if (!targetId) return;
    this.transitionPending = true;

    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (isTileMapId(targetId)) {
        setCurrentLocation({ locationId: targetId, x: 0, y: 0 });
        this.scene.start(SCENE_KEYS.TILE_MAP, {
          mapId: targetId,
          spawnId: trigger.targetSpawnId,
        } satisfies TileMapInitData);
        return;
      }
      // Not a tilemap: Eldric and Dreadshore are still served by the legacy
      // procedural TownScene. Routing by id here is what lets the two systems
      // coexist while the remaining towns are ported.
      setCurrentLocation({ locationId: targetId, x: 0, y: 0 });
      this.scene.start(SCENE_KEYS.TOWN, { locationId: targetId } satisfies TownInitData);
    });
  }

  private launchBattle(options: {
    enemyIds: string[];
    backgroundColorHex: string;
    introDialogueId?: string;
    outroDialogueId?: string;
    isBoss?: boolean;
    locationId?: string;
  }): void {
    if (options.enemyIds.length === 0) return;
    this.transitionPending = true;

    setCurrentLocation({
      locationId: options.locationId ?? this.mapId,
      x: Math.round(this.px + PLAYER_BODY_W / 2),
      y: Math.round(this.py + PLAYER_BODY_H / 2),
    });

    const battleData: BattleInitData = {
      enemyIds: options.enemyIds,
      returnSceneKey: SCENE_KEYS.TILE_MAP,
      backgroundColorHex: options.backgroundColorHex,
      returnX: Math.round(this.px),
      returnY: Math.round(this.py),
      returnMapId: this.mapId,
      introDialogueId: options.introDialogueId,
      outroDialogueId: options.outroDialogueId,
      isBoss: options.isBoss,
    };

    this.cameras.main.flash(160, 255, 255, 255, true);
    this.time.delayedCall(160, () => {
      this.cameras.main.fadeOut(260, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(SCENE_KEYS.BATTLE, battleData);
      });
    });
  }

  // ─── Dialogue and menu ────────────────────────────────────────────────────

  private startDialogue(dialogueId: string): void {
    const sequence: DialogueSequence | undefined = DIALOGUE[dialogueId];
    if (!sequence) return;

    this.dialogueActive = true;
    this.hudHint.setVisible(false);

    if (this.scene.isActive(SCENE_KEYS.DIALOGUE_OVERLAY)) {
      this.scene.stop(SCENE_KEYS.DIALOGUE_OVERLAY);
    }
    // Registered before launch so it is guaranteed in place before create().
    this.scene.get(SCENE_KEYS.DIALOGUE_OVERLAY).events.once('complete', (seq: DialogueSequence) => {
      runEffects(seq.onComplete);
      this.dialogueActive = false;
      this.inputCooldown = true;
      this.refreshNpcVisibility();
    });

    this.scene.launch(SCENE_KEYS.DIALOGUE_OVERLAY, { sequence });
    this.scene.bringToTop(SCENE_KEYS.DIALOGUE_OVERLAY);
  }

  /** Removes NPCs whose hideWhenFlag has just been set by a dialogue effect. */
  private refreshNpcVisibility(): void {
    this.npcSprites = this.npcSprites.filter(({ npc, sprite }) => {
      if (npc.hideWhenFlag && getStoryFlag(npc.hideWhenFlag)) {
        sprite.destroy();
        return false;
      }
      return true;
    });
  }

  private openMenu(): void {
    this.menuActive = true;
    if (this.scene.isActive(SCENE_KEYS.GAME_MENU)) this.scene.stop(SCENE_KEYS.GAME_MENU);
    this.scene.get(SCENE_KEYS.GAME_MENU).events.once('close', () => {
      this.menuActive = false;
      this.inputCooldown = true;
    });
    // Saving is a per-map property: the travel map and field maps are never
    // valid save points, matching the pre-existing overworld rule.
    const canSave = getMapEntry(this.mapId)?.canSave ?? false;
    if (canSave) this.writeLocation();
    this.scene.launch(SCENE_KEYS.GAME_MENU, { canSave });
    this.scene.bringToTop(SCENE_KEYS.GAME_MENU);
  }

  // ─── HUD ──────────────────────────────────────────────────────────────────

  private buildHud(): void {
    this.hudLocation = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.hud);
    const label = this.add.text(24, 20, this.map.displayName, {
      fontFamily: FONTS.ui,
      fontSize: `${FONT_SIZES.locationLabel}px`,
      color: COLOR_HEX.parchment,
    });
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panelBg, 0.92);
    panel.fillRoundedRect(14, 12, label.width + 20, 34, 6);
    panel.lineStyle(2, COLORS.panelBorder, 1);
    panel.strokeRoundedRect(14, 12, label.width + 20, 34, 6);
    this.hudLocation.add([panel, label]);

    this.hudHint = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.hud);
    this.hudHintText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 46, '', {
      fontFamily: FONTS.ui,
      fontSize: `${FONT_SIZES.hint}px`,
      color: COLOR_HEX.parchment,
    }).setOrigin(0.5);
    this.hudHint.add(this.hudHintText);
    this.hudHint.setVisible(false);
  }

  private refreshHint(): void {
    const prompt = this.activeTrigger?.prompt
      ?? (this.activeNpc ? `Talk to ${this.activeNpc.label}` : null);
    if (!prompt) {
      this.hudHint.setVisible(false);
      return;
    }
    this.hudHintText.setText(`[SPACE] ${prompt}`);
    this.hudHint.setVisible(true);
  }

  // ─── Debug ────────────────────────────────────────────────────────────────

  private setupDebug(): void {
    if (!this.debugEnabled) return;
    this.debugGraphics = this.add.graphics().setDepth(DEPTH.hud - 1);
    this.debugText = this.add.text(14, GAME_HEIGHT - 128, '', {
      fontFamily: FONTS.ui,
      fontSize: `${FONT_SIZES.debug}px`,
      color: '#F3EBD2',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(DEPTH.hud);
    this.updateDebugText();
  }

  private updateDebugToggles(): void {
    if (Phaser.Input.Keyboard.JustDown(this.debugKeys.noClip)) this.noClip = !this.noClip;
    if (Phaser.Input.Keyboard.JustDown(this.debugKeys.encounters)) {
      this.encountersDisabled = !this.encountersDisabled;
    }
    if (Phaser.Input.Keyboard.JustDown(this.debugKeys.collision) && this.debugGraphics) {
      this.debugGraphics.setVisible(!this.debugGraphics.visible);
    }
    if (Phaser.Input.Keyboard.JustDown(this.debugKeys.faster)) {
      this.speedMultiplier = Math.min(4, this.speedMultiplier * 2);
    }
    if (Phaser.Input.Keyboard.JustDown(this.debugKeys.slower)) {
      this.speedMultiplier = Math.max(0.25, this.speedMultiplier / 2);
    }
    if (Phaser.Input.Keyboard.JustDown(this.debugKeys.cycleMap)) {
      this.teleportToNextMap();
      return;
    }
    this.updateDebugText();
  }

  private teleportToNextMap(): void {
    const ids = Object.keys(
      // Import cycle avoided by reading the registry through the helper.
      { elerion_west: 1, dawnkeep: 1, everdawn_forest: 1, dawnkeep_inn: 1 },
    ).filter(isTileMapId);
    const next = ids[(ids.indexOf(this.mapId) + 1) % ids.length];
    this.transitionPending = true;
    this.scene.start(SCENE_KEYS.TILE_MAP, { mapId: next } satisfies TileMapInitData);
  }

  private updateDebugText(): void {
    if (!this.debugText) return;
    this.debugText.setText([
      `DEBUG  map=${this.mapId} (${this.map.kind})`,
      `zone=${this.activeZone?.id ?? 'none'}  solid tiles=${this.collision.solidCount}`,
      `C collision  N noclip=${this.noClip ? 'ON' : 'OFF'}  E encounters=${this.encountersDisabled ? 'OFF' : 'ON'}`,
      `+/- speed x${this.speedMultiplier}  T next map`,
    ].join('\n'));
  }

  private drawDebug(): void {
    const g = this.debugGraphics;
    if (!g || !g.visible) return;
    g.clear();

    // Solid tiles, culled to the camera so a large map stays cheap to draw.
    const cam = this.cameras.main;
    const tile = this.map.tileSize;
    const minTx = Math.max(0, Math.floor(cam.worldView.x / tile));
    const minTy = Math.max(0, Math.floor(cam.worldView.y / tile));
    const maxTx = Math.min(this.map.widthInTiles - 1, Math.ceil(cam.worldView.right / tile));
    const maxTy = Math.min(this.map.heightInTiles - 1, Math.ceil(cam.worldView.bottom / tile));
    g.fillStyle(0xff3355, 0.22);
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (this.collision.isSolidTile(tx, ty)) g.fillRect(tx * tile, ty * tile, tile, tile);
      }
    }

    g.lineStyle(2, 0x66ddff, 0.9);
    for (const trigger of this.map.triggers) {
      if (!this.triggerIsActive(trigger)) continue;
      g.strokeRect(trigger.x, trigger.y, trigger.width, trigger.height);
    }

    g.lineStyle(2, 0xffcc33, 0.7);
    for (const zone of this.map.zones) {
      if (zone.type !== 'encounter') continue;
      g.strokeRect(zone.x, zone.y, zone.width, zone.height);
    }

    g.fillStyle(0xff44dd, 0.9);
    for (const spawn of this.map.spawns) g.fillRect(spawn.x - 4, spawn.y - 4, 8, 8);

    g.lineStyle(2, 0x44ff88, 1);
    g.strokeRect(this.px, this.py, PLAYER_BODY_W, PLAYER_BODY_H);
  }
}
