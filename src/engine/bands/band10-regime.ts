import type { SimState, BandStats } from '../types';
import { clamp } from '../../utils/math';

/**
 * Band 10: Meta-Regime — Trend vs Chop (Section 11)
 * Controls whether the market trends or mean-reverts.
 */
export function updateRegime(state: SimState, stats: BandStats): void {
  const rMean = stats.mean;
  const rStd = stats.std;

  // Trend persistence: probability that an agent continues the prior tick's direction
  let trendPersistence: number;
  if (rMean >= 14) {
    trendPersistence = 0.5 + ((rMean - 14) / 6) * 0.4;     // 0.5 -> 0.9
  } else if (rMean <= 7) {
    trendPersistence = 0.1 + ((rMean - 1) / 6) * 0.2;      // 0.1 -> 0.3
  } else {
    trendPersistence = 0.3 + ((rMean - 7) / 7) * 0.2;      // 0.3 -> 0.5
  }

  // Reversal probability: high std (disagreement) → more fakeouts
  const reversalProb = clamp((rStd - 4.0) / 6.0, 0.0, 0.4);

  state.regime_t = {
    trendPersistence,
    reversalProb,
  };
}
