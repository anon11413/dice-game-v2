import { Engine } from '../../src/engine/Engine.js';

export interface ServerCandle {
  time: number; // Unix timestamp in seconds (for lightweight-charts)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type TickCallback = (
  candle: ServerCandle,
  currentPrice: number,
  tickCount: number
) => void;

const TICKS_PER_SECOND = 25;
const TICK_INTERVAL_MS = Math.floor(1000 / TICKS_PER_SECOND); // 40ms

export class ServerEngine {
  private engine: Engine;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private seed: number;
  private ticksSinceStart = 0;

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
   * Start the engine loop. Runs individual ticks at 25 ticks/second.
   * Each tick produces a 1-tick candle and invokes the callback.
   */
  start(onTick: TickCallback): void {
    if (this.intervalId) return;

    const runOneTick = () => {
      const td = this.engine.tick();
      this.ticksSinceStart++;

      const price = td.price;
      const volume = td.volume;

      // Each tick is its own candle (RESOLUTIONS.TICK = 1)
      const time = Math.floor(Date.now() / 1000);
      const candle: ServerCandle = {
        time,
        open: price,
        high: price,
        low: price,
        close: price,
        volume,
      };

      onTick(candle, price, this.engine.getTickCount());
    };

    // Run first tick immediately
    runOneTick();

    // Then tick at 25/sec
    this.intervalId = setInterval(runOneTick, TICK_INTERVAL_MS);
    console.log(`[Engine] Started — ${TICKS_PER_SECOND} ticks/sec (${TICK_INTERVAL_MS}ms interval)`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
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
