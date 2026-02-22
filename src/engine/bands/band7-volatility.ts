import type { SimState, BandStats } from '../types';
import { clamp } from '../../utils/math';

/**
 * Band 7: Volatility Regime (Section 4)
 * Computes kappa_t — the volatility multiplier used by all other bands.
 *
 * Uses a single column mean (10 dice, σ ≈ 1.83) instead of the full band
 * mean (1000 dice, σ ≈ 0.183) so the signal has enough variance to
 * actually exit the normal-regime dead zone and drive regime switching.
 */
export function updateKappa(state: SimState, stats: BandStats): void {
  // Column mean of 10 dice — σ ≈ 1.83, enough variance to leave the dead zone
  const v = stats.colMeans[50];

  // Primary mapping (piecewise linear, narrower dead zone [9,12])
  let kappaRaw: number;
  if (v <= 5) {
    kappaRaw = 0.3;                                    // extreme low vol
  } else if (v <= 9) {
    kappaRaw = 0.3 + (v - 5) * (0.7 / 4);            // 0.3 -> 1.0
  } else if (v <= 12) {
    kappaRaw = 1.0;                                    // normal regime
  } else if (v <= 16) {
    kappaRaw = 1.0 + (v - 12) * (1.5 / 4);           // 1.0 -> 2.5
  } else {
    kappaRaw = 2.5 + (v - 16) * (1.5 / 4);           // 2.5 -> 4.0
  }

  // Column-level disagreement bonus: boost κ when columns show unusual spread
  // Expected column-mean std ≈ 1.83; threshold at 2.5 catches rare extremes
  const colStd = computeColMeanStd(stats.colMeans, v);
  if (colStd > 2.5) {
    kappaRaw *= 1.0 + (colStd - 2.5) * 0.2;
  }

  // Smooth — 0.70/0.30 allows faster regime transitions (half-life ≈ 2 ticks)
  state.kappa_t = 0.70 * state.kappa_t + 0.30 * kappaRaw;

  // Clamp
  state.kappa_t = clamp(state.kappa_t, 0.2, 5.0);
}

/** Compute std of column means (fast — 100 values) */
function computeColMeanStd(colMeans: number[], mean: number): number {
  let sumSq = 0;
  for (let i = 0; i < colMeans.length; i++) {
    const diff = colMeans[i] - mean;
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq / colMeans.length);
}
