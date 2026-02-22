import type { SimState, SimConfig, BandStats, Order } from '../types';
import type { PRNG } from '../prng';
import { BAND3_CONFIG } from '../constants';
import { generateDirectionalOrders } from './directionalAgent';

/** Band 3: Position Traders — fires every 65 ticks */
export function generatePositionOrders(
  state: SimState,
  config: SimConfig,
  stats: BandStats,
  prng: PRNG
): Order[] {
  return generateDirectionalOrders(state, config, stats, BAND3_CONFIG, prng);
}
