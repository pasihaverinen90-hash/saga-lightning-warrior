// tools/asset-pipeline/debug-contact-sheet.mjs
//
// Verification helper (not part of `npm run assets`).
// Exports each detected row of the terrain sheet as a strip with numbered
// column separators, so the material manifest can be written against what the
// artwork actually contains instead of guesswork.
//
// Run: node tools/asset-pipeline/debug-contact-sheet.mjs

import fs from 'node:fs';
import path from 'node:path';
import { readPng, writePng } from './lib/png.mjs';
import { crop, createImage, blit, fillRect } from './lib/image.mjs';
import { detectSheetGrid } from './lib/sheet-grid.mjs';
import { SOURCES, OUT, CELL_INSET } from './lib/config.mjs';

fs.mkdirSync(OUT.debug, { recursive: true });

const sheet = readPng(SOURCES.terrainSheet);
const { cols, rows } = detectSheetGrid(sheet);

console.log(`sheet ${sheet.width}x${sheet.height}`);
console.log(`cols (${cols.length}):`, cols.map(c => `${c.start}+${c.size}`).join(' '));
console.log(`rows (${rows.length}):`, rows.map(r => `${r.start}+${r.size}`).join(' '));

const GAP = 4;

rows.forEach((row, rowIndex) => {
  const cellW = Math.max(...cols.map(c => c.size));
  const stripW = cols.length * (cellW + GAP) + GAP;
  const stripH = row.size + GAP * 2 + 10;
  const strip = createImage(stripW, stripH, [24, 24, 32, 255]);

  cols.forEach((col, colIndex) => {
    const cell = crop(
      sheet,
      col.start + CELL_INSET,
      row.start + CELL_INSET,
      col.size - CELL_INSET * 2,
      row.size - CELL_INSET * 2,
    );
    const x = GAP + colIndex * (cellW + GAP);
    blit(strip, cell, x, GAP);
    // Tick marks below each cell: a bar whose length encodes the column index
    // (every 5th is taller), enough to read indices off the exported image.
    const tickH = colIndex % 5 === 0 ? 8 : 4;
    fillRect(strip, x, stripH - tickH - 1, cell.width, tickH, [230, 200, 90, 255]);
  });

  const file = path.join(OUT.debug, `terrain-row-${rowIndex}.png`);
  writePng(file, strip.width, strip.height, strip.data);
  console.log(`row ${rowIndex} (y=${row.start} h=${row.size}) -> ${path.relative(process.cwd(), file)}`);
});
