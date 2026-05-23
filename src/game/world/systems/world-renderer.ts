// src/game/world/systems/world-renderer.ts
//
// Data-driven world map renderer.
// Reads a WorldMapConfig and paints terrain, rivers, roads, and landmarks
// using Phaser Graphics primitives. Placeholder visuals — no art assets.
//
// Performance-first: the entire map is drawn into a small number of
// Phaser.Graphics objects (sea / regions / rivers / roads / landmarks),
// and decoration is intentionally sparse. Even though we only build the
// command buffer once (in scene create), Phaser re-submits Graphics
// geometry every frame — so total shape count is what governs FPS.
//
// Render order (back to front):
//   1. Sea base — covers the entire map; shows through where no region paints.
//   2. Regions — painted in array order; later regions overwrite earlier ones.
//      Decoration is layered on top of regions in the SAME graphics object.
//   3. Rivers — decorative polylines on top of regions.
//   4. Roads — polylines connecting waypoints.
//   5. Landmarks — labelled rectangles for towns / dungeons / ports / etc.
//
// Trigger markers and the player are drawn by WorldMapScene itself, on top
// of everything painted here.

import Phaser from 'phaser';
import { FONTS, COLOR_HEX } from '../../core/config';
import type {
  WorldMapConfig,
  WorldRegion,
  WorldRoad,
  WorldRiver,
  WorldLandmark,
  LandmarkKind,
  TerrainKind,
} from '../types/world-types';

// ─── Detail toggles ──────────────────────────────────────────────────────────

/**
 * Master switch for any decoration beyond the base terrain colour fill.
 * Turn off for the cheapest possible render — base regions, rivers, roads,
 * and landmark icons only, no trees / pebbles / mountain peaks / wisps.
 */
const ENABLE_WORLD_DECORATION = true;

/**
 * 'low'     — sparse trees + occasional mountain peaks + a few blight wisps.
 *             Skips pebbles, sand specks, wave glints, and accent ellipses.
 *             Suggested default for greybox; ~150 decoration shapes total.
 * 'minimal' — base region colour only; ignores ENABLE_WORLD_DECORATION
 *             when set, since there is nothing extra to draw.
 */
type DetailLevel = 'low' | 'minimal';
const WORLD_RENDER_DETAIL: DetailLevel = 'low';

/**
 * Visual size multiplier applied to landmark rectangles. The config carries
 * a "footprint" size; the renderer paints the icon at this fraction of that
 * footprint, centred on the original centre. Tune here to scale all
 * landmarks at once without touching individual config entries.
 */
const LANDMARK_VISUAL_SCALE = 0.6;

// ─── Palettes ────────────────────────────────────────────────────────────────

interface TerrainPalette {
  base: number;
  accent: number;
  shadow: number;
}

const TERRAIN: Record<TerrainKind, TerrainPalette> = {
  plains:           { base: 0x58a038, accent: 0x72be4e, shadow: 0x3c7422 },
  forest:           { base: 0x2e6e2a, accent: 0x3e8c3a, shadow: 0x1c4416 },
  corrupted_forest: { base: 0x1c3414, accent: 0x2a4418, shadow: 0x0a1208 },
  mountain:         { base: 0x7a6c58, accent: 0x9a8c78, shadow: 0x4e4030 },
  rocky:            { base: 0x8a7c66, accent: 0x9e9078, shadow: 0x5a4e3c },
  dust:             { base: 0xa48050, accent: 0xb89868, shadow: 0x6e4c28 },
  sea:              { base: 0x2c5896, accent: 0x4a7cb8, shadow: 0x1c3868 },
  sand:             { base: 0xd6b870, accent: 0xe8cc88, shadow: 0xa88e50 },
  snow:             { base: 0xeeeef8, accent: 0xffffff, shadow: 0xc8cce0 },
  blight:           { base: 0x381040, accent: 0x4c2058, shadow: 0x1a0820 },
};

interface LandmarkPalette {
  fill:   number;
  roof:   number;
  accent: number;
  label:  string;
}

const LANDMARK: Record<LandmarkKind, LandmarkPalette> = {
  village:  { fill: 0xc8a874, roof: 0xa8784e, accent: 0x7a4a20, label: COLOR_HEX.parchment },
  town:     { fill: 0xc4a466, roof: 0xa86840, accent: 0x6a3a18, label: COLOR_HEX.parchment },
  capital:  { fill: 0xd2b070, roof: 0xa83440, accent: 0xe8c830, label: COLOR_HEX.goldAccent },
  port:     { fill: 0x9aac90, roof: 0x5a7490, accent: 0x3a5070, label: COLOR_HEX.iceBlue },
  gate:     { fill: 0x807060, roof: 0x5a4e44, accent: 0xa84747, label: COLOR_HEX.villainName },
  shrine:   { fill: 0xd0c4a8, roof: 0x8898b0, accent: 0xe8d25f, label: COLOR_HEX.goldAccent },
  ruin:     { fill: 0x8a7e6a, roof: 0x6a5e4c, accent: 0x4a3c2a, label: COLOR_HEX.parchment },
  fortress: { fill: 0x6e6a64, roof: 0x4a3a36, accent: 0xa84747, label: COLOR_HEX.villainName },
  citadel:  { fill: 0x382838, roof: 0x180a18, accent: 0xa84747, label: COLOR_HEX.villainName },
  island:   { fill: 0xd6b870, roof: 0x8898b0, accent: 0xe8d25f, label: COLOR_HEX.iceBlue },
  dungeon:  { fill: 0x6a6260, roof: 0x4a3e3c, accent: 0x2a1c1c, label: COLOR_HEX.villainName },
};

const ROAD_COLOR: Record<WorldRoad['style'], { edge: number; main: number }> = {
  dirt:  { edge: 0x6a5028, main: 0xc4a866 },
  stone: { edge: 0x4a4a52, main: 0xa0a0a8 },
  wood:  { edge: 0x4a2e18, main: 0x8a6840 },
};

// ─── Public entry point ──────────────────────────────────────────────────────

/**
 * Paints the full world map onto the given scene from config data.
 * Call once during scene.create().
 *
 * Uses 5 Graphics objects (sea, terrain, rivers, roads, landmarks) plus
 * one Text per landmark label. Total shape count in 'low' detail is well
 * under 300, which keeps Phaser's per-frame Graphics submission cheap.
 */
export function renderWorld(scene: Phaser.Scene, config: WorldMapConfig): void {
  drawSea(scene, config);
  drawTerrain(scene, config.regions ?? []);
  drawRivers(scene, config.rivers ?? []);
  drawRoads(scene, config.roads ?? []);
  drawLandmarks(scene, config.landmarks ?? []);
}

// ─── Sea base ────────────────────────────────────────────────────────────────

function drawSea(scene: Phaser.Scene, config: WorldMapConfig): void {
  const g = scene.add.graphics();
  g.fillStyle(TERRAIN.sea.base, 1);
  g.fillRect(0, 0, config.mapWidth, config.mapHeight);
  // Wave glints removed — they cost ~600 ellipses per frame and the
  // sea reads fine as a flat colour at greybox stage.
}

// ─── Terrain (regions + decoration, all into one Graphics) ───────────────────

function drawTerrain(scene: Phaser.Scene, regions: WorldRegion[]): void {
  const g = scene.add.graphics();

  // Pass 1: base region fills. Painted in array order so later regions can
  // override earlier ones (e.g. mountains overwrite the plains beneath them).
  for (const region of regions) {
    const palette = TERRAIN[region.terrainKind];
    g.fillStyle(palette.base, 1);
    g.fillRect(region.x, region.y, region.width, region.height);
  }

  // Pass 2: sparse decoration. Skipped entirely in minimal mode or when
  // ENABLE_WORLD_DECORATION is false.
  if (!ENABLE_WORLD_DECORATION || WORLD_RENDER_DETAIL === 'minimal') return;

  for (const region of regions) {
    decorateRegion(g, region);
  }
}

function decorateRegion(
  g: Phaser.GameObjects.Graphics,
  region: WorldRegion,
): void {
  switch (region.terrainKind) {
    case 'forest':
    case 'corrupted_forest': {
      // Sparse single-pass tree dots. ~1 tree per 90×90 area = ~25 trees
      // for the largest forest region in the world.
      const treeColor = region.terrainKind === 'forest' ? 0x2a6428 : 0x1a2812;
      const stepX = 90;
      const stepY = 90;
      g.fillStyle(treeColor, 1);
      for (let ty = region.y + 30; ty < region.y + region.height - 30; ty += stepY) {
        for (let tx = region.x + 30; tx < region.x + region.width - 30; tx += stepX) {
          const jx = ((tx * 13) % 19) - 9;
          const jy = ((ty * 11) % 17) - 8;
          g.fillCircle(tx + jx, ty + jy, 11);
        }
      }
      break;
    }

    case 'mountain': {
      // ~1 peak per 110×100 area.
      g.fillStyle(0x9a8c78, 1);
      const stepX = 110;
      const stepY = 100;
      for (let py = region.y + 40; py < region.y + region.height - 40; py += stepY) {
        for (let px = region.x + 50; px < region.x + region.width - 50; px += stepX) {
          g.fillEllipse(px, py, 56, 32);
        }
      }
      break;
    }

    case 'blight': {
      // ~1 wisp per 130×120 area.
      g.fillStyle(0x6c30aa, 0.35);
      const stepX = 130;
      const stepY = 120;
      for (let py = region.y + 50; py < region.y + region.height - 30; py += stepY) {
        for (let px = region.x + 50; px < region.x + region.width - 30; px += stepX) {
          g.fillCircle(px, py, 22);
        }
      }
      break;
    }

    // rocky / dust / plains / sea / sand / snow: base colour is enough.
    // The thousands of pebble specks the old renderer produced were the
    // main per-frame cost and offered marginal visual value.
    default:
      break;
  }
}

// ─── Rivers (all into one Graphics) ─────────────────────────────────────────

function drawRivers(scene: Phaser.Scene, rivers: WorldRiver[]): void {
  if (rivers.length === 0) return;
  const g = scene.add.graphics();
  for (const river of rivers) {
    if (river.points.length < 2) continue;
    // Bank + water — sparkle pass removed for perf and clarity.
    drawPolyline(g, river.points, river.width + 6, 0xd6b870, 0.85);
    drawPolyline(g, river.points, river.width,     TERRAIN.sea.base, 1);
  }
}

// ─── Roads (all into one Graphics) ───────────────────────────────────────────

function drawRoads(scene: Phaser.Scene, roads: WorldRoad[]): void {
  if (roads.length === 0) return;
  const g = scene.add.graphics();
  for (const road of roads) {
    if (road.points.length < 2) continue;
    const c = ROAD_COLOR[road.style];
    // Edge + main — centre highlight pass removed for perf.
    drawPolyline(g, road.points, road.width + 3, c.edge, 0.75);
    drawPolyline(g, road.points, road.width,     c.main, 1);
  }
}

// ─── Landmarks (icons batched into one Graphics; labels as Text objects) ────

function drawLandmarks(scene: Phaser.Scene, landmarks: WorldLandmark[]): void {
  if (landmarks.length === 0) return;
  const g = scene.add.graphics();

  for (const lm of landmarks) {
    const palette = LANDMARK[lm.kind];

    // Scale around the original footprint centre so labels remain anchored.
    const cx = lm.x + lm.width  / 2;
    const cy = lm.y + lm.height / 2;
    const w  = lm.width  * LANDMARK_VISUAL_SCALE;
    const h  = lm.height * LANDMARK_VISUAL_SCALE;
    const x  = cx - w / 2;
    const y  = cy - h / 2;

    // Footprint
    g.fillStyle(palette.fill, 1);
    g.fillRoundedRect(x, y, w, h, 4);

    // Inner emblem block
    const innerW = w * 0.66;
    const innerH = h * 0.52;
    g.fillStyle(palette.roof, 1);
    g.fillRoundedRect(cx - innerW / 2, cy - innerH / 2, innerW, innerH, 3);

    // Accent dot
    g.fillStyle(palette.accent, 1);
    g.fillCircle(cx, cy, Math.min(w, h) * 0.13);

    // Border
    g.lineStyle(2, 0x0a0808, 0.85);
    g.strokeRoundedRect(x, y, w, h, 4);
  }

  // Labels are separate game objects because Phaser Graphics can't paint text.
  for (const lm of landmarks) {
    if (!lm.label) continue;
    const palette = LANDMARK[lm.kind];
    const cx = lm.x + lm.width  / 2;
    const h  = lm.height * LANDMARK_VISUAL_SCALE;
    const top = (lm.y + lm.height / 2) - h / 2;
    // Smaller font compensates for WORLD_MAP_ZOOM scaling the text up.
    // At zoom 1.25 this renders at ~14 px on screen, comparable to the
    // pre-zoom 13 px.
    scene.add.text(cx, top - 4, lm.label, {
      fontFamily: FONTS.ui,
      fontSize:   '11px',
      color:      palette.label,
      fontStyle:  'bold',
      stroke:     '#0a0f1a',
      strokeThickness: 3,
    }).setOrigin(0.5, 1);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function drawPolyline(
  g: Phaser.GameObjects.Graphics,
  points: Array<{ x: number; y: number }>,
  width: number,
  color: number,
  alpha: number,
): void {
  if (points.length < 2) return;
  g.lineStyle(width, color, alpha);
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    g.lineTo(points[i].x, points[i].y);
  }
  g.strokePath();
}
