import type { SimState, SimConfig, BandStats } from '../types';
import { clamp } from '../../utils/math';

/**
 * Band 9: Crowd Sentiment — FOMO / Fear (Section 10)
 * Produces a smoothed sentiment score from 0 (extreme fear) to 1 (extreme FOMO).
 *
 * Uses a single column mean (10 dice, σ ≈ 1.83) instead of the full band
 * mean (1000 dice, σ ≈ 0.183) so the signal has enough variance to
 * actually reach Fear/Greed/FOMO zones and enable squeezes.
 */
export function updateSentiment(state: SimState, config: SimConfig, stats: BandStats): void {
  // Column mean of 10 dice — σ ≈ 1.83 (column 75, independent from kappa's column 50)
  const sRaw = stats.colMeans[75];
  const sNormalized = (sRaw - 1) / 19.0; // Map [1, 20] → [0, 1]

  // Exponential smoothing
  state.sentiment_t = config.SENTIMENT_DECAY * state.sentiment_t + (1 - config.SENTIMENT_DECAY) * sNormalized;

  // Clamp
  state.sentiment_t = clamp(state.sentiment_t, 0.0, 1.0);
}
