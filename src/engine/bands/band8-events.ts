import type { SimState, SimConfig, BandStats } from '../types';

/**
 * Band 8: News / Event Shocks (Section 9 + Section 15.2 fix)
 *
 * CRITICAL: Uses max/min of COLUMN MEANS, not band_mean.
 * With 1000 dice averaged, the band mean barely moves from 10.5.
 * Each column is only 10 dice, so its mean can swing more wildly.
 * Taking max of 100 column means gives rare-but-possible extreme readings.
 */
export function evaluateEvents(state: SimState, config: SimConfig, stats: BandStats): void {
  if (state.event_active === null) {
    // Section 15.2: Use max/min of column means instead of band mean
    const eventSignalHigh = Math.max(...stats.colMeans);
    const eventSignalLow = Math.min(...stats.colMeans);

    if (eventSignalHigh >= config.EVENT_HIGH_THRESH) {
      // Positive shock
      const magnitude = (eventSignalHigh - config.EVENT_HIGH_THRESH) / (20 - config.EVENT_HIGH_THRESH);
      state.event_active = {
        direction: 1,
        ticksRemaining: config.EVENT_DURATION,
        magnitude: magnitude * state.kappa_t, // Vol amplifies shocks
      };
    } else if (eventSignalLow <= config.EVENT_LOW_THRESH) {
      // Negative shock
      const magnitude = (config.EVENT_LOW_THRESH - eventSignalLow) / (config.EVENT_LOW_THRESH - 1);
      state.event_active = {
        direction: -1,
        ticksRemaining: config.EVENT_DURATION,
        magnitude: magnitude * state.kappa_t,
      };
    }
  } else {
    // Existing event decays
    state.event_active.ticksRemaining -= 1;
    state.event_active.magnitude *= 0.90;

    if (state.event_active.ticksRemaining <= 0) {
      state.event_active = null;
    }
  }
}
