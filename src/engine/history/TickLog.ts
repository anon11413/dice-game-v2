import type { SimState, SimConfig, BandStats, Trade, TickLog, TickData, BookSnapshot } from '../types';

/** Create a full tick log from current engine state */
export function createTickLog(
  state: SimState,
  config: SimConfig,
  trades: Trade[],
  bandStats: BandStats[],
  bookSnapshot: BookSnapshot
): TickLog {
  return {
    tick: state.tickCount,
    dice: state.dice, // Note: this is the current grid reference
    P_t: state.P_t,
    F_t: state.F_t,
    volume: state.tickVolume,
    SI_t: state.SI_t,
    utilization: state.SI_t / config.FLOAT,
    kappa_t: state.kappa_t,
    sentiment_t: state.sentiment_t,
    regime_t: { ...state.regime_t },
    squeeze_active: state.squeeze_active,
    event_active: state.event_active ? { ...state.event_active } : null,
    bestBid: bookSnapshot.bestBid,
    bestAsk: bookSnapshot.bestAsk,
    bookDepthBid5: bookSnapshot.bids.reduce((sum, l) => sum + l.totalSize, 0),
    bookDepthAsk5: bookSnapshot.asks.reduce((sum, l) => sum + l.totalSize, 0),
    bandMeans: bandStats.map(s => s.mean),
    bandStds: bandStats.map(s => s.std),
  };
}

/** Convert full tick log to player-visible data (Section 14.2) */
export function toPlayerVisible(
  state: SimState,
  bandStats: BandStats[],
  bookSnapshot: BookSnapshot,
  diceGrid: Uint8Array
): TickData {
  // Delayed SI: read from the buffer (oldest entry = 5 ticks ago)
  const delayedSI = state.siDelayBuffer.length > 0 ? state.siDelayBuffer[0] : state.SI_t;
  const delayedUtil = state.utilDelayBuffer.length > 0 ? state.utilDelayBuffer[0] : 0;

  return {
    tick: state.tickCount,
    price: state.P_t,
    volume: state.tickVolume,
    diceGrid,
    bandMeans: bandStats.map(s => s.mean),
    bandStds: bandStats.map(s => s.std),
    bestBid: bookSnapshot.bestBid,
    bestAsk: bookSnapshot.bestAsk,
    bookDepthBid5: bookSnapshot.bids.reduce((sum, l) => sum + l.totalSize, 0),
    bookDepthAsk5: bookSnapshot.asks.reduce((sum, l) => sum + l.totalSize, 0),
    shortInterest: delayedSI,
    utilization: delayedUtil,
  };
}
