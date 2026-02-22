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

    // 1. Fetch full price history for chart hydration
    try {
      const { candles } = await api.getHistory();
      this.candles = candles.map((c: any) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));

      // Update market store with initial data
      const store = useMarketStore.getState();
      store.setCandles(1, this.candles);

      if (this.candles.length > 0) {
        const last = this.candles[this.candles.length - 1];
        store.updateTick(
          last.close,
          last.volume,
          null, null,
          0, 0, 0, 0
        );
      }
    } catch (err) {
      console.error('[ServerBridge] Failed to fetch history:', err);
    }

    // 2. Also fetch current price
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

    // 3. Connect WebSocket for live updates
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
