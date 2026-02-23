import type { SimState, SimConfig, BandStats, Order } from '../types';
import type { PRNG } from '../prng';
import { createOrder } from '../orderbook/Order';
import { roundToTick } from '../../utils/math';

/**
 * Band 4: Value Agents
 *
 * F_t drift is handled by Band 11 (trend driver).
 * This band generates PASSIVE limit orders to gently tether price toward F_t.
 *
 * Key design: all orders are passive limits placed 1-5% from current price.
 * This prevents return autocorrelation (rACF1) while still providing
 * a gravitational pull toward fundamental value.
 *
 * Three urgency tiers control size, but ALL use passive limits:
 * - |gap| > 3%: small passive limits (10-20 shares)
 * - |gap| > 10%: medium passive limits (20-50 shares)
 * - |gap| > 30%: larger passive limits (50-100 shares), every 65 ticks internally
 */

/** Generate value agent orders (called every 65 ticks from Engine) */
export function generateValueOrders(
  state: SimState,
  config: SimConfig,
  stats: BandStats,
  prng: PRNG
): Order[] {
  const orders: Order[] = [];
  const gap = (state.P_t - state.F_t) / state.F_t;
  const absGap = Math.abs(gap);

  if (absGap < config.VALUE_PASSIVE_GAP) return orders;

  const overpriced = gap > 0; // Price above fundamental → sell pressure

  // Iterate over 100 columns as 100 independent agents
  for (let j = 0; j < 100; j++) {
    const agentBias = stats.colMeans[j];

    // Agent acts only if dice agree with gap direction
    if (overpriced && agentBias > 11) continue; // Bullish dice won't sell
    if (!overpriced && agentBias < 10) continue; // Bearish dice won't buy

    // Determine size based on gap magnitude
    let size: number;
    if (absGap >= config.VALUE_EMERGENCY_GAP) {
      // Large gap: bigger orders but still passive limits
      size = Math.max(1, Math.floor(50 + Math.abs(agentBias - 10.5) * 5));
    } else if (absGap >= config.VALUE_URGENT_GAP) {
      size = Math.max(1, Math.floor(20 + Math.abs(agentBias - 10.5) * 3));
    } else {
      size = Math.max(1, Math.floor(10 + Math.abs(agentBias - 10.5) * 2));
    }

    // Wide passive offsets: 1-5% from current price (scaled by kappa)
    if (overpriced) {
      const limitPrice = roundToTick(
        state.P_t + prng.uniform(0.01, 0.05 * state.kappa_t) * state.P_t / config.PRICE_SCALE,
        config.TICK_SIZE
      );
      orders.push(createOrder('SELL', 'LIMIT', limitPrice, size, 'VALUE'));
    } else {
      const limitPrice = roundToTick(
        state.P_t - prng.uniform(0.01, 0.05 * state.kappa_t) * state.P_t / config.PRICE_SCALE,
        config.TICK_SIZE
      );
      orders.push(createOrder('BUY', 'LIMIT', limitPrice, size, 'VALUE'));
    }
  }

  return orders;
}
