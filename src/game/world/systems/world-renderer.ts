// src/game/world/systems/world-renderer.ts
//
// Data-driven world map renderer.
// Reads a WorldMapConfig and paints terrain, rivers, roads, and landmarks
// using Phaser Graphics primitives. Placeholder visuals — no art assets.
//
// Render order (back to front):
//   1. Sea base — covers the entire map; shows through where no region paints.
//   2. Regions — painted in array order; later regions overwrite earlier ones.
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

/**
 * Visual size multiplier applied to landmark rectangles. The config carries
 * a "footprint" size; the renderer paints the icon at this fraction of that
 * footprint, centred on the original centre. Tune here to scale all
 * landmarks at once without touching individual config entries.
 */
const LANDMARK_VISUAL_SCALE = 0.62;

const ROAD_COLOR: Record<WorldRoad['style'], { edge: number; main: number; centre: number }> = {
  dirt:  { edge: 0x6a5028, main: 0xc4a866, centre: 0xd4bc7e },
  stone: { edge: 0x4a4a52, main: 0xa0a0a8, centre: 0xc4c4cc },
  wood:  { edge: 0x4a2e18, main: 0x8a6840, centre: 0xb09060 },
};

// ─── Public entry point ──────────────────────────────────────────────────────

/**
 * Paints the full world map onto the given scene from config data.
 * Call once during scene.create(). All draws happen on independent
 * Phaser.Graphics objects, so they cleanly tear down when the scene shuts down.
 */
export function renderWorld(scene: Phaser.Scene, config: WorldMapConfig): void {
  drawSea(scene, config);
  drawRegions(scene, config.regions ?? []);
  drawRivers(scene, config.rivers ?? []);
  drawRoads(scene, config.roads ?? []);
  drawLandmarks(scene, config.landmarks ?? []);
}

// ─── Sea base ────────────────────────────────────────────────────────────────

function drawSea(scene: Phaser.Scene, config: WorldMapConfig): void {
  const g = scene.add.graphics();
  const sea = TERRAIN.sea;

  g.fillStyle(sea.base, 1);
  g.fillRect(0, 0, config.mapWidth, config.mapHeight);

  // Sparse wave glints for visual interest at sea-level zoom
  g.fillStyle(sea.accent, 0.22);
  for (let y = 40; y < config.mapHeight; y += 110) {
    const offset = (y / 110) % 2 === 0 ? 0 : 60;
    for (let x = 40 + offset; x < config.mapWidth; x += 140) {
      g.fillEllipse(x, y, 28, 6);
    }
  }
}

// ─── Regions ─────────────────────────────────────────────────────────────────

function drawRegions(scene: Phaser.Scene, regions: WorldRegion[]): void {
  for (const region of regions) {
    const palette = TERRAIN[region.terrainKind];
    const g = scene.add.graphics();

    // Base fill
    g.fillStyle(palette.base, 1);
    g.fillRect(region.x, region.y, region.width, region.height);

    // Lightweight accent variation — a handful of ellipses gives the region
    // some surface variation without exploding the draw count.
    g.fillStyle(palette.accent, 0.28);
    for (let i = 0; i < 5; i++) {
      const ex = region.x + 40 + ((i * 137 + region.id.length * 13) % Math.max(40, region.width - 80));
      const ey = region.y + 30 + ((i * 91  + region.id.length * 17) % Math.max(30, region.height - 60));
      const ew = 60 + ((i * 17) % 80);
      const eh = 30 + ((i * 13) % 50);
      g.fillEllipse(ex, ey, ew, eh);
    }
    g.fillStyle(palette.shadow, 0.20);
    for (let i = 0; i < 3; i++) {
      const ex = region.x + 60 + ((i * 211 + region.id.length * 7) % Math.max(40, region.width - 100));
      const ey = region.y + 50 + ((i * 173 + region.id.length * 23) % Math.max(40, region.height - 80));
      const ew = 80 + ((i * 19) % 70);
      const eh = 40 + ((i * 11) % 40);
      g.fillEllipse(ex, ey, ew, eh);
    }

    drawTerrainTexture(g, region);
  }
}

function drawTerrainTexture(g: Phaser.GameObjects.Graphics, region: WorldRegion): void {
  switch (region.terrainKind) {
    case 'forest':
    case 'corrupted_forest': {
      const treeMain   = region.terrainKind === 'forest' ? 0x2a6428 : 0x1c2a14;
      const treeAccent = region.terrainKind === 'forest' ? 0x3e8c3a : 0x2a4418;
      const treeShadow = region.terrainKind === 'forest' ? 0x14380e : 0x080e06;
      const stepX = 56;
      const stepY = 46;
      for (let ty = region.y + 18; ty < region.y + region.height - 18; ty += stepY) {
        for (let tx = region.x + 18; tx < region.x + region.width - 18; tx += stepX) {
          const jx = ((tx * 17 + ty * 11) % 13) - 6;
          const jy = ((tx * 13 + ty * 7)  % 11) - 5;
          const r  = 10 + ((tx * 5 + ty * 3) % 5);
          g.fillStyle(treeShadow, 0.55);
          g.fillCircle(tx + jx + 3, ty + jy + 3, r);
          g.fillStyle(treeMain, 1);
          g.fillCircle(tx + jx, ty + jy, r);
          g.fillStyle(treeAccent, 0.45);
          g.fillCircle(tx + jx - 2, ty + jy - 2, r * 0.5);
        }
      }
      // Sickly wisp glow over corrupted forest
      if (region.terrainKind === 'corrupted_forest') {
        g.fillStyle(0x3a8888, 0.18);
        for (let wy = region.y + 60; wy < region.y + region.height - 40; wy += 110) {
          for (let wx = region.x + 70; wx < region.x + region.width - 60; wx += 140) {
            g.fillCircle(wx, wy, 18);
          }
        }
      }
      break;
    }

    case 'mountain': {
      // Peak ellipses to suggest crags from overhead
      const stepX = 80;
      const stepY = 70;
      for (let py = region.y + 30; py < region.y + region.height - 20; py += stepY) {
        for (let px = region.x + 40; px < region.x + region.width - 40; px += stepX) {
          const jx = ((px * 13) % 21) - 10;
          // SE shadow
          g.fillStyle(0x4e4030, 0.5);
          g.fillEllipse(px + jx + 6, py + 6, 64, 38);
          // peak body
          g.fillStyle(0x9a8c78, 1);
          g.fillEllipse(px + jx, py, 64, 38);
          // NW highlight
          g.fillStyle(0xc8bcA0, 0.45);
          g.fillEllipse(px + jx - 8, py - 6, 30, 18);
        }
      }
      break;
    }

    case 'blight': {
      // Purple corruption wisps + sparse skull-grey patches
      g.fillStyle(0x6c30aa, 0.30);
      for (let wy = region.y + 30; wy < region.y + region.height - 20; wy += 70) {
        for (let wx = region.x + 30; wx < region.x + region.width - 20; wx += 80) {
          const jx = ((wx * 11) % 13) - 6;
          g.fillCircle(wx + jx, wy, 20);
        }
      }
      g.fillStyle(0x8a4cd4, 0.18);
      for (let wy = region.y + 50; wy < region.y + region.height - 40; wy += 100) {
        for (let wx = region.x + 70; wx < region.x + region.width - 50; wx += 120) {
          g.fillCircle(wx, wy, 10);
        }
      }
      break;
    }

    case 'rocky':
    case 'dust': {
      // Pebbles and dust specks
      const speckColor = region.terrainKind === 'rocky' ? 0x5a4e3c : 0x6e4c28;
      g.fillStyle(speckColor, 0.55);
      const stepX = 40;
      const stepY = 36;
      for (let ry = region.y + 14; ry < region.y + region.height - 10; ry += stepY) {
        for (let rx = region.x + 14; rx < region.x + region.width - 10; rx += stepX) {
          const r = 2 + (((rx * 7 + ry * 11) % 5));
          g.fillCircle(rx, ry, r);
        }
      }
      break;
    }

    // plains, sea, sand, snow — base + accent ellipses are enough
    default:
      break;
  }
}

// ─── Rivers ──────────────────────────────────────────────────────────────────

function drawRivers(scene: Phaser.Scene, rivers: WorldRiver[]): void {
  for (const river of rivers) {
    if (river.points.length < 2) continue;
    const g = scene.add.graphics();
    // Sandy banks
    drawPolyline(g, river.points, river.width + 10, 0xd6b870, 0.85);
    // Water body
    drawPolyline(g, river.points, river.width, TERRAIN.sea.base, 1);
    // Sparkle line
    drawPolyline(g, river.points, Math.max(2, river.width - 12), TERRAIN.sea.accent, 0.55);
  }
}

// ─── Roads ───────────────────────────────────────────────────────────────────

function drawRoads(scene: Phaser.Scene, roads: WorldRoad[]): void {
  for (const road of roads) {
    if (road.points.length < 2) continue;
    const colors = ROAD_COLOR[road.style];
    const g = scene.add.graphics();
    drawPolyline(g, road.points, road.width + 4, colors.edge,   0.75);
    drawPolyline(g, road.points, road.width,     colors.main,   1);
    drawPolyline(g, road.points, Math.max(2, road.width - 6),
                                 colors.centre, 0.5);
  }
}

// ─── Landmarks ───────────────────────────────────────────────────────────────

function drawLandmarks(scene: Phaser.Scene, landmarks: WorldLandmark[]): void {
  for (const lm of landmarks) {
    const palette = LANDMARK[lm.kind];
    const g = scene.add.graphics();

    // Scale around the original footprint centre so labels remain anchored.
    const cx = lm.x + lm.width  / 2;
    const cy = lm.y + lm.height / 2;
    const w  = lm.width  * LANDMARK_VISUAL_SCALE;
    const h  = lm.height * LANDMARK_VISUAL_SCALE;
    const x  = cx - w / 2;
    const y  = cy - h / 2;

    // Drop shadow
    g.fillStyle(0x000000, 0.40);
    g.fillRoundedRect(x + 4, y + 4, w, h, 5);

    // Footprint
    g.fillStyle(palette.fill, 1);
    g.fillRoundedRect(x, y, w, h, 5);

    // Roof / inner emblem block
    const innerW = w * 0.70;
    const innerH = h * 0.55;
    g.fillStyle(palette.roof, 1);
    g.fillRoundedRect(cx - innerW / 2, cy - innerH / 2, innerW, innerH, 4);

    // Accent dot
    g.fillStyle(palette.accent, 1);
    g.fillCircle(cx, cy, Math.min(w, h) * 0.13);

    // Border
    g.lineStyle(2, 0x0a0808, 0.85);
    g.strokeRoundedRect(x, y, w, h, 5);

    if (lm.label) {
      scene.add.text(cx, y - 4, lm.label, {
        fontFamily: FONTS.ui,
        fontSize:   '14px',
        color:      palette.label,
        fontStyle:  'bold',
        stroke:     '#0a0f1a',
        strokeThickness: 3,
      }).setOrigin(0.5, 1);
    }
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
