import type { SimState, SimConfig, BandStats } from '../types';
import { clamp } from '../../utils/math';

/**
 * Band 11: Trend Driver — Ornstein-Uhlenbeck process for F_t
 *
 * F_t follows a growing trendline (7%/year) with dice-driven deviations.
 * Mean-reverts toward a RISING anchor, not a fixed $100.
 *
 * Like SPX: long-term upward drift, corrections pull back to trend,
 * crashes = extended periods below trend, recoveries take years.
 *
 * Signal: colMeans[25] from Band 11 (10 dice, std≈1.83).
 * Smoothed with EMA (half-life ~3.5 trading days).
 */

/** Update the trend signal EMA and apply OU drift to F_t. Called every tick. */
export function updateTrend(state: SimState, config: SimConfig, stats11: BandStats): void {
  // Step 1: EMA of normalized dice signal
  const raw = (stats11.colMeans[25] - 10.5) / 9.5;
  state.trendSignal_t = config.F_TREND_ALPHA * state.trendSignal_t + (1 - config.F_TREND_ALPHA) * raw;

  // Step 2: Growing anchor — compound growth from F_INIT
  const F_anchor = config.F_INIT * Math.exp(config.F_TREND_MU * state.tickCount);

  // Step 3: OU drift — mean-reverts toward the growing anchor
  const logDev = Math.log(state.F_t / F_anchor);
  const drift = config.F_TREND_MU - config.F_TREND_THETA * logDev + config.F_TREND_SIGMA * state.trendSignal_t;

  // Step 4: Apply multiplicatively
  state.F_t *= Math.exp(drift);

  // Safety clamp: ±90% from anchor in log-space (should never be hit)
  state.F_t = clamp(state.F_t, F_anchor * 0.1, F_anchor * 10);
}
