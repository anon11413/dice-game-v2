import type { SimState, SimConfig, BandStats, Order } from '../types';
import type { PRNG } from '../prng';
import { createOrder } from '../orderbook/Order';
import { roundToTick } from '../../utils/math';

/**
 * Band 4: Fundamental Value Anchor (Section 5)
 * Updates the latent fundamental value F_t and generates value agent orders.
 */

/** Update F_t (every 65 ticks) — Section 5.1 */
export function updateFundamental(state: SimState, config: SimConfig, stats: BandStats): void {
  const f = stats.mean;

  let driftDirection: number;
  if (f > 12) {
    driftDirection = 1;
  } else if (f < 9) {
    driftDirection = -1;
  } else {
    driftDirection = 0;
  }

  // Magnitude scales with how extreme the dice are
  let driftMagnitude = config.F_DRIFT_RATE * Math.abs(f - 10.5) / 9.5;
  driftMagnitude *= state.F_t; // percentage-based

  state.F_t = state.F_t + driftDirection * driftMagnitude;
  state.F_t = Math.max(state.F_t, 0.01); // Floor to prevent negative
}

/** Generate value agent orders (every 65 ticks) — Section 5.2 */
export function generateValueOrders(
  state: SimState,
  config: SimConfig,
  stats: BandStats,
  prng: PRNG
): Order[] {
  const orders: Order[] = [];

  for (let j = 0; j < 100; j++) {
    const agentBias = stats.colMeans[j];
    const gap = state.P_t - state.F_t;
    const gapPct = gap / state.F_t;

    // Agent acts only if gap is meaningful
    if (Math.abs(gapPct) < 0.02) continue;

    if (gapPct > 0 && agentBias < 10) {
      // Price above fundamental AND agent dice lean bearish → SELL limit
      const size = Math.max(1, Math.floor(20 + (10 - agentBias) * 8 * state.kappa_t));
      const limitPrice = roundToTick(
        state.P_t + prng.uniform(0.01, 0.05 * state.kappa_t * state.P_t),
        config.TICK_SIZE
      );
      orders.push(createOrder('SELL', 'LIMIT', limitPrice, size, 'VALUE'));
    } else if (gapPct < 0 && agentBias > 11) {
      // Price below fundamental AND agent dice lean bullish → BUY limit
      const size = Math.max(1, Math.floor(20 + (agentBias - 11) * 8 * state.kappa_t));
      const limitPrice = roundToTick(
        state.P_t - prng.uniform(0.01, 0.05 * state.kappa_t * state.P_t),
        config.TICK_SIZE
      );
      orders.push(createOrder('BUY', 'LIMIT', limitPrice, size, 'VALUE'));
    }
  }

  return orders;
}
