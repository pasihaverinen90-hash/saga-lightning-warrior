// src/game/world/systems/encounter-system.ts
// Pure TypeScript. Zone membership queries and step-based encounter tracking.
// Does NOT start battles — returns a picked enemy group when an encounter fires.
// BattleScene and WorldMapScene handle the actual transition.

import type { WorldZone } from '../types/world-types';
import type { EncounterTable, EnemyGroupEntry } from '../../data/maps/encounter-tables';

// ─── Zone queries ─────────────────────────────────────────────────────────────

/** Returns true if the entity center is inside the given zone rect. */
function centerInZone(
  entityX: number,
  entityY: number,
  entityW: number,
  entityH: number,
  zone: WorldZone,
): boolean {
  const cx = entityX + entityW / 2;
  const cy = entityY + entityH / 2;
  return (
    cx >= zone.x &&
    cx <= zone.x + zone.width &&
    cy >= zone.y &&
    cy <= zone.y + zone.height
  );
}

/**
 * Returns the first zone whose bounds contain the entity's center, or null.
 * Zones are evaluated in array order — list more-specific zones first in config.
 */
export function getActiveZone(
  entityX: number,
  entityY: number,
  entityW: number,
  entityH: number,
  zones: WorldZone[],
): WorldZone | null {
  for (const zone of zones) {
    if (centerInZone(entityX, entityY, entityW, entityH, zone)) {
      return zone;
    }
  }
  return null;
}

/**
 * Returns true if the entity is inside any zone marked as type 'encounter'.
 */
export function isInEncounterZone(
  entityX: number,
  entityY: number,
  entityW: number,
  entityH: number,
  zones: WorldZone[],
): boolean {
  const zone = getActiveZone(entityX, entityY, entityW, entityH, zones);
  return zone?.type === 'encounter';
}

// ─── Weighted group selection ─────────────────────────────────────────────────

/**
 * Picks one enemy group from a table using weighted random selection.
 * Returns the chosen EnemyGroupEntry.
 */
export function pickEncounterGroup(table: EncounterTable): EnemyGroupEntry {
  const totalWeight = table.groups.reduce((sum, g) => sum + g.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const group of table.groups) {
    roll -= group.weight;
    if (roll <= 0) return group;
  }
  // Fallback — should never reach here with well-formed tables
  return table.groups[table.groups.length - 1];
}

// ─── Encounter tracker ────────────────────────────────────────────────────────

/**
 * Tracks player steps inside an encounter zone and rolls for random battles.
 * Pure class — no Phaser, no state imports.
 *
 * Usage:
 *   const tracker = new EncounterTracker();
 *   // In update, when player moved one step in an encounter zone:
 *   const group = tracker.onStep(table);
 *   if (group) { // launch battle with group.enemyIds }
 *
 * Reset when entering a safe zone or after a battle fires.
 */
/**
 * One encounter "step" in pixels. The player must travel this far in an
 * encounter zone before a step is counted. Chosen to feel like one tile
 * of movement — independent of frame rate.
 */
const PIXELS_PER_STEP = 32;

export class EncounterTracker {
  /** Accumulated pixel distance since the last counted step. */
  private distanceAccum = 0;
  private steps = 0;
  private safeStepsRemaining: number;

  /**
   * @param safeStepsAfterBattle  Steps to skip rolling after a battle ends.
   *        Prevents the player being immediately caught again on return.
   */
  constructor(private readonly safeStepsAfterBattle = 6) {
    this.safeStepsRemaining = 0;
  }

  /**
   * Call every frame the player moves inside an encounter zone, passing the
   * actual pixel distance traveled this frame (from MovementResult).
   * Returns the picked EnemyGroupEntry if an encounter fires, or null.
   *
   * Steps are counted per PIXELS_PER_STEP of distance, not per frame,
   * making the system frame-rate independent.
   */
  onMove(distanceTraveled: number, table: EncounterTable): EnemyGroupEntry | null {
    this.distanceAccum += distanceTraveled;

    // Only count a step when enough distance has been covered
    if (this.distanceAccum < PIXELS_PER_STEP) return null;
    this.distanceAccum -= PIXELS_PER_STEP;

    if (this.safeStepsRemaining > 0) {
      this.safeStepsRemaining--;
      this.steps++;
      return null;
    }

    this.steps++;

    // Must exceed the minimum step threshold before rolling begins
    if (this.steps < table.minStepsBeforeEncounter) return null;

    // Roll once per counted step
    if (Math.random() < table.chancePerStep) {
      return pickEncounterGroup(table);
    }

    return null;
  }

  /**
   * Call when leaving an encounter zone or entering a safe area.
   * Resets the step counter and distance accumulator.
   */
  resetSteps(): void {
    this.steps = 0;
    this.distanceAccum = 0;
  }

  /**
   * Call immediately after a battle fires.
   * Resets steps and grants safe-steps immunity.
   */
  onBattleFired(): void {
    this.steps = 0;
    this.distanceAccum = 0;
    this.safeStepsRemaining = this.safeStepsAfterBattle;
  }
}

