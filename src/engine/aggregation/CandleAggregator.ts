import type { OHLCV } from '../types';

/**
 * Convert a tick number to a Unix timestamp for chart display.
 * Maps tick 0 → Jan 1, 2000 (946684800).
 * Uses 5 ticks = 1 second so that the finest candle resolution (ONE_SEC = 5)
 * always produces strictly increasing integer timestamps.
 * 325 ticks ≈ 65 seconds (labeled "1 minute").
 */
export function tickToTimestamp(tick: number): number {
  return 946684800 + Math.floor(tick / 5);
}

/**
 * Multi-resolution OHLCV candle aggregator.
 * Maintains candles at multiple resolutions simultaneously.
 * Each resolution has an in-progress candle that finalizes every N ticks.
 */
const MAX_CANDLES = 10_000;

export class CandleAggregator {
  private candles: Map<number, OHLCV[]> = new Map();
  private currentCandle: Map<number, OHLCV> = new Map();
  private resolutions: number[];

  constructor(resolutions: number[]) {
    this.resolutions = resolutions;
    for (const res of resolutions) {
      this.candles.set(res, []);
    }
  }

  /** Process a tick's price and volume data into all resolution candles */
  addTick(tick: number, price: number, volume: number): void {
    for (const res of this.resolutions) {
      const current = this.currentCandle.get(res);

      if (!current || tick % res === 0) {
        // Finalize previous candle if it exists
        if (current) {
          const arr = this.candles.get(res)!;
          arr.push({ ...current });
          // Prevent unbounded memory growth
          if (arr.length > MAX_CANDLES) {
            arr.splice(0, arr.length - MAX_CANDLES);
          }
        }
        // Start new candle
        this.currentCandle.set(res, {
          time: tickToTimestamp(tick),
          open: price,
          high: price,
          low: price,
          close: price,
          volume: volume,
        });
      } else {
        // Update in-progress candle
        current.high = Math.max(current.high, price);
        current.low = Math.min(current.low, price);
        current.close = price;
        current.volume += volume;
      }
    }
  }

  /** Get completed candles at a given resolution */
  getCandles(resolution: number, from?: number, to?: number): OHLCV[] {
    const all = this.candles.get(resolution) || [];
    if (from === undefined && to === undefined) return all;

    return all.filter(c => {
      if (from !== undefined && c.time < from) return false;
      if (to !== undefined && c.time > to) return false;
      return true;
    });
  }

  /** Get the current in-progress candle at a resolution */
  getCurrentCandle(resolution: number): OHLCV | null {
    return this.currentCandle.get(resolution) || null;
  }

  /** Get all candles including the current in-progress one */
  getCandlesWithCurrent(resolution: number): OHLCV[] {
    const completed = this.candles.get(resolution) || [];
    const current = this.currentCandle.get(resolution);
    if (current) {
      return [...completed, current];
    }
    return completed;
  }
}
