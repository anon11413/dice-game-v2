import type { SimConfig, DirectionalBandConfig } from './types';

/** Default simulation configuration (Section 1.1) */
export const DEFAULT_CONFIG: SimConfig = {
  GRID_ROWS: 100,
  GRID_COLS: 100,
  DIE_MIN: 1,
  DIE_MAX: 20,
  P_INIT: 100.0,
  F_INIT: 100.0,
  FLOAT: 10_000_000,
  SI_INIT: 500_000,
  TICK_RATE: 390,
  BOOK_DEPTH_INIT: 50,
  TICK_SIZE: 0.01,
  MAX_ORDER_LIFETIME: 100,
  F_DRIFT_RATE: 0.002,
  SQUEEZE_UTIL_THRESH: 0.45,
  SQUEEZE_PRICE_THRESH: 0.03,
  SQUEEZE_WINDOW: 20,
  SQUEEZE_COVER_RATE: 0.08,
  SQUEEZE_COOLDOWN: 50,
  EVENT_HIGH_THRESH: 17.0,
  EVENT_LOW_THRESH: 4.0,
  EVENT_DURATION: 15,
  SENTIMENT_DECAY: 0.92,
};

/** Band parameter tables (Section 6.1) */
export const BAND1_CONFIG: DirectionalBandConfig = {
  activeEveryN: 1,
  baseOrderSize: 10,
  marketOrderProb: 0.6,
  limitOffsetMin: 0.001,
  limitOffsetMax: 0.005,
  regimeInfluenceWeight: 0.7,
  source: 'SCALP',
};

export const BAND2_CONFIG: DirectionalBandConfig = {
  activeEveryN: 13,
  baseOrderSize: 80,
  marketOrderProb: 0.35,
  limitOffsetMin: 0.005,
  limitOffsetMax: 0.02,
  regimeInfluenceWeight: 0.4,
  source: 'SWING',
};

export const BAND3_CONFIG: DirectionalBandConfig = {
  activeEveryN: 65,
  baseOrderSize: 400,
  marketOrderProb: 0.2,
  limitOffsetMin: 0.01,
  limitOffsetMax: 0.05,
  regimeInfluenceWeight: 0.15,
  source: 'POS',
};

/** Candle resolutions in ticks */
export const RESOLUTIONS = {
  TICK: 1,         // 1 tick = ~1 minute
  HOURLY: 13,      // 13 ticks = ~1 hour
  DAILY: 65,       // 65 ticks = ~1 day
  WEEKLY: 325,     // 325 ticks = ~1 week
  FULL_DAY: 390,   // 390 ticks = 1 sim trading day
} as const;
