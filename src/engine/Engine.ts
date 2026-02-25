import type {
  SimConfig, SimState, BandStats, Order, Trade, OHLCV,
  TickData, TickLog, BookSnapshot, ExtendedAnalysisData, RevealData,
} from './types';
import { DEFAULT_CONFIG, RESOLUTIONS } from './constants';
import { PRNG } from './prng';
import { DiceGrid } from './dice/DiceGrid';
import { computeAllBandStats } from './dice/bandStats';
import { OrderBook } from './orderbook/OrderBook';
import { matchOrder } from './orderbook/matchingEngine';
import { createOrder, resetOrderIds } from './orderbook/Order';
import { CandleAggregator } from './aggregation/CandleAggregator';
import { TickStore } from './history/TickStore';
import { toPlayerVisible } from './history/TickLog';

// Band implementations
import { updateKappa } from './bands/band7-volatility';
import { generateValueOrders } from './bands/band4-fundamental';
import { updateRegime } from './bands/band10-regime';
import { updateSentiment } from './bands/band9-sentiment';
import { evaluateEvents } from './bands/band8-events';
import { generateScalperOrders } from './bands/band1-scalpers';
import { generateSwingOrders } from './bands/band2-swing';
import { generatePositionOrders } from './bands/band3-position';
import { generateMarketMakerOrders } from './bands/band6-marketMakers';
import { generateShortOrders, evaluateSqueeze, generateSqueezeCovers } from './bands/band5-shorts';
import { updateTrend } from './bands/band11-trend';
import { updateVolumeProfile, detectSRLevels, flipBrokenLevels, generateSROrders } from './bands/band12-supportResistance';

/**
 * DiceStock Engine — Main Simulation Controller
 * Orchestrates the full tick lifecycle per Section 3.
 */
export class Engine {
  readonly config: SimConfig;
  private state: SimState;
  private prng: PRNG;
  private grid: DiceGrid;
  private book: OrderBook;
  private candleAggregator: CandleAggregator;
  private tickStore: TickStore;
  private lastBandStats: BandStats[] = [];
  private lastBuyVolume = 0;
  private lastSellVolume = 0;

  constructor(seed: number, configOverrides?: Partial<SimConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...configOverrides };
    this.prng = new PRNG(seed);
    resetOrderIds();

    this.grid = new DiceGrid(this.config.GRID_ROWS, this.config.GRID_COLS);
    this.book = new OrderBook();
    this.candleAggregator = new CandleAggregator([
      RESOLUTIONS.ONE_SEC,
      RESOLUTIONS.ONE_MIN,
      RESOLUTIONS.TWO_MIN,
      RESOLUTIONS.FIVE_MIN,
      RESOLUTIONS.TEN_MIN,
      RESOLUTIONS.TWENTY_MIN,
      RESOLUTIONS.ONE_HOUR,
      RESOLUTIONS.TWO_HOUR,
      RESOLUTIONS.ONE_DAY,
    ]);
    this.tickStore = new TickStore(1000);

    // Initialize mutable state (Section 1.2)
    this.state = {
      dice: new Uint8Array(this.config.GRID_ROWS * this.config.GRID_COLS),
      P_t: this.config.P_INIT,
      F_t: this.config.F_INIT,
      SI_t: this.config.SI_INIT,
      kappa_t: 1.0,
      sentiment_t: 0.5,
      regime_t: { trendPersistence: 0.4, reversalProb: 0.1 },
      squeeze_active: false,
      squeeze_cooldown_remaining: 0,
      squeeze_tick_counter: 0,
      event_active: null,
      priceHistory: [],
      volumeHistory: [],
      tickCount: 0,
      tickVolume: 0,
      siDelayBuffer: [],
      utilDelayBuffer: [],
      trendSignal_t: 0,
      srLevels: [],
      volumeProfile: new Map(),
    };

    // Seed the order book (Section 15.3)
    this.initializeBook();
  }

  /** Execute one full tick and return player-visible data */
  tick(): TickData {
    // 1. Roll all 10,000 dice
    this.grid.roll(this.prng);
    this.state.dice = this.grid.getRawGrid();

    // 2. Compute band statistics
    const bandStats = computeAllBandStats(this.state.dice);
    this.lastBandStats = bandStats;

    // 3A. Phase A — Environment Update
    this.phaseA(bandStats);

    // 3B. Phase B — Order Generation
    const newOrders = this.phaseB(bandStats);

    // 3C. Phase C — Matching
    const trades = this.phaseC(newOrders);

    // 3D. Phase D — Post-Tick
    this.phaseD(trades);

    // Generate player-visible data
    const diceGrid = this.grid.getGridCopy(); // Copy for transfer
    const bookSnapshot = this.getBookSnapshot();

    return toPlayerVisible(this.state, bandStats, bookSnapshot, diceGrid);
  }

  // ---- Phase Implementations ----

  private phaseA(stats: BandStats[]): void {
    // a. Update volatility multiplier (Band 7 = index 6)
    updateKappa(this.state, stats[6]);

    // b. Update fundamental value via Band 11 OU trend (every tick)
    updateTrend(this.state, this.config, stats[10]);

    // c. Update meta-regime (Band 10 = index 9, every 13 ticks)
    if (this.state.tickCount % 13 === 0) {
      updateRegime(this.state, stats[9]);
    }

    // d. Update sentiment (Band 9 = index 8)
    updateSentiment(this.state, this.config, stats[8]);

    // e. Evaluate event triggers (Band 8 = index 7)
    evaluateEvents(this.state, this.config, stats[7]);

    // f. Squeeze conditions evaluated after Band 5 orders in phaseB
  }

  private phaseB(stats: BandStats[]): Order[] {
    const orders: Order[] = [];

    // a. Expire stale orders
    this.book.incrementAllAges();
    this.book.expireStale(this.config.MAX_ORDER_LIFETIME);

    // b. Market maker orders (Band 6 = index 5)
    orders.push(...generateMarketMakerOrders(this.state, this.config, stats[5], this.book));

    // c. Scalper orders (Band 1 = index 0, every tick)
    orders.push(...generateScalperOrders(this.state, this.config, stats[0], this.prng));

    // d. Swing orders (Band 2 = index 1, every 13 ticks)
    if (this.state.tickCount % 13 === 0) {
      orders.push(...generateSwingOrders(this.state, this.config, stats[1], this.prng));
    }

    // e. Position orders (Band 3 = index 2, every 65 ticks)
    if (this.state.tickCount % 65 === 0) {
      orders.push(...generatePositionOrders(this.state, this.config, stats[2], this.prng));
    }

    // f. Value agent orders (Band 4 = index 3, every 65 ticks)
    if (this.state.tickCount % 65 === 0) {
      orders.push(...generateValueOrders(this.state, this.config, stats[3], this.prng));
    }

    // f2. S/R orders (Band 12 = index 11, every 65 ticks)
    if (this.state.tickCount % 65 === 0) {
      orders.push(...generateSROrders(this.state, this.config, stats[11]));
    }

    // g. Short seller orders (Band 5 = index 4)
    orders.push(...generateShortOrders(this.state, this.config, stats[4], this.prng));

    // Evaluate squeeze after short orders
    evaluateSqueeze(this.state, this.config);

    // h. Squeeze cover orders
    if (this.state.squeeze_active) {
      orders.push(...generateSqueezeCovers(this.state, this.config));
    }

    return orders;
  }

  private phaseC(newOrders: Order[]): Trade[] {
    const marketOrders = newOrders.filter(o => o.type === 'MARKET');
    const limitOrders = newOrders.filter(o => o.type === 'LIMIT');

    // Shuffle market orders randomly
    this.prng.shuffle(marketOrders);

    const trades: Trade[] = [];

    // Feed market orders one-by-one
    for (const order of marketOrders) {
      trades.push(...matchOrder(order, this.book));
    }

    // Insert limit orders (may cross immediately)
    for (const order of limitOrders) {
      trades.push(...matchOrder(order, this.book));
    }

    // Record last trade price and buy/sell volume
    if (trades.length > 0) {
      this.state.P_t = trades[trades.length - 1].price;
      this.state.tickVolume = trades.reduce((sum, t) => sum + t.size, 0);
      this.lastBuyVolume = trades
        .filter(t => t.aggressorSide === 'BUY')
        .reduce((sum, t) => sum + t.size, 0);
      this.lastSellVolume = trades
        .filter(t => t.aggressorSide === 'SELL')
        .reduce((sum, t) => sum + t.size, 0);
    } else {
      this.state.tickVolume = 0;
      this.lastBuyVolume = 0;
      this.lastSellVolume = 0;
    }

    return trades;
  }

  private phaseD(trades: Trade[]): void {
    // Update price/volume history
    this.state.priceHistory.push(this.state.P_t);
    this.state.volumeHistory.push(this.state.tickVolume);

    // Trim to last 1000
    if (this.state.priceHistory.length > 1000) {
      this.state.priceHistory.shift();
    }
    if (this.state.volumeHistory.length > 1000) {
      this.state.volumeHistory.shift();
    }

    // Update SI delay buffers (5-tick delay)
    this.state.siDelayBuffer.push(this.state.SI_t);
    this.state.utilDelayBuffer.push(this.state.SI_t / this.config.FLOAT);
    if (this.state.siDelayBuffer.length > 5) {
      this.state.siDelayBuffer.shift();
    }
    if (this.state.utilDelayBuffer.length > 5) {
      this.state.utilDelayBuffer.shift();
    }

    // Decrement squeeze cooldown
    if (this.state.squeeze_cooldown_remaining > 0) {
      this.state.squeeze_cooldown_remaining--;
    }

    // Check squeeze termination
    if (this.state.squeeze_active) {
      this.state.squeeze_tick_counter++;
      if (this.state.squeeze_tick_counter > 390 || this.state.SI_t / this.config.FLOAT < 0.35) {
        this.state.squeeze_active = false;
        this.state.squeeze_tick_counter = 0;
      }
    }

    // Volume profile tracking (Band 12)
    updateVolumeProfile(this.state, this.config, trades);

    // S/R level detection (every 65 ticks)
    if (this.state.tickCount % 65 === 0) {
      detectSRLevels(this.state, this.config);
    }

    // S/R level flips
    flipBrokenLevels(this.state, this.config);

    // Aggregate candles
    this.candleAggregator.addTick(this.state.tickCount, this.state.P_t, this.state.tickVolume);

    // Increment tick count
    this.state.tickCount++;
  }

  // ---- Initialization ----

  private initializeBook(): void {
    // Section 15.3: Seed with MM orders centered on P_INIT
    for (let i = 0; i < this.config.BOOK_DEPTH_INIT; i++) {
      const offset = (i + 1) * this.config.TICK_SIZE * 5;
      const bidPrice = Math.round((this.config.P_INIT - offset) / this.config.TICK_SIZE) * this.config.TICK_SIZE;
      const askPrice = Math.round((this.config.P_INIT + offset) / this.config.TICK_SIZE) * this.config.TICK_SIZE;

      const bidOrder = createOrder('BUY', 'LIMIT', bidPrice, 200, 'MM');
      this.book.insert(bidOrder);

      const askOrder = createOrder('SELL', 'LIMIT', askPrice, 200, 'MM');
      this.book.insert(askOrder);
    }
  }

  // ---- Public Query Methods ----

  setPriceScale(scale: number): void {
    (this.config as { PRICE_SCALE: number }).PRICE_SCALE = scale;
  }

  getCandles(resolution: number, from?: number, to?: number): OHLCV[] {
    return this.candleAggregator.getCandlesWithCurrent(resolution);
  }

  getBookSnapshot(): BookSnapshot {
    const bids = this.book.getBidDepth(20);
    const asks = this.book.getAskDepth(20);
    return {
      bids,
      asks,
      bestBid: this.book.getBestBid(),
      bestAsk: this.book.getBestAsk(),
      spread: this.book.getSpread(),
    };
  }

  getDiceGrid(): Uint8Array {
    return this.grid.getGridCopy();
  }

  getBandStats(): BandStats[] {
    return this.lastBandStats;
  }

  getState(): Readonly<SimState> {
    return this.state;
  }

  getTickCount(): number {
    return this.state.tickCount;
  }

  getPrice(): number {
    return this.state.P_t;
  }

  /** Extended analysis data for Analysis V2 dashboard */
  getExtendedAnalysis(): ExtendedAnalysisData {
    const colMeans = this.lastBandStats.map(s => s.colMeans);
    return {
      colMeans,
      buyVolume: this.lastBuyVolume,
      sellVolume: this.lastSellVolume,
      depthBySource: this.book.getDepthBySource(),
      F_t: this.state.F_t,
    };
  }

  /** Reveal hidden engine state (for Quant Lab reveal mode) */
  getRevealData(): RevealData {
    return {
      F_t: this.state.F_t,
      kappa_t: this.state.kappa_t,
      sentiment_t: this.state.sentiment_t,
      regime_t: { ...this.state.regime_t },
      squeeze_active: this.state.squeeze_active,
      event_active: this.state.event_active ? { ...this.state.event_active } : null,
      trendSignal_t: this.state.trendSignal_t,
      srLevelCount: this.state.srLevels.length,
    };
  }
}
