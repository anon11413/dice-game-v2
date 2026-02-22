import type { SimState, SimConfig, BandStats, Order } from '../types';
import type { PRNG } from '../prng';
import { BAND1_CONFIG } from '../constants';
import { generateDirectionalOrders } from './directionalAgent';

/** Band 1: Intraday Scalpers — fires every tick */
export function generateScalperOrders(
  state: SimState,
  config: SimConfig,
  stats: BandStats,
  prng: PRNG
): Order[] {
  return generateDirectionalOrders(state, config, stats, BAND1_CONFIG, prng);
}
