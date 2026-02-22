import type { Order, OrderSide, OrderType, OrderSource } from '../types';

let nextOrderId = 0;

/** Create a new order with auto-incrementing ID */
export function createOrder(
  side: OrderSide,
  type: OrderType,
  price: number | null,
  size: number,
  source: OrderSource
): Order {
  return {
    id: nextOrderId++,
    side,
    type,
    price,
    size,
    age: 0,
    source,
  };
}

/** Reset order IDs (for deterministic replay from scratch) */
export function resetOrderIds(): void {
  nextOrderId = 0;
}
