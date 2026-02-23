import { api } from '../api/client';
import { wsClient } from '../api/wsClient';
import { useMarketStore } from '../store/marketStore';
import { useDiceStore } from '../store/diceStore';
import { useAnalysisStore } from '../store/analysisStore';
import { CandleAggregator } from '../engine/aggregation/CandleAggregator';
import { RESOLUTIONS } from '../engine/constants';
import type { OHLCV } from '../engine/types';

const MAX_CANDLES = 5000;

/** All resolutions exposed in the chart UI */
const PLAYER_RESOLUTIONS = [
  RESOLUTIONS.ONE_SEC,
  RESOLUTIONS.ONE_MIN,
  RESOLUTIONS.TWO_MIN,
  RESOLUTIONS.FIVE_MIN,
  RESOLUTIONS.TEN_MIN,
  RESOLUTIONS.TWENTY_MIN,
  RESOLUTIONS.ONE_HOUR,
  RESOLUTIONS.TWO_HOUR,
  RESOLUTIONS.ONE_DAY,
];

/**
 * ServerBridge connects to the backend REST API and WebSocket
 * to receive live price data (replacing the Web Worker for player mode).
 *
 * On connect it fetches history at all resolutions from the server,
 * then aggregates live ticks client-side using CandleAggregator.
 */
export class ServerBridge {
  private unsubCandle: (() => void) | null = null;
  private unsubAnalysis: (() => void) | null = null;
  private connected = false;
  private aggregator: CandleAggregator | null = null;
  private historyCandles: Map<number, OHLCV[]> = new Map();
  private lastHistoryTick = 0;

  async connect(token?: string | null): Promise<void> {
    if (this.connected) return;

    const store = useMarketStore.getState();

    // 1. Fetch history for ALL resolutions in parallel from engine memory
    try {
      const results = await Promise.all(
        PLAYER_RESOLUTIONS.map((res) =>
          api
            .getHistory(MAX_CANDLES, res)
            .then((data) => ({ resolution: res, candles: data.candles as OHLCV[] }))
            .catch(() => ({ resolution: res, candles: [] as OHLCV[] }))
        )
      );

      for (const { resolution, candles } of results) {
        this.historyCandles.set(resolution, candles);
        store.setCandles(resolution, candles);

        // Track the last tick from 1T history (most granular)
        if (resolution === RESOLUTIONS.ONE_SEC && candles.length > 0) {
          this.lastHistoryTick = candles[candles.length - 1].time;
          const last = candles[candles.length - 1];
          store.updateTick(last.close, 0, store.bestBid, store.bestAsk, store.shortInterest, store.utilization, 0, 0);
        }
      }
    } catch (err) {
      console.error('[ServerBridge] Failed to fetch history:', err);
    }

    // 2. Create aggregator for live ticks (all resolutions)
    this.aggregator = new CandleAggregator(PLAYER_RESOLUTIONS);

    // 3. Connect WebSocket for live updates
    wsClient.connect(token);

    this.unsubCandle = wsClient.on('CANDLE', (data: any) => {
      const tick = data.time;

      // Skip ticks already covered by history
      if (tick <= this.lastHistoryTick) return;

      // Feed tick to aggregator for multi-resolution candle building
      if (this.aggregator) {
        this.aggregator.addTick(tick, data.close, data.volume);
      }

      // Merge history + live for all resolutions and update store
      const s = useMarketStore.getState();
      for (const res of PLAYER_RESOLUTIONS) {
        const history = this.historyCandles.get(res) || [];
        const live = this.aggregator
          ? this.aggregator.getCandlesWithCurrent(res)
          : [];
        const merged = [...history, ...live];

        // Trim to prevent unbounded memory growth
        const trimmed =
          merged.length > MAX_CANDLES ? merged.slice(-MAX_CANDLES) : merged;

        s.setCandles(res, trimmed);
      }

      s.updateTick(data.price, data.volume, s.bestBid, s.bestAsk, s.shortInterest, s.utilization, 0, 0);
    });

    // 4. Subscribe to analysis data for Analysis page
    this.unsubAnalysis = wsClient.on('ANALYSIS', (data: any) => {
      // Update dice store
      const grid = new Uint8Array(data.diceGrid);
      useDiceStore.getState().updateDice(grid, data.bandMeans, data.bandStds);

      // Update market store with book/SI data
      const ms = useMarketStore.getState();
      ms.updateTick(
        ms.price, 0,
        data.bookSnapshot.bestBid, data.bookSnapshot.bestAsk,
        data.shortInterest, data.utilization,
        data.bookSnapshot.bids.reduce((sum: number, l: any) => sum + l.totalSize, 0),
        data.bookSnapshot.asks.reduce((sum: number, l: any) => sum + l.totalSize, 0)
      );
      ms.setBookSnapshot(data.bookSnapshot);

      // Update analysis store with extended data (Analysis V2)
      if (data.colMeans) {
        useAnalysisStore.getState().updateExtended({
          colMeans: data.colMeans,
          buyVolume: data.buyVolume ?? 0,
          sellVolume: data.sellVolume ?? 0,
          depthBySource: data.depthBySource ?? {},
        });
      }
      // Track spread history
      if (data.bookSnapshot.spread != null) {
        useAnalysisStore.getState().addSpread(data.bookSnapshot.spread);
      }
    });

    this.connected = true;
    console.log('[ServerBridge] Connected');
  }

  disconnect(): void {
    if (this.unsubCandle) {
      this.unsubCandle();
      this.unsubCandle = null;
    }
    if (this.unsubAnalysis) {
      this.unsubAnalysis();
      this.unsubAnalysis = null;
    }
    wsClient.disconnect();
    this.historyCandles.clear();
    this.aggregator = null;
    this.lastHistoryTick = 0;
    this.connected = false;
    console.log('[ServerBridge] Disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Singleton
let bridge: ServerBridge | null = null;

export function getServerBridge(): ServerBridge {
  if (!bridge) {
    bridge = new ServerBridge();
  }
  return bridge;
}
