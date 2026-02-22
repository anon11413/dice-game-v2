import { Engine } from '../../src/engine/Engine.js';

export interface ServerCandle {
  time: number; // Unix timestamp in seconds (for lightweight-charts)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type CandleCallback = (candle: ServerCandle, currentPrice: number, tickCount: number) => void;

const TICKS_PER_MINUTE = 390;

export class ServerEngine {
  private engine: Engine;
  private intervalId: ReturnType<typeof setTimeout> | null = null;
  private seed: number;
  private candleCount = 0;

  constructor(seed: number) {
    this.seed = seed;
    this.engine = new Engine(seed);
  }

  /**
   * Fast-forward the engine to a specific tick count.
   * Because the PRNG is deterministic, replaying N ticks from the same seed
   * produces the exact same state.
   */
  replayToTick(targetTickCount: number): void {
    const startTime = Date.now();
    for (let i = 0; i < targetTickCount; i++) {
      this.engine.tick();
    }
    const elapsed = Date.now() - startTime;
    console.log(`[Engine] Replayed ${targetTickCount} ticks in ${elapsed}ms`);
  }

  /**
   * Start the engine loop. Runs 390 ticks every 60 seconds.
   */
  start(onCandle: CandleCallback): void {
    if (this.intervalId) return;

    // Run first candle immediately
    this.runMinute(onCandle);

    // Self-correcting timer to avoid drift
    const INTERVAL_MS = 60_000;
    let nextRun = Date.now() + INTERVAL_MS;

    const tick = () => {
      this.runMinute(onCandle);
      nextRun += INTERVAL_MS;
      const delay = Math.max(0, nextRun - Date.now());
      this.intervalId = setTimeout(tick, delay);
    };

    this.intervalId = setTimeout(tick, INTERVAL_MS);
    console.log('[Engine] Started — producing candles every 60s');
  }

  private runMinute(onCandle: CandleCallback): void {
    const firstTick = this.engine.tick();
    let open = firstTick.price;
    let high = open;
    let low = open;
    let close = open;
    let volume = firstTick.volume;

    for (let i = 1; i < TICKS_PER_MINUTE; i++) {
      const td = this.engine.tick();
      close = td.price;
      if (close > high) high = close;
      if (close < low) low = close;
      volume += td.volume;
    }

    this.candleCount++;

    // Use Unix timestamp in seconds for lightweight-charts UTCTimestamp
    const time = Math.floor(Date.now() / 1000);

    const candle: ServerCandle = { time, open, high, low, close, volume };
    onCandle(candle, close, this.engine.getTickCount());

    // Log memory usage every 100 candles
    if (this.candleCount % 100 === 0) {
      const mem = process.memoryUsage();
      console.log(
        `[Engine] Candle #${this.candleCount} | Price: $${close.toFixed(2)} | ` +
        `Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB`
      );
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
      console.log('[Engine] Stopped');
    }
  }

  getPrice(): number {
    return this.engine.getPrice();
  }

  getTickCount(): number {
    return this.engine.getTickCount();
  }

  getSeed(): number {
    return this.seed;
  }
}
