// src/game/core/utils.ts
// Small, pure utility functions shared across modules.

/**
 * Clamps a value between min and max (inclusive).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Converts a hex number (0xRRGGBB) to a CSS hex string ('#RRGGBB').
 */
export function hexToString(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0').toUpperCase();
}

/**
 * Returns a random integer between min and max (inclusive).
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a random element from an array.
 */
export function randomChoice<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

/**
 * Returns a human-readable elapsed time string relative to now.
 * e.g. "just now", "4m ago", "2h ago", "3d ago"
 */
export function formatElapsedTime(timestampMs: number): string {
  const diffMs = Date.now() - timestampMs;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1)  return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
