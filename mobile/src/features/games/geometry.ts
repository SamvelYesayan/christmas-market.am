// Small geometry helpers for the tree and wheel games (unit-tested).

/** Same tree outline test as the website (viewBox 0–100). */
export function inTree(x: number, y: number) {
  if (y < 14 || y > 86) return false;
  const half = ((y - 10) / 76) * 40;
  return Math.abs(x - 50) < half;
}

/** Rotation (deg) that brings segment `index` of `n` under the top pointer after `turns` full turns. */
export function targetRotation(index: number, n: number, current: number, turns = 6) {
  const seg = 360 / n;
  const centre = index * seg + seg / 2;
  const base = current - (current % 360);
  return base + turns * 360 + (360 - centre);
}
