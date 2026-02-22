import { create } from 'zustand';
import type { OHLCV, BookSnapshot } from '../engine/types';

interface MarketState {
  price: number;
  priceChange: number;
  priceChangePct: number;
  volume: number;
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  shortInterest: number;
  utilization: number;
  bookSnapshot: BookSnapshot | null;

  // Candle data by resolution
  candles: Map<number, OHLCV[]>;

  // Price history for computing change (last 2 prices)
  prevPrice: number;

  updateTick: (price: number, volume: number, bestBid: number | null, bestAsk: number | null, shortInterest: number, utilization: number, bookDepthBid5: number, bookDepthAsk5: number) => void;
  setCandles: (resolution: number, data: OHLCV[]) => void;
  setBookSnapshot: (snapshot: BookSnapshot) => void;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  price: 100,
  priceChange: 0,
  priceChangePct: 0,
  volume: 0,
  bestBid: null,
  bestAsk: null,
  spread: null,
  shortInterest: 500000,
  utilization: 0.05,
  bookSnapshot: null,
  candles: new Map(),
  prevPrice: 100,

  updateTick: (price, volume, bestBid, bestAsk, shortInterest, utilization) => {
    const prev = get().price;
    const change = price - prev;
    const changePct = prev !== 0 ? (change / prev) * 100 : 0;

    set({
      price,
      prevPrice: prev,
      priceChange: change,
      priceChangePct: changePct,
      volume,
      bestBid,
      bestAsk,
      spread: bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null,
      shortInterest,
      utilization,
    });
  },

  setCandles: (resolution, data) => {
    set((state) => {
      const candles = new Map(state.candles);
      candles.set(resolution, data);
      return { candles };
    });
  },

  setBookSnapshot: (snapshot) => set({ bookSnapshot: snapshot }),
}));
