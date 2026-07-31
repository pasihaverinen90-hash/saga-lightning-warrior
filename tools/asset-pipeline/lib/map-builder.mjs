// tools/asset-pipeline/lib/map-builder.mjs
//
// Authoring DSL that emits Tiled 1.10 JSON maps.
//
// Maps are described at region level — "a road from here to here", "forest in
// this rectangle" — and the builder rasterises that into tile layers, applying
// autotiling so every road junction and shoreline resolves to the right of the
// 16 neighbour variants. A 60x40 map is 2400 tiles; hand-placing those is not
// realistic, and the result would be far harder to adjust later.
//
// Output is ordinary Tiled JSON with an EMBEDDED tileset, so the files open
// directly in the Tiled editor for hand-tweaking and Phaser can load them
// without resolving external tileset references.

import { hash2, valueNoise } from './image.mjs';
import { TILE } from './config.mjs';
import { AUTOTILE_VARIANTS } from '../gen-autotiles.mjs';

const NORTH = 1, EAST = 2, SOUTH = 4, WEST = 8;

export class MapBuilder {
  /**
   * @param {object} options
   * @param {string} options.id            Map id; must match map-registry.ts.
   * @param {'travel'|'field'|'town'|'interior'} options.kind
   * @param {string} options.displayName
   * @param {number} options.width         Width in tiles.
   * @param {number} options.height        Height in tiles.
   * @param {object} options.tileset       Result object from writeTileset().
   * @param {object} options.tilesetJson   The tileset's Tiled JSON, embedded.
   * @param {number} [options.walkSpeed]   px/sec override for this map.
   */
  constructor({ id, kind, displayName, width, height, tileset, tilesetJson, walkSpeed }) {
    this.id = id;
    this.kind = kind;
    this.displayName = displayName;
    this.width = width;
    this.height = height;
    this.tileset = tileset;
    this.tilesetJson = tilesetJson;
    this.walkSpeed = walkSpeed;

    /** layerName -> Int32Array of tile indices (-1 = empty). */
    this.layers = new Map();
    /** layerName -> Map<material, Set<cellIndex>> for autotile resolution. */
    this.materials = new Map();

    this.objects = [];
    this.triggers = [];
    this.zones = [];
    this.spawns = [];
    this.npcs = [];
    this.collision = [];

    /** Cells that scattering must avoid (roads, buildings, water). */
    this.reserved = new Set();

    this.nextObjectId = 1;
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  index(x, y) { return y * this.width + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }

  layer(name) {
    if (!this.layers.has(name)) {
      this.layers.set(name, new Int32Array(this.width * this.height).fill(-1));
    }
    return this.layers.get(name);
  }

  materialSet(layerName, material) {
    if (!this.materials.has(layerName)) this.materials.set(layerName, new Map());
    const byMaterial = this.materials.get(layerName);
    if (!byMaterial.has(material)) byMaterial.set(material, new Set());
    return byMaterial.get(material);
  }

  tileIndex(name) {
    const index = this.tileset.indexByName[name];
    if (index === undefined) throw new Error(`${this.id}: unknown tile "${name}"`);
    return index;
  }

  setTile(layerName, x, y, tileName) {
    if (!this.inBounds(x, y)) return;
    this.layer(layerName)[this.index(x, y)] = this.tileIndex(tileName);
  }

  reserve(x, y) { if (this.inBounds(x, y)) this.reserved.add(this.index(x, y)); }
  isReserved(x, y) { return this.reserved.has(this.index(x, y)); }

  reserveRect(tx, ty, tw, th) {
    for (let y = ty; y < ty + th; y++) for (let x = tx; x < tx + tw; x++) this.reserve(x, y);
  }

  // ── Ground ─────────────────────────────────────────────────────────────────

  /**
   * Fills the Ground layer with a deterministic mix of the supplied variants.
   *
   * Variation matters more than it sounds: every grass tile is edge-conformed
   * to the same border ring by the terrain slicer, so mixing them is free and
   * it is what stops a large field reading as one repeated stamp.
   */
  fillGround(variants, seed = 1) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const pick = Math.floor(hash2(x, y, seed) * variants.length) % variants.length;
        this.setTile('Ground', x, y, variants[pick]);
      }
    }
  }

  /** Sprinkles decorative ground tiles (flowers, pebbles, tufts). */
  scatterGroundDecor(names, chance, { rect = null, seed = 2, layerName = 'Terrain' } = {}) {
    const x0 = rect ? rect.x : 0;
    const y0 = rect ? rect.y : 0;
    const x1 = rect ? rect.x + rect.width : this.width;
    const y1 = rect ? rect.y + rect.height : this.height;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (!this.inBounds(x, y) || this.isReserved(x, y)) continue;
        if (hash2(x, y, seed) > chance) continue;
        const pick = Math.floor(hash2(x, y, seed + 1) * names.length) % names.length;
        this.setTile(layerName, x, y, names[pick]);
      }
    }
  }

  // ── Autotiled materials ────────────────────────────────────────────────────

  /** Adds a rectangle of cells to an autotiled material. */
  paintRect(layerName, material, tx, ty, tw, th, { reserve = true } = {}) {
    const cells = this.materialSet(layerName, material);
    for (let y = ty; y < ty + th; y++) {
      for (let x = tx; x < tx + tw; x++) {
        if (!this.inBounds(x, y)) continue;
        cells.add(this.index(x, y));
        if (reserve) this.reserve(x, y);
      }
    }
  }

  /**
   * Rasterises a polyline into an autotiled material.
   *
   * Walks each segment in half-tile steps and stamps a disc of `radius` tiles,
   * which keeps corners connected — stepping a whole tile at a time can skip a
   * cell on shallow diagonals and leave a hole in the road.
   */
  paintPath(layerName, material, points, radius = 0, { reserve = true } = {}) {
    const cells = this.materialSet(layerName, material);
    const stamp = (cx, cy) => {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius + radius) continue;
          const x = Math.round(cx) + dx;
          const y = Math.round(cy) + dy;
          if (!this.inBounds(x, y)) continue;
          cells.add(this.index(x, y));
          if (reserve) this.reserve(x, y);
        }
      }
    };
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[i + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        stamp(ax + (bx - ax) * t, ay + (by - ay) * t);
      }
    }
  }

  /**
   * Fills a rectangle with tiles chosen from `names`, but only where a noise
   * field exceeds a threshold, giving the patch a ragged natural outline.
   *
   * Used for tall grass and undergrowth. A plain rectangle of tall grass reads
   * as an obvious square of a different texture; a noise-shaped one reads as
   * scrub that happens to grow there.
   */
  paintOrganicPatch(layerName, names, rect, { threshold = 0.45, cell = 4, seed = 3, reserve = false } = {}) {
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++) {
        if (!this.inBounds(x, y) || this.isReserved(x, y)) continue;
        if (valueNoise(x, y, cell, seed) < threshold) continue;
        const pick = Math.floor(hash2(x, y, seed + 7) * names.length) % names.length;
        this.setTile(layerName, x, y, names[pick]);
        if (reserve) this.reserve(x, y);
      }
    }
  }

  /**
   * Resolves every autotiled material into concrete tiles.
   *
   * Must run after all painting and before export. Bits are computed against
   * same-material neighbours only, matching the convention baked into the
   * generated tiles by gen-autotiles.mjs.
   */
  resolveAutotiles() {
    for (const [layerName, byMaterial] of this.materials) {
      for (const [material, cells] of byMaterial) {
        for (const cellIndex of cells) {
          const x = cellIndex % this.width;
          const y = Math.floor(cellIndex / this.width);
          let bits = 0;
          // Out-of-bounds counts as "same material" so a sea or a road running
          // off the map edge stays visually continuous instead of growing a
          // shoreline along the border.
          const member = (nx, ny) =>
            !this.inBounds(nx, ny) || cells.has(this.index(nx, ny));
          if (member(x, y - 1)) bits |= NORTH;
          if (member(x + 1, y)) bits |= EAST;
          if (member(x, y + 1)) bits |= SOUTH;
          if (member(x - 1, y)) bits |= WEST;
          // Pick between the edge-treatment variants by position, so a long
          // straight run does not repeat one stamped silhouette.
          const variant = Math.floor(hash2(x, y, 613) * AUTOTILE_VARIANTS) % AUTOTILE_VARIANTS;
          this.setTile(layerName, x, y, `${material}_${String(bits).padStart(2, '0')}_${variant}`);
        }
      }
    }
  }

  // ── Objects, triggers and gameplay data ────────────────────────────────────

  /** Places a sprite. `tx`/`ty` are tile coordinates of the ground contact point. */
  addObject(atlas, frame, tx, ty, { above = false, offsetX = 0, offsetY = 0, reserveTiles = null } = {}) {
    this.objects.push({
      id: this.nextObjectId++,
      name: `${frame}_${this.objects.length}`,
      atlas,
      frame,
      x: Math.round(tx * TILE + TILE / 2 + offsetX),
      y: Math.round(ty * TILE + TILE + offsetY),
      above,
    });
    if (reserveTiles) {
      this.reserveRect(
        Math.round(tx - (reserveTiles.width - 1) / 2),
        ty - reserveTiles.height + 1,
        reserveTiles.width,
        reserveTiles.height,
      );
    } else {
      this.reserve(tx, ty);
    }
  }

  /**
   * Scatters objects across a rectangle on a jittered lattice.
   *
   * A lattice rather than pure random placement: random points clump and leave
   * bald patches, which reads as sloppy at this scale. `spacing` controls
   * density and `chance` punches holes so the result is not a visible grid.
   */
  scatterObjects(atlas, frames, rect, { spacing = 3, chance = 0.6, seed = 5, jitter = 1, avoidReserved = true } = {}) {
    for (let y = rect.y; y < rect.y + rect.height; y += spacing) {
      for (let x = rect.x; x < rect.x + rect.width; x += spacing) {
        if (hash2(x, y, seed) > chance) continue;
        const jx = x + Math.round((hash2(x, y, seed + 1) - 0.5) * 2 * jitter);
        const jy = y + Math.round((hash2(x, y, seed + 2) - 0.5) * 2 * jitter);
        if (!this.inBounds(jx, jy)) continue;
        if (avoidReserved && this.isReserved(jx, jy)) continue;
        const pick = Math.floor(hash2(jx, jy, seed + 3) * frames.length) % frames.length;
        this.addObject(atlas, frames[pick], jx, jy);
      }
    }
  }

  addCollisionRect(tx, ty, tw, th) {
    this.collision.push({
      id: this.nextObjectId++,
      name: `collision_${this.collision.length}`,
      x: tx * TILE, y: ty * TILE, width: tw * TILE, height: th * TILE,
    });
  }

  addTrigger(name, tx, ty, tw, th, properties) {
    this.triggers.push({
      id: this.nextObjectId++,
      name,
      x: tx * TILE, y: ty * TILE, width: tw * TILE, height: th * TILE,
      properties,
    });
  }

  addZone(name, tx, ty, tw, th, { zoneId = name, displayName = name, type = 'encounter' } = {}) {
    this.zones.push({
      id: this.nextObjectId++,
      name,
      x: tx * TILE, y: ty * TILE, width: tw * TILE, height: th * TILE,
      properties: { zoneId, displayName, type },
    });
  }

  addSpawn(name, tx, ty, facing = 'down') {
    this.spawns.push({
      id: this.nextObjectId++,
      name,
      x: Math.round(tx * TILE + TILE / 2),
      y: Math.round(ty * TILE + TILE),
      properties: { facing },
    });
  }

  addNpc(name, sprite, tx, ty, { facing = 'down', label = 'Talk', dialogueId, hideWhenFlag } = {}) {
    this.npcs.push({
      id: this.nextObjectId++,
      name,
      x: Math.round(tx * TILE + TILE / 2),
      y: Math.round(ty * TILE + TILE),
      properties: { sprite, facing, label, dialogueId, hideWhenFlag },
    });
    this.reserve(tx, ty);
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  toTiledProperties(record) {
    return Object.entries(record)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([name, value]) => ({
        name,
        type: typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'float' : 'string',
        value,
      }));
  }

  toTiled() {
    this.resolveAutotiles();

    // Layer order here IS render order; see TILE_LAYERS in map-types.ts.
    const ORDER = ['Ground', 'Terrain', 'Water', 'Paths', 'DecorationBelow', 'DecorationAbove', 'Foreground'];
    const layers = [];
    let layerId = 1;

    for (const name of ORDER) {
      if (!this.layers.has(name)) continue;
      const data = this.layers.get(name);
      layers.push({
        id: layerId++,
        name,
        type: 'tilelayer',
        x: 0, y: 0,
        width: this.width,
        height: this.height,
        opacity: 1,
        visible: true,
        // Tiled gids are 1-based with 0 meaning "no tile"; firstgid is 1.
        data: Array.from(data, v => (v < 0 ? 0 : v + 1)),
      });
    }

    const objectGroup = (name, items, mapProps) => ({
      id: layerId++,
      name,
      type: 'objectgroup',
      draworder: 'topdown',
      opacity: 1,
      // Gameplay-only layers; never drawn even when opened in Tiled.
      visible: name === 'Objects' || name === 'NPCs',
      x: 0, y: 0,
      objects: items.map(item => ({
        id: item.id,
        name: item.name,
        type: '',
        x: item.x,
        y: item.y,
        width: item.width ?? 0,
        height: item.height ?? 0,
        rotation: 0,
        visible: true,
        ...(item.width === undefined ? { point: true } : {}),
        properties: this.toTiledProperties(mapProps ? mapProps(item) : (item.properties ?? {})),
      })),
    });

    layers.push(objectGroup('Objects', this.objects, o => ({
      atlas: o.atlas, frame: o.frame, above: o.above || undefined,
    })));
    layers.push(objectGroup('Collision', this.collision, () => ({})));
    layers.push(objectGroup('EncounterZones', this.zones));
    layers.push(objectGroup('Triggers', this.triggers));
    layers.push(objectGroup('SpawnPoints', this.spawns));
    layers.push(objectGroup('NPCs', this.npcs));

    return {
      compressionlevel: -1,
      infinite: false,
      orientation: 'orthogonal',
      renderorder: 'right-down',
      tiledversion: '1.10.2',
      version: '1.10',
      type: 'map',
      width: this.width,
      height: this.height,
      tilewidth: TILE,
      tileheight: TILE,
      nextlayerid: layerId,
      nextobjectid: this.nextObjectId,
      properties: this.toTiledProperties({
        kind: this.kind,
        displayName: this.displayName,
        walkSpeed: this.walkSpeed,
      }),
      tilesets: [{ firstgid: 1, ...this.tilesetJson }],
      layers,
    };
  }
}
