// src/game/maps/systems/tile-collision.ts
// Pure TypeScript. No Phaser.
//
// A uniform grid of solid flags covering the whole map, plus the query object
// movement-system.ts consumes.
//
// Why a grid rather than a rectangle list: a 60x40 map can easily contain a
// couple of thousand solid tiles, and the old `Rect[]` path in
// movement-system.ts tests every rectangle on every axis of every frame. That
// is O(n) per frame and would cost roughly 4000 overlap tests at 60fps here.
// A bitmask makes the same test O(1) per overlapped tile — at most four tiles
// for a player-sized body — regardless of how large or how dense the map is.
//
// Object footprints (a tree trunk, a building base) are stamped into the same
// grid, so there is exactly one collision representation to reason about.

import type { Rect } from '../../shared/movement-system';

export class TileCollisionGrid {
  private readonly solid: Uint8Array;

  constructor(
    public readonly widthInTiles: number,
    public readonly heightInTiles: number,
    public readonly tileSize: number,
  ) {
    this.solid = new Uint8Array(widthInTiles * heightInTiles);
  }

  /** Marks a single tile solid. Out-of-range coordinates are ignored. */
  setSolidTile(tileX: number, tileY: number): void {
    if (tileX < 0 || tileY < 0 || tileX >= this.widthInTiles || tileY >= this.heightInTiles) return;
    this.solid[tileY * this.widthInTiles + tileX] = 1;
  }

  /**
   * Marks every tile the pixel rectangle touches as solid.
   *
   * Uses `ceil` on the far edge so a footprint that covers even part of a tile
   * blocks that whole tile. Erring toward blocking keeps the player out of
   * scenery; the alternative lets them clip into tree trunks.
   */
  addRect(rect: Rect): void {
    const minX = Math.floor(rect.x / this.tileSize);
    const minY = Math.floor(rect.y / this.tileSize);
    const maxX = Math.ceil((rect.x + rect.width) / this.tileSize) - 1;
    const maxY = Math.ceil((rect.y + rect.height) / this.tileSize) - 1;
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) this.setSolidTile(tx, ty);
    }
  }

  isSolidTile(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileY < 0 || tileX >= this.widthInTiles || tileY >= this.heightInTiles) {
      return true; // outside the map is always solid
    }
    return this.solid[tileY * this.widthInTiles + tileX] === 1;
  }

  /** True if any tile overlapping the given pixel rectangle is solid. */
  isSolid(x: number, y: number, width: number, height: number): boolean {
    const minX = Math.floor(x / this.tileSize);
    const minY = Math.floor(y / this.tileSize);
    // Subtracting one epsilon-ish pixel keeps a body whose right edge sits
    // exactly on a tile boundary from testing the next tile along, which would
    // otherwise make the player one pixel wider than they look.
    const maxX = Math.floor((x + width - 0.001) / this.tileSize);
    const maxY = Math.floor((y + height - 0.001) / this.tileSize);
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        if (this.isSolidTile(tx, ty)) return true;
      }
    }
    return false;
  }

  /** Solid tiles as pixel rectangles. Debug rendering only. */
  toDebugRects(): Rect[] {
    const rects: Rect[] = [];
    for (let ty = 0; ty < this.heightInTiles; ty++) {
      for (let tx = 0; tx < this.widthInTiles; tx++) {
        if (!this.isSolidTile(tx, ty)) continue;
        rects.push({
          x: tx * this.tileSize,
          y: ty * this.tileSize,
          width: this.tileSize,
          height: this.tileSize,
        });
      }
    }
    return rects;
  }

  get solidCount(): number {
    let n = 0;
    for (let i = 0; i < this.solid.length; i++) n += this.solid[i];
    return n;
  }
}
