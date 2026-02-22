import { pool } from '../pool.js';

export interface TradeRow {
  id: number;
  user_id: number;
  asset: 'A' | 'B';
  side: 'BUY' | 'SELL';
  quantity: number;
  price: string;
  total: string;
  ts: Date;
}

export async function insertTrade(
  userId: number,
  asset: 'A' | 'B',
  side: 'BUY' | 'SELL',
  quantity: number,
  price: number,
  total: number
): Promise<TradeRow> {
  const { rows } = await pool.query<TradeRow>(
    `INSERT INTO trades (user_id, asset, side, quantity, price, total)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userId, asset, side, quantity, price, total]
  );
  return rows[0];
}

export async function getTradeHistory(
  userId: number,
  limit: number = 100
): Promise<TradeRow[]> {
  const { rows } = await pool.query<TradeRow>(
    'SELECT * FROM trades WHERE user_id = $1 ORDER BY ts DESC LIMIT $2',
    [userId, limit]
  );
  return rows;
}
