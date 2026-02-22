import { pool } from '../pool.js';

export interface PriceHistoryRow {
  id: number;
  ts: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface PriceStateRow {
  id: number;
  last_price: string;
  last_seed: number;
  tick_count: number;
  last_updated: Date;
}

export async function getPriceState(): Promise<PriceStateRow | null> {
  const { rows } = await pool.query<PriceStateRow>(
    'SELECT * FROM price_state WHERE id = 1'
  );
  return rows[0] || null;
}

export async function updatePriceState(
  price: number,
  seed: number,
  tickCount: number
): Promise<void> {
  await pool.query(
    `UPDATE price_state SET
      last_price = $1, last_seed = $2, tick_count = $3, last_updated = NOW()
    WHERE id = 1`,
    [price, seed, tickCount]
  );
}

export async function insertCandle(
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number
): Promise<void> {
  await pool.query(
    'INSERT INTO price_history (open, high, low, close, volume) VALUES ($1, $2, $3, $4, $5)',
    [open, high, low, close, volume]
  );
}

export async function getHistory(limit: number = 10000): Promise<PriceHistoryRow[]> {
  const { rows } = await pool.query<PriceHistoryRow>(
    'SELECT * FROM price_history ORDER BY ts ASC LIMIT $1',
    [limit]
  );
  return rows;
}
