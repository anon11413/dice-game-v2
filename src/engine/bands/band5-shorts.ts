import type { SimState, SimConfig, BandStats, Order } from '../types';
import type { PRNG } from '../prng';
import { createOrder } from '../orderbook/Order';
import { roundToTick } from '../../utils/math';

/**
 * Band 5: Short Sellers & Short Squeeze Mechanics (Section 8)
 */

/** Generate short seller agent orders (every tick) — Section 8.2 */
export function generateShortOrders(
  state: SimState,
  config: SimConfig,
  stats: BandStats,
  prng: PRNG
): Order[] {
  const orders: Order[] = [];
  const utilization = state.SI_t / config.FLOAT;
  const borrowCost = 0.01 + utilization * utilization; // Accelerating cost

  for (let j = 0; j < 100; j++) {
    const cm = stats.colMeans[j];

    if (cm >= 12 && utilization < 1.2) {
      // Open new short position → SELL
      const aggression = (cm - 11) / 9.0;
      const size = Math.max(1, Math.floor(30 * aggression * state.kappa_t));

      // Borrow cost discourages at high utilization
      if (prng.next() > borrowCost) {
        if (prng.next() < 0.4) {
          orders.push(createOrder('SELL', 'MARKET', null, size, 'SHORT'));
        } else {
          const price = roundToTick(
            state.P_t + prng.uniform(0, 0.003) * state.P_t,
            config.TICK_SIZE
          );
          orders.push(createOrder('SELL', 'LIMIT', price, size, 'SHORT'));
        }
        state.SI_t += size;
      }
    } else if (cm <= 9) {
      // Voluntarily cover shorts → BUY
      const coverUrgency = (10 - cm) / 9.0;
      let size = Math.max(1, Math.floor(20 * coverUrgency * state.kappa_t));
      size = Math.min(size, state.SI_t); // Can't cover more than exists

      if (size > 0) {
        if (prng.next() < 0.5 * state.kappa_t) {
          orders.push(createOrder('BUY', 'MARKET', null, size, 'SHORT'));
        } else {
          const price = roundToTick(
            state.P_t - prng.uniform(0, 0.002) * state.P_t,
            config.TICK_SIZE
          );
          orders.push(createOrder('BUY', 'LIMIT', price, size, 'SHORT'));
        }
        state.SI_t -= size;
        state.SI_t = Math.max(state.SI_t, 0);
      }
    }
  }

  return orders;
}

/** Evaluate squeeze conditions (every tick after Band 5 orders) — Section 8.3 */
export function evaluateSqueeze(state: SimState, config: SimConfig): void {
  const utilization = state.SI_t / config.FLOAT;

  // Can only trigger if cooldown has expired
  if (state.squeeze_cooldown_remaining > 0) return;
  if (state.squeeze_active) return;

  // All conditions must be true
  const condUtil = utilization > config.SQUEEZE_UTIL_THRESH;

  let priceRise = 0;
  if (state.tickCount >= config.SQUEEZE_WINDOW && state.priceHistory.length >= config.SQUEEZE_WINDOW) {
    const pastPrice = state.priceHistory[state.priceHistory.length - config.SQUEEZE_WINDOW];
    priceRise = (state.P_t - pastPrice) / pastPrice;
  }
  const condPrice = priceRise > config.SQUEEZE_PRICE_THRESH;
  const condSentiment = state.sentiment_t > 0.6;
  const condVol = state.kappa_t > 1.2;

  if (condUtil && condPrice && condSentiment && condVol) {
    state.squeeze_active = true;
    state.squeeze_tick_counter = 0;
    state.squeeze_cooldown_remaining = config.SQUEEZE_COOLDOWN;
  }
}

/** Generate squeeze forced cover orders — Section 8.3 */
export function generateSqueezeCovers(state: SimState, config: SimConfig): Order[] {
  if (!state.squeeze_active) return [];

  let forcedCover = Math.floor(state.SI_t * config.SQUEEZE_COVER_RATE);
  forcedCover = Math.max(forcedCover, 1);
  forcedCover = Math.min(forcedCover, state.SI_t);

  if (forcedCover <= 0) return [];

  // Forced covers are MARKET BUYS (urgent, accepting slippage)
  state.SI_t -= forcedCover;
  state.SI_t = Math.max(state.SI_t, 0);

  return [createOrder('BUY', 'MARKET', null, forcedCover, 'SQUEEZE')];
}
