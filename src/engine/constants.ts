import type { SimConfig, DirectionalBandConfig } from './types';

/** Default simulation configuration (Section 1.1) */
export const DEFAULT_CONFIG: SimConfig = {
  GRID_ROWS: 120,
  GRID_COLS: 100,
  DIE_MIN: 1,
  DIE_MAX: 20,
  P_INIT: 100.0,
  F_INIT: 100.0,
  FLOAT: 10_000_000,
  SI_INIT: 4_000_000,
  TICK_RATE: 390,
  BOOK_DEPTH_INIT: 50,
  TICK_SIZE: 0.01,
  MAX_ORDER_LIFETIME: 100,
  F_DRIFT_RATE: 0.002,
  SQUEEZE_UTIL_THRESH: 0.45,
  SQUEEZE_PRICE_THRESH: 0.03,
  SQUEEZE_WINDOW: 20,
  SQUEEZE_COVER_RATE: 0.0005,
  SQUEEZE_COOLDOWN: 50,
  EVENT_HIGH_THRESH: 18.5,
  EVENT_LOW_THRESH: 2.5,
  EVENT_DURATION: 15,
  SENTIMENT_DECAY: 0.92,

  // Trend (Band 11)
  F_TREND_MU: 0.00000069,       // 7%/year = ln(1.07)/(252*390)
  F_TREND_ALPHA: 0.9995,        // EMA half-life ~1386 ticks (~3.5 trading days)
  F_TREND_THETA: 0.0001,        // Mean-reversion half-life ~18 trading days
  F_TREND_SIGMA: 0.01,          // Dice drift scaling (~0.4% daily F_t vol)

  // Support/Resistance (Band 12)
  SR_DECAY: 0.998,
  SR_MAX_LEVELS: 10,
  SR_PROXIMITY: 0.05,
  SR_BASE_SIZE: 80,
  SR_TEST_DECAY: 0.85,
  SR_BREAK_THRESH: 0.01,

  // Value agent tiers
  VALUE_PASSIVE_GAP: 0.03,
  VALUE_URGENT_GAP: 0.10,
  VALUE_EMERGENCY_GAP: 0.30,

  // Price movement compression: divides all price offsets (~30% daily EM → ~1%)
  PRICE_SCALE: 30,
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

/** Chart candle resolutions in ticks (325 ticks = 1 perceived minute) */
export const RESOLUTIONS = {
  ONE_SEC: 5,          // ~1 second (325/60 ≈ 5.42, rounded to 5)
  ONE_MIN: 325,        // 1 minute
  TWO_MIN: 650,        // 2 minutes
  FIVE_MIN: 1_625,     // 5 minutes
  TEN_MIN: 3_250,      // 10 minutes
  TWENTY_MIN: 6_500,   // 20 minutes
  ONE_HOUR: 19_500,    // 1 hour (60 × 325)
  TWO_HOUR: 39_000,    // 2 hours
  ONE_DAY: 126_750,    // 1 trading day (6.5h × 60 × 325)
} as const;

/** Internal timing intervals (unchanged engine tick cadences) */
export const TICK_INTERVALS = {
  EVERY_TICK: 1,
  HOURLY: 13,
  DAILY: 65,
  WEEKLY: 325,
  FULL_DAY: 390,
} as const;
