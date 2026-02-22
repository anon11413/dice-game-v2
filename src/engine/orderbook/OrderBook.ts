import type { Order, OrderSource, PriceLevel as PriceLevelSnapshot } from '../types';

/**
 * Internal price level: groups orders at the same price.
 * Orders within a level are FIFO (time priority).
 */
interface PriceLevel {
  price: number;
  orders: Order[];
  totalSize: number;
}

/**
 * Limit Order Book with price-level bucketing.
 * Bids sorted descending (highest first), asks sorted ascending (lowest first).
 */
export class OrderBook {
  private bids: PriceLevel[] = [];  // Sorted descending by price
  private asks: PriceLevel[] = [];  // Sorted ascending by price
  private orderMap: Map<number, { level: PriceLevel; side: 'BUY' | 'SELL' }> = new Map();

  /** Insert a limit order into the book (does NOT match - call matchOrder first for crossing) */
  insert(order: Order): void {
    if (order.type !== 'LIMIT' || order.price === null) return;

    const side = order.side === 'BUY' ? this.bids : this.asks;
    const price = order.price;

    // Find or create the price level
    let level = this.findLevel(side, price);
    if (!level) {
      level = { price, orders: [], totalSize: 0 };
      this.insertLevel(side, level, order.side);
    }

    level.orders.push(order);
    level.totalSize += order.size;
    this.orderMap.set(order.id, { level, side: order.side });
  }

  /** Remove a specific order by ID */
  removeOrder(orderId: number): void {
    const entry = this.orderMap.get(orderId);
    if (!entry) return;

    const { level, side } = entry;
    const idx = level.orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      level.totalSize -= level.orders[idx].size;
      level.orders.splice(idx, 1);
    }
    this.orderMap.delete(orderId);

    // Remove empty levels
    if (level.orders.length === 0) {
      const levels = side === 'BUY' ? this.bids : this.asks;
      const li = levels.indexOf(level);
      if (li !== -1) levels.splice(li, 1);
    }
  }

  /** Cancel all orders from a given source (e.g., 'MM' for market maker refresh) */
  cancelAllBySource(source: OrderSource): void {
    const toRemove: number[] = [];
    for (const [id, entry] of this.orderMap) {
      const order = entry.level.orders.find(o => o.id === id);
      if (order && order.source === source) {
        toRemove.push(id);
      }
    }
    for (const id of toRemove) {
      this.removeOrder(id);
    }
  }

  /** Expire stale orders (age > maxAge), excluding MM orders (refreshed each tick) */
  expireStale(maxAge: number): void {
    const toRemove: number[] = [];
    for (const [id, entry] of this.orderMap) {
      const order = entry.level.orders.find(o => o.id === id);
      if (order && order.age > maxAge && order.source !== 'MM') {
        toRemove.push(id);
      }
    }
    for (const id of toRemove) {
      this.removeOrder(id);
    }
  }

  /** Increment age of all orders by 1 */
  incrementAllAges(): void {
    for (const entry of this.orderMap.values()) {
      for (const order of entry.level.orders) {
        order.age++;
      }
    }
  }

  /** Get the best (highest) bid price, or null if no bids */
  getBestBid(): number | null {
    return this.bids.length > 0 ? this.bids[0].price : null;
  }

  /** Get the best (lowest) ask price, or null if no asks */
  getBestAsk(): number | null {
    return this.asks.length > 0 ? this.asks[0].price : null;
  }

  /** Get the bid-ask spread, or null if either side is empty */
  getSpread(): number | null {
    const bid = this.getBestBid();
    const ask = this.getBestAsk();
    if (bid === null || ask === null) return null;
    return ask - bid;
  }

  /** Get top N bid levels as snapshots */
  getBidDepth(levels: number): PriceLevelSnapshot[] {
    return this.bids.slice(0, levels).map(l => ({
      price: l.price,
      totalSize: l.totalSize,
    }));
  }

  /** Get top N ask levels as snapshots */
  getAskDepth(levels: number): PriceLevelSnapshot[] {
    return this.asks.slice(0, levels).map(l => ({
      price: l.price,
      totalSize: l.totalSize,
    }));
  }

  /** Get total size across top N bid levels */
  getBidDepthSize(levels: number): number {
    let total = 0;
    for (let i = 0; i < Math.min(levels, this.bids.length); i++) {
      total += this.bids[i].totalSize;
    }
    return total;
  }

  /** Get total size across top N ask levels */
  getAskDepthSize(levels: number): number {
    let total = 0;
    for (let i = 0; i < Math.min(levels, this.asks.length); i++) {
      total += this.asks[i].totalSize;
    }
    return total;
  }

  /** Get total depth grouped by order source × side */
  getDepthBySource(): Record<string, { bidSize: number; askSize: number }> {
    const result: Record<string, { bidSize: number; askSize: number }> = {};
    for (const [id, entry] of this.orderMap) {
      const order = entry.level.orders.find(o => o.id === id);
      if (!order) continue;
      if (!result[order.source]) {
        result[order.source] = { bidSize: 0, askSize: 0 };
      }
      if (entry.side === 'BUY') {
        result[order.source].bidSize += order.size;
      } else {
        result[order.source].askSize += order.size;
      }
    }
    return result;
  }

  // ---- Used by the matching engine ----

  /** Peek at the best ask level (for matching buys) */
  peekBestAsk(): PriceLevel | null {
    return this.asks.length > 0 ? this.asks[0] : null;
  }

  /** Peek at the best bid level (for matching sells) */
  peekBestBid(): PriceLevel | null {
    return this.bids.length > 0 ? this.bids[0] : null;
  }

  /** Remove size from the front of a price level (fill orders FIFO) */
  fillFromLevel(level: PriceLevel, qty: number, side: 'BUY' | 'SELL'): number {
    let filled = 0;
    while (filled < qty && level.orders.length > 0) {
      const front = level.orders[0];
      const canFill = Math.min(qty - filled, front.size);
      front.size -= canFill;
      level.totalSize -= canFill;
      filled += canFill;

      if (front.size <= 0) {
        level.orders.shift();
        this.orderMap.delete(front.id);
      }
    }

    // Remove empty level
    if (level.orders.length === 0) {
      const levels = side === 'SELL' ? this.asks : this.bids; // asks are matched by buys, bids by sells
      const idx = levels.indexOf(level);
      if (idx !== -1) levels.splice(idx, 1);
    }

    return filled;
  }

  // ---- Private helpers ----

  private findLevel(levels: PriceLevel[], price: number): PriceLevel | undefined {
    return levels.find(l => l.price === price);
  }

  private insertLevel(levels: PriceLevel[], level: PriceLevel, side: 'BUY' | 'SELL'): void {
    // Binary search for insertion point
    let lo = 0;
    let hi = levels.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (side === 'BUY') {
        // Bids: descending order (higher prices first)
        if (levels[mid].price > level.price) lo = mid + 1;
        else hi = mid;
      } else {
        // Asks: ascending order (lower prices first)
        if (levels[mid].price < level.price) lo = mid + 1;
        else hi = mid;
      }
    }
    levels.splice(lo, 0, level);
  }
}
