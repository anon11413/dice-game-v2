// ============================================================
// DiceStock Engine — Core Type Definitions
// ============================================================

/** All tunable constants (Section 1.1). Fixed during a simulation run. */
export interface SimConfig {
  GRID_ROWS: number;
  GRID_COLS: number;
  DIE_MIN: number;
  DIE_MAX: number;
  P_INIT: number;
  F_INIT: number;
  FLOAT: number;
  SI_INIT: number;
  TICK_RATE: number;
  BOOK_DEPTH_INIT: number;
  TICK_SIZE: number;
  MAX_ORDER_LIFETIME: number;
  F_DRIFT_RATE: number;
  SQUEEZE_UTIL_THRESH: number;
  SQUEEZE_PRICE_THRESH: number;
  SQUEEZE_WINDOW: number;
  SQUEEZE_COVER_RATE: number;
  SQUEEZE_COOLDOWN: number;
  EVENT_HIGH_THRESH: number;
  EVENT_LOW_THRESH: number;
  EVENT_DURATION: number;
  SENTIMENT_DECAY: number;
}

/** Mutable simulation state (Section 1.2). Updated every tick. */
export interface SimState {
  dice: Uint8Array;                 // 10,000 elements flat (100x100)
  P_t: number;                     // Current price (last trade)
  F_t: number;                     // Latent fundamental value (hidden)
  SI_t: number;                    // Current short interest
  kappa_t: number;                 // Volatility multiplier
  sentiment_t: number;             // Smoothed sentiment [0,1]
  regime_t: Regime;                // Meta-regime state
  squeeze_active: boolean;
  squeeze_cooldown_remaining: number;
  squeeze_tick_counter: number;
  event_active: EventState | null;
  priceHistory: number[];          // Rolling buffer (last 1000)
  volumeHistory: number[];         // Rolling buffer (last 1000)
  tickCount: number;
  tickVolume: number;
  // For delayed SI reporting (5-tick delay)
  siDelayBuffer: number[];         // Ring buffer of 5 SI values
  utilDelayBuffer: number[];       // Ring buffer of 5 utilization values
}

export interface Regime {
  trendPersistence: number;        // Probability of continuing prior direction
  reversalProb: number;            // Probability of sudden direction flip
}

export interface EventState {
  direction: 1 | -1;
  ticksRemaining: number;
  magnitude: number;
}

/** Band statistics computed per tick */
export interface BandStats {
  mean: number;
  std: number;
  colMeans: number[];              // 100 column means
}

// ---- Order Book Types ----

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT';
export type OrderSource = 'SCALP' | 'SWING' | 'POS' | 'VALUE' | 'MM' | 'SHORT' | 'SQUEEZE';

export interface Order {
  id: number;
  side: OrderSide;
  type: OrderType;
  price: number | null;            // null for market orders
  size: number;
  age: number;
  source: OrderSource;
}

export interface Trade {
  price: number;
  size: number;
  aggressorSide: OrderSide;
}

// ---- OHLCV Candle ----

export interface OHLCV {
  time: number;                    // Tick number of candle open
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ---- Book Snapshot for UI ----

export interface PriceLevel {
  price: number;
  totalSize: number;
}

export interface BookSnapshot {
  bids: PriceLevel[];              // Top N bid levels (descending price)
  asks: PriceLevel[];              // Top N ask levels (ascending price)
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
}

// ---- Player-Visible Tick Data (Section 14.2) ----

export interface TickData {
  tick: number;
  price: number;
  volume: number;
  diceGrid: Uint8Array;            // Full 10,000 dice (visible to player)
  bandMeans: number[];             // 10 band means
  bandStds: number[];              // 10 band stds
  bestBid: number | null;
  bestAsk: number | null;
  bookDepthBid5: number;           // Total shares in top 5 bid levels
  bookDepthAsk5: number;           // Total shares in top 5 ask levels
  shortInterest: number;           // DELAYED by 5 ticks
  utilization: number;             // DELAYED by 5 ticks
  // Hidden: F_t, kappa_t, sentiment_t, regime_t, squeeze_active
}

// ---- Full Tick Log (Section 14.1, internal) ----

export interface TickLog {
  tick: number;
  dice: Uint8Array;
  P_t: number;
  F_t: number;
  volume: number;
  SI_t: number;
  utilization: number;
  kappa_t: number;
  sentiment_t: number;
  regime_t: Regime;
  squeeze_active: boolean;
  event_active: EventState | null;
  bestBid: number | null;
  bestAsk: number | null;
  bookDepthBid5: number;
  bookDepthAsk5: number;
  bandMeans: number[];
  bandStds: number[];
}

// ---- Directional Band Config (Section 6.1) ----

export interface DirectionalBandConfig {
  activeEveryN: number;
  baseOrderSize: number;
  marketOrderProb: number;
  limitOffsetMin: number;          // Fraction of P_t
  limitOffsetMax: number;          // Fraction of P_t
  regimeInfluenceWeight: number;
  source: OrderSource;
}
