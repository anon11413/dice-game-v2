import { db } from '../db.js';

export interface TradeRow {
  id: number;
  user_id: number;
  asset: 'A' | 'B';
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  total: number;
  ts: string;
}

export function insertTrade(
  userId: number,
  asset: 'A' | 'B',
  side: 'BUY' | 'SELL',
  quantity: number,
  price: number,
  total: number
): TradeRow {
  const info = db.prepare(
    `INSERT INTO trades (user_id, asset, side, quantity, price, total)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, asset, side, quantity, price, total);
  return db.prepare('SELECT * FROM trades WHERE id = ?').get(info.lastInsertRowid) as TradeRow;
}

export function getTradeHistory(
  userId: number,
  limit: number = 100
): TradeRow[] {
  return db.prepare(
    'SELECT * FROM trades WHERE user_id = ? ORDER BY ts DESC LIMIT ?'
  ).all(userId, limit) as TradeRow[];
}

export function getAllTradesForUser(userId: number): TradeRow[] {
  return db.prepare(
    'SELECT * FROM trades WHERE user_id = ? ORDER BY ts DESC'
  ).all(userId) as TradeRow[];
}
