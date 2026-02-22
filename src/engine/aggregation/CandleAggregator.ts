import type { OHLCV } from '../types';

/**
 * Multi-resolution OHLCV candle aggregator.
 * Maintains candles at multiple resolutions simultaneously.
 * Each resolution has an in-progress candle that finalizes every N ticks.
 */
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
          this.candles.get(res)!.push({ ...current });
        }
        // Start new candle
        this.currentCandle.set(res, {
          time: tick,
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
