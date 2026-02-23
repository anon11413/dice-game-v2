import { create } from 'zustand';
import type { OHLCV, BookSnapshot } from '../engine/types';
import { useSimulationStore } from './simulationStore';

/** Stable empty array to avoid infinite re-render loops in React 19 selectors */
export const EMPTY_CANDLES: OHLCV[] = [];

const P_INIT = 100;

/** Pure display transform — engine mechanics are completely untouched */
function scalePrice(raw: number, scale: number): number {
  return P_INIT + (raw - P_INIT) * scale;
}

function scaleCandle(c: OHLCV, scale: number): OHLCV {
  return {
    time: c.time,
    open: scalePrice(c.open, scale),
    high: scalePrice(c.high, scale),
    low: scalePrice(c.low, scale),
    close: scalePrice(c.close, scale),
    volume: c.volume, // untouched
  };
}

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

  // Session open price for computing change
  openPrice: number;
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
  openPrice: 100,
  prevPrice: 100,

  updateTick: (price, volume, bestBid, bestAsk, shortInterest, utilization) => {
    const s = useSimulationStore.getState().priceScale;
    const scaled = scalePrice(price, s);
    const scaledBid = bestBid !== null ? scalePrice(bestBid, s) : null;
    const scaledAsk = bestAsk !== null ? scalePrice(bestAsk, s) : null;

    const { openPrice } = get();
    const change = scaled - openPrice;
    const changePct = openPrice !== 0 ? (change / openPrice) * 100 : 0;

    set({
      price: scaled,
      prevPrice: get().price,
      priceChange: change,
      priceChangePct: changePct,
      volume,
      bestBid: scaledBid,
      bestAsk: scaledAsk,
      spread: scaledBid !== null && scaledAsk !== null ? scaledAsk - scaledBid : null,
      shortInterest,
      utilization,
    });
  },

  setCandles: (resolution, data) => {
    const s = useSimulationStore.getState().priceScale;
    const scaled = s === 1 ? data : data.map(c => scaleCandle(c, s));
    set((state) => {
      const candles = new Map(state.candles);
      candles.set(resolution, scaled);
      return { candles };
    });
  },

  setBookSnapshot: (snapshot) => {
    const s = useSimulationStore.getState().priceScale;
    if (s === 1) {
      set({ bookSnapshot: snapshot });
      return;
    }
    set({
      bookSnapshot: {
        ...snapshot,
        bestBid: snapshot.bestBid !== null ? scalePrice(snapshot.bestBid, s) : null,
        bestAsk: snapshot.bestAsk !== null ? scalePrice(snapshot.bestAsk, s) : null,
        spread: snapshot.spread !== null ? snapshot.spread * s : null,
        bids: snapshot.bids.map(l => ({ ...l, price: scalePrice(l.price, s) })),
        asks: snapshot.asks.map(l => ({ ...l, price: scalePrice(l.price, s) })),
      },
    });
  },
}));
