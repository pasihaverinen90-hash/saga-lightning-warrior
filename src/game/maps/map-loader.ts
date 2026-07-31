// src/game/maps/map-loader.ts
// Pure TypeScript. No Phaser.
//
// Turns raw Tiled JSON into the runtime LoadedMap model, and builds the
// collision grid from tile properties plus object footprints.
//
// The scene stays responsible for creating Phaser tilemap layers and sprites;
// everything gameplay reads — collision, triggers, zones, spawns, NPCs — is
// resolved here so it can be reasoned about (and unit-tested) without a
// running game.

import type {
  TiledMap, TiledObject, TiledProperty, TiledObjectLayer, TiledTileLayer,
  TiledTileset, LoadedMap, MapKind, MapTrigger, MapZone, MapSpawn,
  MapObject, MapNpc, TileLayerName, TriggerKind, TriggerActivation, Rect,
} from './map-types';
import { TILE_LAYERS } from './map-types';
import { TileCollisionGrid } from './systems/tile-collision';

/** Metadata describing an object atlas frame's collision footprint. */
export interface ObjectFootprintDef {
  name: string;
  width: number;
  height: number;
  solid: boolean;
  origin: { x: number; y: number };
  footprint: Rect;
}

/** name → footprint metadata, merged across every object atlas manifest. */
export type ObjectMetadataIndex = Record<string, ObjectFootprintDef>;

// ─── Property helpers ─────────────────────────────────────────────────────────

function propMap(properties?: TiledProperty[]): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const p of properties ?? []) out[p.name] = p.value;
  return out;
}

function str(props: Record<string, unknown>, key: string): string | undefined {
  const v = props[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function bool(props: Record<string, unknown>, key: string): boolean {
  return props[key] === true || props[key] === 'true';
}

function findTileLayer(map: TiledMap, name: string): TiledTileLayer | undefined {
  return map.layers.find(
    (l): l is TiledTileLayer => l.type === 'tilelayer' && l.name === name,
  );
}

function findObjectLayer(map: TiledMap, name: string): TiledObjectLayer | undefined {
  return map.layers.find(
    (l): l is TiledObjectLayer => l.type === 'objectgroup' && l.name === name,
  );
}

// ─── Solid tile lookup ────────────────────────────────────────────────────────

/**
 * Builds the set of global tile ids (gids) flagged `solid` in any tileset.
 *
 * Solidity lives on the tile in the tileset rather than on a separate
 * collision layer, so a water tile is impassable everywhere it is used and no
 * map can forget to mark it.
 */
function collectSolidGids(tilesets: TiledTileset[]): Set<number> {
  const solid = new Set<number>();
  for (const tileset of tilesets) {
    for (const tile of tileset.tiles ?? []) {
      const props = propMap(tile.properties);
      if (props.solid === true || props.solid === 'true') {
        solid.add(tileset.firstgid + tile.id);
      }
    }
  }
  return solid;
}

// ─── Object layer parsing ─────────────────────────────────────────────────────

const VALID_TRIGGER_KINDS: TriggerKind[] = ['map', 'battle', 'dialogue', 'save', 'sign'];

function parseTriggers(layer: TiledObjectLayer | undefined): MapTrigger[] {
  if (!layer) return [];
  const triggers: MapTrigger[] = [];

  for (const obj of layer.objects) {
    const props = propMap(obj.properties);
    const rawKind = str(props, 'kind') ?? 'map';
    const kind = (VALID_TRIGGER_KINDS as string[]).includes(rawKind)
      ? (rawKind as TriggerKind)
      : 'map';

    // Doorways and map edges should just work when walked into; anything that
    // interrupts play (a battle, a conversation, a save) asks for confirmation.
    const defaultActivation: TriggerActivation = kind === 'map' ? 'contact' : 'confirm';
    const rawActivation = str(props, 'activation');
    const activation: TriggerActivation =
      rawActivation === 'contact' || rawActivation === 'confirm'
        ? rawActivation
        : defaultActivation;

    const enemyIdsRaw = str(props, 'enemyIds');

    triggers.push({
      id: obj.name || `trigger_${obj.id}`,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      kind,
      activation,
      prompt: str(props, 'prompt'),
      targetMapId: str(props, 'targetMap'),
      targetSpawnId: str(props, 'targetSpawn'),
      dialogueId: str(props, 'dialogueId'),
      requiresFlag: str(props, 'requiresFlag'),
      consumedByFlag: str(props, 'consumedByFlag'),
      enemyIds: enemyIdsRaw ? enemyIdsRaw.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      introDialogueId: str(props, 'introDialogueId'),
      outroDialogueId: str(props, 'outroDialogueId'),
      isBoss: bool(props, 'isBoss'),
      backgroundColorHex: str(props, 'backgroundColorHex'),
    });
  }
  return triggers;
}

function parseZones(layer: TiledObjectLayer | undefined): MapZone[] {
  if (!layer) return [];
  return layer.objects.map(obj => {
    const props = propMap(obj.properties);
    return {
      id: str(props, 'zoneId') ?? obj.name,
      displayName: str(props, 'displayName') ?? obj.name,
      type: str(props, 'type') === 'safe' ? ('safe' as const) : ('encounter' as const),
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
    };
  });
}

function parseSpawns(layer: TiledObjectLayer | undefined): MapSpawn[] {
  if (!layer) return [];
  return layer.objects.map(obj => {
    const props = propMap(obj.properties);
    const facing = str(props, 'facing');
    return {
      id: obj.name,
      x: obj.x,
      y: obj.y,
      facing: facing === 'up' || facing === 'left' || facing === 'right' ? facing : 'down',
    };
  });
}

function parseObjects(layer: TiledObjectLayer | undefined): MapObject[] {
  if (!layer) return [];
  const objects: MapObject[] = [];
  for (const obj of layer.objects) {
    const props = propMap(obj.properties);
    const frame = str(props, 'frame');
    if (!frame) continue; // nothing to draw without a frame name
    objects.push({
      id: obj.name || `obj_${obj.id}`,
      atlas: str(props, 'atlas') ?? 'overworld-objects',
      frame,
      x: obj.x,
      y: obj.y,
      above: bool(props, 'above'),
    });
  }
  return objects;
}

function parseNpcs(layer: TiledObjectLayer | undefined): MapNpc[] {
  if (!layer) return [];
  return layer.objects.map(obj => {
    const props = propMap(obj.properties);
    const facing = str(props, 'facing');
    return {
      id: obj.name || `npc_${obj.id}`,
      sprite: str(props, 'sprite') ?? 'villager',
      x: obj.x,
      y: obj.y,
      facing: facing === 'up' || facing === 'left' || facing === 'right' ? facing : 'down',
      label: str(props, 'label') ?? 'Talk',
      dialogueId: str(props, 'dialogueId'),
      hideWhenFlag: str(props, 'hideWhenFlag'),
    };
  });
}

function parseCollisionRects(layer: TiledObjectLayer | undefined): Rect[] {
  if (!layer) return [];
  return layer.objects.map((obj: TiledObject) => ({
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
  }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Parses raw Tiled JSON into the runtime model. */
export function loadMap(id: string, raw: TiledMap): LoadedMap {
  const props = propMap(raw.properties);
  const rawKind = str(props, 'kind');
  const kind: MapKind =
    rawKind === 'travel' || rawKind === 'field' || rawKind === 'town' || rawKind === 'interior'
      ? rawKind
      : 'field';

  const tileLayers = TILE_LAYERS.filter(
    (name): name is TileLayerName => findTileLayer(raw, name) !== undefined,
  );

  const walkSpeedRaw = props.walkSpeed;

  return {
    id,
    kind,
    displayName: str(props, 'displayName') ?? id,
    widthInTiles: raw.width,
    heightInTiles: raw.height,
    tileSize: raw.tilewidth,
    widthInPixels: raw.width * raw.tilewidth,
    heightInPixels: raw.height * raw.tileheight,
    tileLayers,
    collisionRects: parseCollisionRects(findObjectLayer(raw, 'Collision')),
    triggers: parseTriggers(findObjectLayer(raw, 'Triggers')),
    zones: parseZones(findObjectLayer(raw, 'EncounterZones')),
    spawns: parseSpawns(findObjectLayer(raw, 'SpawnPoints')),
    objects: parseObjects(findObjectLayer(raw, 'Objects')),
    npcs: parseNpcs(findObjectLayer(raw, 'NPCs')),
    walkSpeed: typeof walkSpeedRaw === 'number' ? walkSpeedRaw : undefined,
  };
}

/**
 * Builds the collision grid for a map from three sources, in this order:
 *   1. tiles whose tileset marks them `solid` (water, walls)
 *   2. explicit rectangles on the Collision object layer
 *   3. the base footprint of every placed object that is solid
 *
 * Objects contribute only their footprint, never their full sprite bounds —
 * that is what lets the player walk behind a tree canopy or a roof while still
 * being stopped by the trunk or the wall.
 */
export function buildCollisionGrid(
  map: LoadedMap,
  raw: TiledMap,
  objectMetadata: ObjectMetadataIndex,
): TileCollisionGrid {
  const grid = new TileCollisionGrid(map.widthInTiles, map.heightInTiles, map.tileSize);
  const solidGids = collectSolidGids(raw.tilesets);

  for (const layerName of map.tileLayers) {
    const layer = findTileLayer(raw, layerName);
    if (!layer) continue;
    for (let i = 0; i < layer.data.length; i++) {
      const gid = layer.data[i];
      if (gid === 0 || !solidGids.has(gid)) continue;
      grid.setSolidTile(i % layer.width, Math.floor(i / layer.width));
    }
  }

  for (const rect of map.collisionRects) grid.addRect(rect);

  for (const obj of map.objects) {
    const meta = objectMetadata[obj.frame];
    if (!meta || !meta.solid) continue;
    // Object x/y is the bottom-centre origin; convert to sprite top-left,
    // then offset by the footprint recorded in the atlas manifest.
    const left = obj.x - meta.width * meta.origin.x;
    const top = obj.y - meta.height * meta.origin.y;
    grid.addRect({
      x: left + meta.footprint.x,
      y: top + meta.footprint.y,
      width: meta.footprint.width,
      height: meta.footprint.height,
    });
  }

  return grid;
}

/** Merges any number of atlas manifests into one frame → metadata index. */
export function buildObjectMetadataIndex(
  manifests: Array<{ objects?: ObjectFootprintDef[] }>,
): ObjectMetadataIndex {
  const index: ObjectMetadataIndex = {};
  for (const manifest of manifests) {
    for (const obj of manifest.objects ?? []) index[obj.name] = obj;
  }
  return index;
}

/** Finds a spawn point by id, falling back to `default` then the first one. */
export function resolveSpawn(map: LoadedMap, spawnId?: string): MapSpawn | null {
  if (spawnId) {
    const match = map.spawns.find(s => s.id === spawnId);
    if (match) return match;
  }
  return map.spawns.find(s => s.id === 'default') ?? map.spawns[0] ?? null;
}
