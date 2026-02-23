import type { SimState, SimConfig, BandStats, Order, SRLevel, Trade } from '../types';
import { createOrder } from '../orderbook/Order';
import { roundToTick } from '../../utils/math';

/**
 * Band 12: Support/Resistance
 *
 * Tracks a volume profile (price bucket → accumulated volume), detects
 * local maxima as S/R levels, and generates limit orders at those levels.
 */

/** Bucket price into 0.5% increments relative to F_t */
function priceToBucket(price: number, F_t: number): number {
  const relPct = (price - F_t) / F_t;
  return Math.round(relPct / 0.005) * 0.005;
}

/** Convert a bucket key back to an absolute price */
function bucketToPrice(bucket: number, F_t: number): number {
  return F_t * (1 + bucket);
}

// ---- Volume Profile Update (called in phaseD) ----

/** Update volume profile: accumulate trade volume, decay all buckets */
export function updateVolumeProfile(
  state: SimState,
  config: SimConfig,
  trades: Trade[]
): void {
  // Accumulate volume from trades
  for (const trade of trades) {
    const bucket = priceToBucket(trade.price, state.F_t);
    const existing = state.volumeProfile.get(bucket) || 0;
    state.volumeProfile.set(bucket, existing + trade.size);
  }

  // Decay all buckets
  const toDelete: number[] = [];
  for (const [bucket, vol] of state.volumeProfile) {
    const decayed = vol * config.SR_DECAY;
    if (decayed < 10) {
      toDelete.push(bucket);
    } else {
      state.volumeProfile.set(bucket, decayed);
    }
  }
  for (const bucket of toDelete) {
    state.volumeProfile.delete(bucket);
  }
}

// ---- S/R Level Detection (called every 65 ticks) ----

/** Scan volume profile for local maxima, keep top N as S/R levels */
export function detectSRLevels(state: SimState, config: SimConfig): void {
  if (state.volumeProfile.size < 3) return;

  // Sort buckets by key
  const entries = [...state.volumeProfile.entries()].sort((a, b) => a[0] - b[0]);

  // Find local maxima (peak higher than both neighbors)
  const peaks: { bucket: number; volume: number }[] = [];
  for (let i = 1; i < entries.length - 1; i++) {
    const [bucket, vol] = entries[i];
    if (vol > entries[i - 1][1] && vol > entries[i + 1][1]) {
      peaks.push({ bucket, volume: vol });
    }
  }

  if (peaks.length === 0) return;

  // Sort by volume descending, keep top N
  peaks.sort((a, b) => b.volume - a.volume);
  const topPeaks = peaks.slice(0, config.SR_MAX_LEVELS);

  // Normalize strength by max volume
  const maxVol = topPeaks[0].volume;

  // Build new levels, preserving testCount from existing levels
  const newLevels: SRLevel[] = topPeaks.map(peak => {
    const price = bucketToPrice(peak.bucket, state.F_t);
    const side: 'support' | 'resistance' = price < state.P_t ? 'support' : 'resistance';
    const strength = peak.volume / maxVol;

    // Try to match an existing level (within 1% of price)
    const existing = state.srLevels.find(
      l => Math.abs(l.price - price) / price < 0.01
    );

    return {
      price,
      strength,
      side,
      volumeAccumulated: peak.volume,
      testCount: existing ? existing.testCount : 0,
    };
  });

  state.srLevels = newLevels;
}

// ---- S/R Level Flips (called in phaseD) ----

/** When price breaks through a level by >SR_BREAK_THRESH, flip it */
export function flipBrokenLevels(state: SimState, config: SimConfig): void {
  for (const level of state.srLevels) {
    const priceDiff = (state.P_t - level.price) / level.price;

    if (level.side === 'support' && priceDiff < -config.SR_BREAK_THRESH) {
      // Price broke below support → flip to resistance
      level.side = 'resistance';
      level.strength *= 0.5;
      level.testCount = 0;
    } else if (level.side === 'resistance' && priceDiff > config.SR_BREAK_THRESH) {
      // Price broke above resistance → flip to support
      level.side = 'support';
      level.strength *= 0.5;
      level.testCount = 0;
    }
  }
}

// ---- S/R Order Generation (called every 13 ticks) ----

/** Generate limit orders at S/R levels near current price */
export function generateSROrders(
  state: SimState,
  config: SimConfig,
  stats12: BandStats
): Order[] {
  const orders: Order[] = [];

  for (const level of state.srLevels) {
    const proximity = Math.abs(state.P_t - level.price) / state.P_t;
    if (proximity > config.SR_PROXIMITY) continue;

    // Size decays with test count (levels weaken after repeated tests)
    const size = Math.max(
      10,
      Math.floor(
        config.SR_BASE_SIZE * level.strength * Math.pow(config.SR_TEST_DECAY, level.testCount)
      )
    );

    // Use Band 12 dice for agent conviction
    // Average of first 10 columns as conviction signal
    let conviction = 0;
    for (let j = 0; j < 10; j++) {
      conviction += stats12.colMeans[j];
    }
    conviction /= 10;

    if (level.side === 'support') {
      // Bullish dice defend support (buy at support level)
      if (conviction < 9) continue; // Bearish dice don't defend support
      const price = roundToTick(level.price, config.TICK_SIZE);
      if (price > 0) {
        orders.push(createOrder('BUY', 'LIMIT', price, size, 'SR'));
        level.testCount++;
      }
    } else {
      // Bearish dice defend resistance (sell at resistance level)
      if (conviction > 12) continue; // Bullish dice don't defend resistance
      const price = roundToTick(level.price, config.TICK_SIZE);
      if (price > 0) {
        orders.push(createOrder('SELL', 'LIMIT', price, size, 'SR'));
        level.testCount++;
      }
    }
  }

  return orders;
}
