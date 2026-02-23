import type { SimState, SimConfig, BandStats, Order, DirectionalBandConfig } from '../types';
import type { PRNG } from '../prng';
import { createOrder } from '../orderbook/Order';
import { roundToTick, sign } from '../../utils/math';

/**
 * Shared directional agent logic for Bands 1-3 (Section 6.2).
 * Each column j in the band is one micro-agent.
 * Implements the full 6-step decision process.
 */
export function generateDirectionalOrders(
  state: SimState,
  config: SimConfig,
  stats: BandStats,
  bandConfig: DirectionalBandConfig,
  prng: PRNG
): Order[] {
  const orders: Order[] = [];
  const bm = stats.mean; // band consensus (unused in current logic but available)

  for (let j = 0; j < 100; j++) {
    const cm = stats.colMeans[j]; // Agent's dice mean

    // Step 1: Raw directional signal
    let rawDir: number;
    if (cm >= 14) {
      rawDir = 1;   // bullish
    } else if (cm <= 7) {
      rawDir = -1;  // bearish
    } else {
      continue;     // neutral → this agent sits out
    }

    // Step 2: Conviction strength (how extreme are the dice)
    let conviction = Math.abs(cm - 10.5) / 9.5; // 0-1 normalized

    // Step 3: Regime influence — trend persistence biases toward continuing last direction
    const lastDirection = state.tickCount > 0 && state.priceHistory.length > 0
      ? sign(state.P_t - state.priceHistory[state.priceHistory.length - 1])
      : 0;

    if (prng.next() < state.regime_t.trendPersistence * bandConfig.regimeInfluenceWeight) {
      if (lastDirection !== 0) {
        rawDir = lastDirection;
      }
    }

    // Fakeout check (Section 11.2)
    if (prng.next() < state.regime_t.reversalProb) {
      rawDir = -rawDir;
    }

    // Step 4: Sentiment modification
    if (rawDir === 1 && state.sentiment_t > 0.65) {
      conviction *= 1.0 + (state.sentiment_t - 0.65) * 2.0; // up to ~1.7x
    } else if (rawDir === -1 && state.sentiment_t < 0.35) {
      conviction *= 1.0 + (0.35 - state.sentiment_t) * 2.0;
    }

    // Step 5: Event modification
    if (state.event_active !== null) {
      if (state.event_active.direction === rawDir) {
        conviction *= 1.0 + state.event_active.magnitude;
      } else {
        conviction *= Math.max(0.2, 1.0 - state.event_active.magnitude * 0.5);
      }
    }

    // Step 6: Generate order
    let size = Math.floor(bandConfig.baseOrderSize * conviction * state.kappa_t);
    size = Math.max(size, 1);

    if (prng.next() < bandConfig.marketOrderProb * state.kappa_t) {
      // Market order
      if (rawDir === 1) {
        orders.push(createOrder('BUY', 'MARKET', null, size, bandConfig.source));
      } else {
        orders.push(createOrder('SELL', 'MARKET', null, size, bandConfig.source));
      }
    } else {
      // Limit order
      const offset = prng.uniform(bandConfig.limitOffsetMin, bandConfig.limitOffsetMax)
        * state.P_t * state.kappa_t / config.PRICE_SCALE;
      if (rawDir === 1) {
        const price = roundToTick(state.P_t - offset, config.TICK_SIZE);
        orders.push(createOrder('BUY', 'LIMIT', Math.max(price, config.TICK_SIZE), size, bandConfig.source));
      } else {
        const price = roundToTick(state.P_t + offset, config.TICK_SIZE);
        orders.push(createOrder('SELL', 'LIMIT', price, size, bandConfig.source));
      }
    }
  }

  return orders;
}
