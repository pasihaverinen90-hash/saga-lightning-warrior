// tools/asset-pipeline/lib/tileset.mjs
//
// Packs named 64px tiles into a tileset image plus a Tiled 1.10 tileset JSON
// and a runtime manifest. Shared by the terrain, autotile, structure and
// interior generators so every tileset in the game has identical layout rules.

import fs from 'node:fs';
import path from 'node:path';
import { writePng } from './png.mjs';
import { createImage, blit } from './image.mjs';
import { TILE, TILESET_COLUMNS } from './config.mjs';

/**
 * @param {object} options
 * @param {string} options.name        Tileset name, also the output basename.
 * @param {string} options.outDir      Directory to write PNG + JSON into.
 * @param {Array<{name: string, image: object, solid?: boolean, props?: object}>} options.tiles
 * @returns {{ name: string, indexByName: Record<string, number>, tileCount: number }}
 */
export function writeTileset({ name, outDir, tiles }) {
  const columns = Math.min(TILESET_COLUMNS, Math.max(1, tiles.length));
  const rows = Math.ceil(tiles.length / columns);
  const sheet = createImage(columns * TILE, rows * TILE);

  const indexByName = {};
  const tiledTiles = [];

  tiles.forEach((tile, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    blit(sheet, tile.image, col * TILE, row * TILE);
    indexByName[tile.name] = index;

    const properties = [];
    if (tile.solid) properties.push({ name: 'solid', type: 'bool', value: true });
    for (const [key, value] of Object.entries(tile.props ?? {})) {
      properties.push({
        name: key,
        type: typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'float' : 'string',
        value,
      });
    }
    // Tiles are addressed by name at runtime; keeping the name as a property
    // means the tileset stays self-describing when opened in Tiled.
    properties.push({ name: 'name', type: 'string', value: tile.name });
    tiledTiles.push({ id: index, properties });
  });

  fs.mkdirSync(outDir, { recursive: true });
  const pngPath = path.join(outDir, `${name}.png`);
  writePng(pngPath, sheet.width, sheet.height, sheet.data);

  const tiledTileset = {
    columns,
    image: `${name}.png`,
    imagewidth: sheet.width,
    imageheight: sheet.height,
    margin: 0,
    name,
    spacing: 0,
    tilecount: tiles.length,
    tiledversion: '1.10.2',
    tileheight: TILE,
    tilewidth: TILE,
    type: 'tileset',
    version: '1.10',
    tiles: tiledTiles,
  };
  fs.writeFileSync(
    path.join(outDir, `${name}.json`),
    `${JSON.stringify(tiledTileset, null, 2)}\n`,
  );

  return { name, indexByName, tileCount: tiles.length, columns, rows, width: sheet.width, height: sheet.height };
}
