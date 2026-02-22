import type { Order, Trade } from '../types';
import type { OrderBook } from './OrderBook';

/**
 * Match an order against the book using price-time priority (Section 12.3).
 * - Market orders execute against the best available price.
 * - Limit orders that cross the spread execute immediately; remainder rests.
 * Returns the list of trades generated.
 */
export function matchOrder(order: Order, book: OrderBook): Trade[] {
  const trades: Trade[] = [];
  let remaining = order.size;

  if (order.side === 'BUY') {
    // Walk up the ask side
    while (remaining > 0) {
      const bestAskLevel = book.peekBestAsk();
      if (!bestAskLevel) break;

      // Limit buy can't pay more than its price
      if (order.type === 'LIMIT' && order.price !== null && order.price < bestAskLevel.price) {
        break;
      }

      const fillQty = Math.min(remaining, bestAskLevel.totalSize);
      const fillPrice = bestAskLevel.price;

      // Fill from this level
      const actualFilled = book.fillFromLevel(bestAskLevel, fillQty, 'SELL');
      if (actualFilled > 0) {
        trades.push({ price: fillPrice, size: actualFilled, aggressorSide: 'BUY' });
        remaining -= actualFilled;
      } else {
        break;
      }
    }
  } else {
    // Walk down the bid side
    while (remaining > 0) {
      const bestBidLevel = book.peekBestBid();
      if (!bestBidLevel) break;

      // Limit sell can't accept less than its price
      if (order.type === 'LIMIT' && order.price !== null && order.price > bestBidLevel.price) {
        break;
      }

      const fillQty = Math.min(remaining, bestBidLevel.totalSize);
      const fillPrice = bestBidLevel.price;

      const actualFilled = book.fillFromLevel(bestBidLevel, fillQty, 'BUY');
      if (actualFilled > 0) {
        trades.push({ price: fillPrice, size: actualFilled, aggressorSide: 'SELL' });
        remaining -= actualFilled;
      } else {
        break;
      }
    }
  }

  // If limit order has remaining size, rest it in the book
  if (order.type === 'LIMIT' && remaining > 0 && order.price !== null) {
    const restingOrder: Order = {
      ...order,
      size: remaining,
    };
    book.insert(restingOrder);
  }

  return trades;
}
