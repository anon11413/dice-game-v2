import type { SimState, SimConfig, BandStats, Order } from '../types';
import type { PRNG } from '../prng';
import { BAND2_CONFIG } from '../constants';
import { generateDirectionalOrders } from './directionalAgent';

/** Band 2: Swing Traders — fires every 13 ticks */
export function generateSwingOrders(
  state: SimState,
  config: SimConfig,
  stats: BandStats,
  prng: PRNG
): Order[] {
  return generateDirectionalOrders(state, config, stats, BAND2_CONFIG, prng);
}
