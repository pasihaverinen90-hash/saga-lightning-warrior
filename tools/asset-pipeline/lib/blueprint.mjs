// tools/asset-pipeline/lib/blueprint.mjs
//
// Human-editable GRID authoring for maps.
//
// A blueprint describes a map as three character grids of identical size, one
// character per tile:
//
//   base  — what the ground of that square is made of  (grass, road, water...)
//   over  — what object stands on that square          (tree, barrel, house...)
//   marks — gameplay markers on that square            (spawn, trigger, NPC)
//
// plus a LEGEND that says what each character means. Because the legend maps a
// character to a NAMED tile or atlas frame, swapping in better artwork later is
// a one-line change: point `grass` at a new tile name, or drop a replacement
// PNG that keeps the same frame names, and every map re-renders with it. No map
// data has to be touched.
//
// Example:
//
//   base: [ '....rrr....' ]      legend.base: { '.': {tile:'grass'},
//   over: [ '..T.....B..' ]                     'r': {material:'road'} }
//   marks:[ '.....1.....' ]      legend.over: { 'T': {atlas:'overworld-objects',
//                                                     frames: TREES},
//                                               'B': {atlas:'structures',
//                                                     frame:'barrel'} }
//
// Objects larger than one tile are anchored by the square holding their BOTTOM
// CENTRE — the point where they meet the ground, which is also what depth
// sorting uses.

import { MapBuilder } from './map-builder.mjs';
import { hash2 } from './image.mjs';

/** Character meaning "nothing here". Valid in every grid. */
const EMPTY = '.';

function assertRectangular(grid, name, id) {
  if (!Array.isArray(grid) || grid.length === 0) {
    throw new Error(`${id}: blueprint "${name}" grid is empty`);
  }
  const width = grid[0].length;
  grid.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(
        `${id}: blueprint "${name}" row ${y} is ${row.length} chars, expected ${width}`,
      );
    }
  });
  return { width, height: grid.length };
}

/**
 * Builds a MapBuilder from a blueprint.
 *
 * Unknown characters are a hard error rather than being skipped: these grids
 * are hand-edited, and a silently ignored typo would show up as a mysterious
 * hole in the map long after the edit that caused it.
 */
export function buildFromBlueprint(blueprint, ctx) {
  const {
    id, kind, displayName, walkSpeed,
    legend, base, over = [], marks = [],
    groundFill,
    tileset = 'terrain',
  } = blueprint;

  const size = assertRectangular(base, 'base', id);
  if (over.length) {
    const overSize = assertRectangular(over, 'over', id);
    if (overSize.width !== size.width || overSize.height !== size.height) {
      throw new Error(`${id}: "over" grid is ${overSize.width}x${overSize.height}, base is ${size.width}x${size.height}`);
    }
  }
  if (marks.length) {
    const markSize = assertRectangular(marks, 'marks', id);
    if (markSize.width !== size.width || markSize.height !== size.height) {
      throw new Error(`${id}: "marks" grid is ${markSize.width}x${markSize.height}, base is ${size.width}x${size.height}`);
    }
  }

  const map = new MapBuilder({
    id, kind, displayName,
    width: size.width,
    height: size.height,
    tileset: tileset === 'interior' ? ctx.interior : ctx.terrain,
    tilesetJson: tileset === 'interior' ? ctx.interiorJson : ctx.terrainJson,
    walkSpeed,
  });

  if (groundFill) map.fillGround(groundFill, 17);

  // ── Pass 1: ground ────────────────────────────────────────────────────────
  for (let y = 0; y < size.height; y++) {
    for (let x = 0; x < size.width; x++) {
      const ch = base[y][x];
      if (ch === EMPTY) continue;
      const def = legend.base?.[ch];
      if (!def) throw new Error(`${id}: unknown base character "${ch}" at ${x},${y}`);
      if (def.material) {
        // Autotiled surface: register the cell, resolved after all painting.
        map.paintRect(def.layer ?? 'Paths', def.material, x, y, 1, 1, { reserve: true });
      } else if (def.tiles) {
        const pick = Math.floor(hash2(x, y, 29) * def.tiles.length) % def.tiles.length;
        map.setTile(def.layer ?? 'Terrain', x, y, def.tiles[pick]);
      } else if (def.tile) {
        map.setTile(def.layer ?? 'Terrain', x, y, def.tile);
      }
    }
  }

  // ── Pass 2: objects ───────────────────────────────────────────────────────
  for (let y = 0; y < size.height; y++) {
    for (let x = 0; x < size.width; x++) {
      const ch = over[y]?.[x];
      if (!ch || ch === EMPTY) continue;
      const def = legend.over?.[ch];
      if (!def) throw new Error(`${id}: unknown over character "${ch}" at ${x},${y}`);
      const frame = def.frame ?? def.frames[
        Math.floor(hash2(x, y, 31) * def.frames.length) % def.frames.length
      ];
      map.addObject(def.atlas, frame, x, y, {
        above: def.above,
        reserveTiles: def.size,
      });
    }
  }

  // ── Pass 3: markers ───────────────────────────────────────────────────────
  // Triggers spanning several squares are declared once and given every square
  // carrying their character, so the rectangle is drawn in the grid itself.
  const triggerCells = new Map();

  for (let y = 0; y < size.height; y++) {
    for (let x = 0; x < size.width; x++) {
      const ch = marks[y]?.[x];
      if (!ch || ch === EMPTY) continue;
      const def = legend.marks?.[ch];
      if (!def) throw new Error(`${id}: unknown mark character "${ch}" at ${x},${y}`);

      switch (def.type) {
        case 'spawn':
          map.addSpawn(def.name, x, y, def.facing ?? 'down');
          break;
        case 'npc':
          map.addNpc(def.name, def.sprite, x, y, {
            facing: def.facing,
            label: def.label,
            dialogueId: def.dialogueId,
            hideWhenFlag: def.hideWhenFlag,
          });
          break;
        case 'trigger': {
          const cells = triggerCells.get(ch) ?? [];
          cells.push({ x, y });
          triggerCells.set(ch, cells);
          break;
        }
        case 'zone': {
          const cells = triggerCells.get(ch) ?? [];
          cells.push({ x, y });
          triggerCells.set(ch, cells);
          break;
        }
        default:
          throw new Error(`${id}: mark "${ch}" has unknown type "${def.type}"`);
      }
    }
  }

  for (const [ch, cells] of triggerCells) {
    const def = legend.marks[ch];
    const minX = Math.min(...cells.map(c => c.x));
    const minY = Math.min(...cells.map(c => c.y));
    const maxX = Math.max(...cells.map(c => c.x));
    const maxY = Math.max(...cells.map(c => c.y));
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    if (def.type === 'zone') {
      map.addZone(def.name, minX, minY, w, h, {
        zoneId: def.zoneId ?? def.name,
        displayName: def.displayName ?? def.name,
        type: def.zoneType ?? 'encounter',
      });
    } else {
      map.addTrigger(def.name, minX, minY, w, h, def.properties);
    }
  }

  return map;
}
