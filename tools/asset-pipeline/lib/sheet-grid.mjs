// tools/asset-pipeline/lib/sheet-grid.mjs
//
// Detects the cell grid of the terrain contact sheet (File A).
//
// The sheet is not a clean tileset: it has black separator lines drawn between
// cells, and its ROW HEIGHTS ARE NOT UNIFORM (measured 83, 82, 81, 82, 124,
// 167, 122, 177, 127, 182). Assuming a uniform grid would slice straight
// through the taller artwork rows, so the grid is detected from the separators
// themselves rather than hard-coded.

/**
 * A separator pixel is near-black AND desaturated. Requiring low saturation
 * stops dark green tree shadows and deep water from registering as grid lines.
 */
function isSeparatorPixel(img, x, y) {
  const i = (y * img.width + x) * 4;
  const r = img.data[i];
  const g = img.data[i + 1];
  const b = img.data[i + 2];
  return r < 50 && g < 50 && b < 50 && Math.max(r, g, b) - Math.min(r, g, b) < 24;
}

function axisProfile(img, along) {
  const length = along === 'row' ? img.height : img.width;
  const across = along === 'row' ? img.width : img.height;
  const profile = new Float64Array(length);
  for (let i = 0; i < length; i++) {
    let hits = 0;
    for (let j = 0; j < across; j++) {
      const x = along === 'row' ? j : i;
      const y = along === 'row' ? i : j;
      if (isSeparatorPixel(img, x, y)) hits++;
    }
    profile[i] = hits / across;
  }
  return profile;
}

/**
 * Groups runs of high-coverage indices into separator bands.
 * A genuine separator spans essentially the whole axis, so the cut is high;
 * content-induced darkness never does.
 */
function findBands(profile, cut) {
  const hits = [];
  for (let i = 0; i < profile.length; i++) if (profile[i] >= cut) hits.push(i);
  if (!hits.length) return [];
  const bands = [];
  let current = [hits[0]];
  for (let i = 1; i < hits.length; i++) {
    if (hits[i] - hits[i - 1] <= 3) current.push(hits[i]);
    else { bands.push(current); current = [hits[i]]; }
  }
  bands.push(current);
  return bands.map(b => ({ from: b[0], to: b[b.length - 1] }));
}

function bandsToCells(bands, minSize) {
  const cells = [];
  for (let i = 0; i < bands.length - 1; i++) {
    const start = bands[i].to + 1;
    const end = bands[i + 1].from - 1;
    const size = end - start + 1;
    if (size >= minSize) cells.push({ start, size });
  }
  return cells;
}

/**
 * Returns `{ cols, rows }`, each an array of `{ start, size }` in pixels.
 *
 * `minCellSize` filters out the cropped partial column on the right edge of
 * the supplied sheet (measured 60px against a 82-83px norm), which contains
 * only a sliver of artwork and is not usable as a tile.
 */
export function detectSheetGrid(img, { cut = 0.55, minCellSize = 70 } = {}) {
  const colBands = findBands(axisProfile(img, 'col'), cut);
  const rowBands = findBands(axisProfile(img, 'row'), cut);
  return {
    cols: bandsToCells(colBands, minCellSize),
    rows: bandsToCells(rowBands, minCellSize),
  };
}
