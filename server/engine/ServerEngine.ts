import { Engine } from '../../src/engine/Engine.js';
import { config } from '../config.js';
import type { OHLCV, BookSnapshot, ExtendedAnalysisData, RevealData } from '../../src/engine/types.js';

export interface ServerCandle {
  time: number; // Tick count (unique, increasing — used as chart x-axis)
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

const FULL_TPS = 25;
const speedPct = Math.max(1, Math.min(100, config.engineSpeedPct));
const TICKS_PER_SECOND = Math.max(1, Math.round(FULL_TPS * speedPct / 100));
const TICK_INTERVAL_MS = Math.floor(1000 / TICKS_PER_SECOND);

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
      // Use tick count as time — must be unique & increasing for lightweight-charts
      const candle: ServerCandle = {
        time: this.engine.getTickCount(),
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
    console.log(`[Engine] Started — ${TICKS_PER_SECOND} ticks/sec (${TICK_INTERVAL_MS}ms interval) [${speedPct}% speed]`);
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

  /** Get candles at any resolution from the engine's CandleAggregator */
  getCandles(resolution: number): OHLCV[] {
    return this.engine.getCandles(resolution);
  }

  /** Get analysis data for broadcasting to clients */
  getAnalysisData(): {
    bandMeans: number[];
    bandStds: number[];
    diceGrid: number[];
    shortInterest: number;
    utilization: number;
    bookSnapshot: BookSnapshot;
  } {
    const stats = this.engine.getBandStats();
    const state = this.engine.getState();
    const grid = this.engine.getDiceGrid();
    const book = this.engine.getBookSnapshot();

    // Delayed SI (same 5-tick delay as dev mode)
    const delayedSI = state.siDelayBuffer.length > 0 ? state.siDelayBuffer[0] : state.SI_t;
    const delayedUtil = state.utilDelayBuffer.length > 0 ? state.utilDelayBuffer[0] : 0;

    // Extended analysis data for Analysis V2
    const extended = this.engine.getExtendedAnalysis();

    return {
      bandMeans: stats.map(s => s.mean),
      bandStds: stats.map(s => s.std),
      diceGrid: Array.from(grid),
      shortInterest: delayedSI,
      utilization: delayedUtil,
      bookSnapshot: book,
      colMeans: extended.colMeans,
      buyVolume: extended.buyVolume,
      sellVolume: extended.sellVolume,
      depthBySource: extended.depthBySource,
    };
  }

  /** Get reveal data (hidden engine state) for Quant Lab */
  getRevealData(): RevealData {
    return this.engine.getRevealData();
  }
}
