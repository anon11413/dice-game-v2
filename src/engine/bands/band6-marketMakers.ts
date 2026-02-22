import type { SimState, SimConfig, BandStats, Order } from '../types';
import { OrderBook } from '../orderbook/OrderBook';
import { createOrder } from '../orderbook/Order';
import { roundToTick } from '../../utils/math';

/**
 * Band 6: Market Makers / Liquidity Providers (Section 7)
 * Every tick: cancel all MM orders, compute new spread/depth, repopulate the book.
 * Includes liquidity withdrawal mechanic for flash crashes (Section 7.3).
 */
export function generateMarketMakerOrders(
  state: SimState,
  config: SimConfig,
  stats: BandStats,
  book: OrderBook
): Order[] {
  // Cancel all existing MM orders first
  book.cancelAllBySource('MM');

  const mmMean = stats.mean;
  const mmStd = stats.std;

  // Target half-spread
  const baseSpreadPct = 0.003;
  let spreadFactor = 2.5 - (mmMean / 20.0) * 2.0; // ~0.5 (tight) to ~2.5 (wide)
  spreadFactor *= state.kappa_t;
  let halfSpread = state.P_t * baseSpreadPct * spreadFactor;
  halfSpread = Math.max(halfSpread, config.TICK_SIZE);

  // Depth (shares at each level) — tuned so directional agents can move price
  const baseDepth = 150;
  const depthFactor = mmMean / 10.5;
  let depth = Math.floor(baseDepth * depthFactor / state.kappa_t);
  depth = Math.max(depth, 5);

  let numLevels = 20;

  // === Liquidity Withdrawal Check (Section 7.3) ===
  // Condition A: Extreme volatility
  const volPanic = state.kappa_t > 3.0;

  // Condition B: Price moved more than 2% in last 5 ticks
  let fastMove = false;
  if (state.tickCount >= 5 && state.priceHistory.length >= 5) {
    const priceFiveAgo = state.priceHistory[state.priceHistory.length - 5];
    const recentMove = Math.abs(state.P_t - priceFiveAgo) / priceFiveAgo;
    fastMove = recentMove > 0.02;
  }

  // Condition C: MM dice extremely low (individually scared)
  const mmFear = mmMean < 4.0;

  if (volPanic || fastMove || mmFear) {
    depth = Math.floor(depth * 0.2);
    halfSpread *= 3.0;
    numLevels = 5;
  }

  // === Generate MM orders (Section 7.2) ===
  const orders: Order[] = [];

  for (let i = 0; i < numLevels; i++) {
    const levelOffset = halfSpread + i * config.TICK_SIZE * spreadFactor * 2;

    // Depth tapers at outer levels
    let levelDepth = Math.floor(depth * (1.0 - i * 0.03));
    levelDepth = Math.max(levelDepth, 5);

    const bidPrice = roundToTick(state.P_t - levelOffset, config.TICK_SIZE);
    const askPrice = roundToTick(state.P_t + levelOffset, config.TICK_SIZE);

    if (bidPrice > 0) {
      orders.push(createOrder('BUY', 'LIMIT', bidPrice, levelDepth, 'MM'));
    }
    orders.push(createOrder('SELL', 'LIMIT', askPrice, levelDepth, 'MM'));
  }

  return orders;
}
