import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { toPublicUser, type UserRow } from '../db/queries/users.js';
import type { TradeRow } from '../db/queries/trades.js';

const BASE_PRICE = 100;

let getCurrentPriceFn: () => number = () => BASE_PRICE;

export function setGetCurrentPrice(fn: () => number): void {
  getCurrentPriceFn = fn;
}

const router = Router();

router.post('/trade', requireAuth, async (req, res) => {
  const { asset, side, quantity } = req.body;

  // Validate inputs
  if (!asset || !['A', 'B'].includes(asset)) {
    res.status(400).json({ error: 'Asset must be A or B' });
    return;
  }
  if (!side || !['BUY', 'SELL'].includes(side)) {
    res.status(400).json({ error: 'Side must be BUY or SELL' });
    return;
  }
  const qty = parseInt(quantity, 10);
  if (!qty || qty <= 0 || qty > 100000) {
    res.status(400).json({ error: 'Quantity must be between 1 and 100000' });
    return;
  }

  const priceA = getCurrentPriceFn();
  const priceB = Math.max(0.01, 2 * BASE_PRICE - priceA);
  const price = asset === 'A' ? priceA : priceB;
  const total = parseFloat((price * qty).toFixed(2));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the user row
    const { rows } = await client.query<UserRow>(
      'SELECT * FROM users WHERE id = $1 FOR UPDATE',
      [req.user!.userId]
    );
    const user = rows[0];
    if (!user) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const cash = parseFloat(user.cash);
    const shares = asset === 'A' ? user.shares_a : user.shares_b;
    const avgEntry = parseFloat(asset === 'A' ? user.avg_entry_a : user.avg_entry_b);
    const totalCost = parseFloat(asset === 'A' ? user.total_cost_a : user.total_cost_b);

    if (side === 'BUY') {
      if (cash < total) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: `Insufficient cash. Need $${total.toFixed(2)}, have $${cash.toFixed(2)}` });
        return;
      }

      const newShares = shares + qty;
      const newTotalCost = totalCost + total;
      const newAvgEntry = newShares > 0 ? newTotalCost / newShares : 0;

      const sharesCol = asset === 'A' ? 'shares_a' : 'shares_b';
      const avgCol = asset === 'A' ? 'avg_entry_a' : 'avg_entry_b';
      const costCol = asset === 'A' ? 'total_cost_a' : 'total_cost_b';

      await client.query(
        `UPDATE users SET cash = cash - $1, ${sharesCol} = $2, ${avgCol} = $3, ${costCol} = $4 WHERE id = $5`,
        [total, newShares, newAvgEntry, newTotalCost, req.user!.userId]
      );
    } else {
      // SELL
      if (shares < qty) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: `Insufficient shares. Have ${shares}, trying to sell ${qty}` });
        return;
      }

      const newShares = shares - qty;
      // Proportionally reduce total cost
      const costReduction = shares > 0 ? (qty / shares) * totalCost : 0;
      const newTotalCost = Math.max(0, totalCost - costReduction);
      const newAvgEntry = newShares > 0 ? newTotalCost / newShares : 0;

      const sharesCol = asset === 'A' ? 'shares_a' : 'shares_b';
      const avgCol = asset === 'A' ? 'avg_entry_a' : 'avg_entry_b';
      const costCol = asset === 'A' ? 'total_cost_a' : 'total_cost_b';

      await client.query(
        `UPDATE users SET cash = cash + $1, ${sharesCol} = $2, ${avgCol} = $3, ${costCol} = $4 WHERE id = $5`,
        [total, newShares, newAvgEntry, newTotalCost, req.user!.userId]
      );
    }

    // Record the trade within the same transaction
    const { rows: tradeRows } = await client.query<TradeRow>(
      `INSERT INTO trades (user_id, asset, side, quantity, price, total)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user!.userId, asset, side, qty, price, total]
    );
    const trade = tradeRows[0];

    // Fetch updated user
    const { rows: updatedRows } = await client.query<UserRow>(
      'SELECT * FROM users WHERE id = $1',
      [req.user!.userId]
    );

    await client.query('COMMIT');

    res.json({
      trade: {
        id: trade.id,
        asset: trade.asset,
        side: trade.side,
        quantity: trade.quantity,
        price: parseFloat(trade.price),
        total: parseFloat(trade.total),
        ts: trade.ts.toISOString(),
      },
      portfolio: toPublicUser(updatedRows[0]),
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[Trading] Trade error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

export default router;
