import { db } from '../db.js';

export interface PriceHistoryRow {
  id: number;
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceStateRow {
  id: number;
  last_price: number;
  last_seed: number;
  tick_count: number;
  last_updated: string;
}

export function getPriceState(): PriceStateRow | null {
  const row = db.prepare('SELECT * FROM price_state WHERE id = 1').get() as PriceStateRow | undefined;
  return row || null;
}

export function updatePriceState(
  price: number,
  seed: number,
  tickCount: number
): void {
  db.prepare(
    `UPDATE price_state SET
      last_price = ?, last_seed = ?, tick_count = ?, last_updated = datetime('now')
    WHERE id = 1`
  ).run(price, seed, tickCount);
}

export function insertCandle(
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number
): void {
  db.prepare(
    'INSERT INTO price_history (open, high, low, close, volume) VALUES (?, ?, ?, ?, ?)'
  ).run(open, high, low, close, volume);
}

export function getHistory(limit: number = 10000): PriceHistoryRow[] {
  return db.prepare(
    'SELECT * FROM price_history ORDER BY ts ASC LIMIT ?'
  ).all(limit) as PriceHistoryRow[];
}

export function getAllPriceHistory(): PriceHistoryRow[] {
  return db.prepare(
    'SELECT * FROM price_history ORDER BY ts ASC'
  ).all() as PriceHistoryRow[];
}
