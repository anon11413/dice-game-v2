import { db } from '../db.js';

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  cash: number;
  shares_a: number;
  shares_b: number;
  avg_entry_a: number;
  avg_entry_b: number;
  total_cost_a: number;
  total_cost_b: number;
  created_at: string;
  last_seen: string;
}

export interface UserPublic {
  id: number;
  username: string;
  cash: number;
  sharesA: number;
  sharesB: number;
  avgEntryA: number;
  avgEntryB: number;
  totalCostA: number;
  totalCostB: number;
  createdAt: string;
}

export function toPublicUser(row: UserRow): UserPublic {
  return {
    id: row.id,
    username: row.username,
    cash: row.cash,
    sharesA: row.shares_a,
    sharesB: row.shares_b,
    avgEntryA: row.avg_entry_a,
    avgEntryB: row.avg_entry_b,
    totalCostA: row.total_cost_a,
    totalCostB: row.total_cost_b,
    createdAt: row.created_at,
  };
}

export function findByUsername(username: string): UserRow | null {
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
  return row || null;
}

export function findById(id: number): UserRow | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  return row || null;
}

export function createUser(username: string, passwordHash: string): UserRow {
  const info = db.prepare(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)'
  ).run(username, passwordHash);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as UserRow;
}

export function updateLastSeen(id: number): void {
  db.prepare("UPDATE users SET last_seen = datetime('now') WHERE id = ?").run(id);
}

export function resetAccount(id: number): UserRow {
  const resetTxn = db.transaction(() => {
    db.prepare('DELETE FROM trades WHERE user_id = ?').run(id);
    db.prepare(
      `UPDATE users SET
        cash = 100.00, shares_a = 0, shares_b = 0,
        avg_entry_a = 0, avg_entry_b = 0,
        total_cost_a = 0, total_cost_b = 0
      WHERE id = ?`
    ).run(id);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow;
  });
  return resetTxn();
}
