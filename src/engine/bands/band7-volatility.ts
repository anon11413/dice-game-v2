import type { SimState, BandStats } from '../types';
import { clamp } from '../../utils/math';

/**
 * Band 7: Volatility Regime (Section 4)
 * Computes kappa_t — the volatility multiplier used by all other bands.
 */
export function updateKappa(state: SimState, stats: BandStats): void {
  const v = stats.mean;
  const vStd = stats.std;

  // Primary mapping (piecewise linear)
  let kappaRaw: number;
  if (v <= 5) {
    kappaRaw = 0.3;
  } else if (v <= 8) {
    kappaRaw = 0.3 + (v - 5) * (0.7 / 3);          // 0.3 -> 1.0
  } else if (v <= 13) {
    kappaRaw = 1.0;                                    // normal regime
  } else if (v <= 17) {
    kappaRaw = 1.0 + (v - 13) * (1.5 / 4);           // 1.0 -> 2.5
  } else {
    kappaRaw = 2.5 + (v - 17) * (1.5 / 3);           // 2.5 -> 4.0
  }

  // Intra-band disagreement bonus
  if (vStd > 7.0) {
    kappaRaw *= 1.0 + (vStd - 7.0) * 0.15;
  }

  // Smooth to avoid instant regime flips
  state.kappa_t = 0.7 * state.kappa_t + 0.3 * kappaRaw;

  // Clamp
  state.kappa_t = clamp(state.kappa_t, 0.2, 5.0);
}
