import { api } from '../api/client';
import { wsClient } from '../api/wsClient';
import { useMarketStore } from '../store/marketStore';
import type { OHLCV } from '../engine/types';

const MAX_CANDLES = 5000;

/**
 * ServerBridge connects to the backend REST API and WebSocket
 * to receive live price data (replacing the Web Worker for player mode).
 */
export class ServerBridge {
  private candles: OHLCV[] = [];
  private unsubCandle: (() => void) | null = null;
  private connected = false;

  async connect(token?: string | null): Promise<void> {
    if (this.connected) return;

    // 1. Fetch current price via REST (chart will populate from live WebSocket ticks)
    // NOTE: We skip /api/history because DB candles use wall-clock timestamps
    // while live candles use engine tick counts — mixing them crashes the chart.
    // At 25 ticks/sec the chart fills almost instantly from live data.
    try {
      const { price } = await api.getPrice();
      useMarketStore.getState().updateTick(
        price, 0,
        null, null,
        0, 0, 0, 0
      );
    } catch {
      // Will get price from WebSocket
    }

    // 2. Connect WebSocket for live updates
    wsClient.connect(token);

    this.unsubCandle = wsClient.on('CANDLE', (data: any) => {
      const candle: OHLCV = {
        time: data.time,
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
        volume: data.volume,
      };

      this.candles.push(candle);

      // Trim to prevent memory leak
      if (this.candles.length > MAX_CANDLES) {
        this.candles = this.candles.slice(-MAX_CANDLES);
      }

      const store = useMarketStore.getState();
      store.setCandles(1, [...this.candles]);
      store.updateTick(
        data.price,
        candle.volume,
        null, null,
        0, 0, 0, 0
      );
    });

    this.connected = true;
    console.log('[ServerBridge] Connected');
  }

  disconnect(): void {
    if (this.unsubCandle) {
      this.unsubCandle();
      this.unsubCandle = null;
    }
    wsClient.disconnect();
    this.candles = [];
    this.connected = false;
    console.log('[ServerBridge] Disconnected');
  }

  getCandles(): OHLCV[] {
    return this.candles;
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
