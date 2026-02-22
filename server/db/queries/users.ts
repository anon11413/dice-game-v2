import { pool } from '../pool.js';

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  cash: string; // NUMERIC comes back as string from pg
  shares_a: number;
  shares_b: number;
  avg_entry_a: string;
  avg_entry_b: string;
  total_cost_a: string;
  total_cost_b: string;
  created_at: Date;
  last_seen: Date;
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
    cash: parseFloat(row.cash),
    sharesA: row.shares_a,
    sharesB: row.shares_b,
    avgEntryA: parseFloat(row.avg_entry_a),
    avgEntryB: parseFloat(row.avg_entry_b),
    totalCostA: parseFloat(row.total_cost_a),
    totalCostB: parseFloat(row.total_cost_b),
    createdAt: row.created_at.toISOString(),
  };
}

export async function findByUsername(username: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );
  return rows[0] || null;
}

export async function findById(id: number): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

export async function createUser(username: string, passwordHash: string): Promise<UserRow> {
  const { rows } = await pool.query<UserRow>(
    'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *',
    [username, passwordHash]
  );
  return rows[0];
}

export async function updateLastSeen(id: number): Promise<void> {
  await pool.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [id]);
}

export async function resetAccount(id: number): Promise<UserRow> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM trades WHERE user_id = $1', [id]);
    const { rows } = await client.query<UserRow>(
      `UPDATE users SET
        cash = 100.00, shares_a = 0, shares_b = 0,
        avg_entry_a = 0, avg_entry_b = 0,
        total_cost_a = 0, total_cost_b = 0
      WHERE id = $1 RETURNING *`,
      [id]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
