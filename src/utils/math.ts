/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Round a price to the nearest tick size */
export function roundToTick(price: number, tickSize: number = 0.01): number {
  return Math.round(price / tickSize) * tickSize;
}

/** Sign of a number: -1, 0, or +1 */
export function sign(x: number): -1 | 0 | 1 {
  if (x > 0) return 1;
  if (x < 0) return -1;
  return 0;
}
