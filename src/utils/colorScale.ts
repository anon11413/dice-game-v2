/**
 * Map a dice value (1-20) to a heatmap color.
 * 1 = deep blue (cold), 10-11 = neutral gray, 20 = bright red (hot).
 */
export function diceColor(value: number): string {
  // Normalize to [0, 1]
  const t = (value - 1) / 19;

  if (t < 0.5) {
    // Blue to gray
    const s = t * 2; // 0 to 1
    const r = Math.round(30 + s * 100);
    const g = Math.round(50 + s * 80);
    const b = Math.round(200 - s * 70);
    return `rgb(${r},${g},${b})`;
  } else {
    // Gray to red
    const s = (t - 0.5) * 2; // 0 to 1
    const r = Math.round(130 + s * 125);
    const g = Math.round(130 - s * 100);
    const b = Math.round(130 - s * 100);
    return `rgb(${r},${g},${b})`;
  }
}

/** Get RGB components for canvas rendering (faster than string) */
export function diceColorRGB(value: number): [number, number, number] {
  const t = (value - 1) / 19;

  if (t < 0.5) {
    const s = t * 2;
    return [
      Math.round(30 + s * 100),
      Math.round(50 + s * 80),
      Math.round(200 - s * 70),
    ];
  } else {
    const s = (t - 0.5) * 2;
    return [
      Math.round(130 + s * 125),
      Math.round(130 - s * 100),
      Math.round(130 - s * 100),
    ];
  }
}

/** Pre-computed color lookup table for values 1-20 (RGB) */
export const DICE_COLOR_LUT: [number, number, number][] = [];
for (let v = 1; v <= 20; v++) {
  DICE_COLOR_LUT.push(diceColorRGB(v));
}
