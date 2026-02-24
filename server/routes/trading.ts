import { Router } from 'express';
import { db } from '../db/db.js';
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

  try {
    const executeTrade = db.transaction(() => {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as UserRow | undefined;
      if (!user) {
        return { error: 'User not found', status: 404 };
      }

      const cash = user.cash;
      const shares = asset === 'A' ? user.shares_a : user.shares_b;
      const avgEntry = asset === 'A' ? user.avg_entry_a : user.avg_entry_b;
      const totalCost = asset === 'A' ? user.total_cost_a : user.total_cost_b;

      if (side === 'BUY') {
        if (cash < total) {
          return { error: `Insufficient cash. Need $${total.toFixed(2)}, have $${cash.toFixed(2)}`, status: 400 };
        }

        const newShares = shares + qty;
        const newTotalCost = totalCost + total;
        const newAvgEntry = newShares > 0 ? newTotalCost / newShares : 0;

        const sharesCol = asset === 'A' ? 'shares_a' : 'shares_b';
        const avgCol = asset === 'A' ? 'avg_entry_a' : 'avg_entry_b';
        const costCol = asset === 'A' ? 'total_cost_a' : 'total_cost_b';

        db.prepare(
          `UPDATE users SET cash = cash - ?, ${sharesCol} = ?, ${avgCol} = ?, ${costCol} = ? WHERE id = ?`
        ).run(total, newShares, newAvgEntry, newTotalCost, req.user!.userId);
      } else {
        // SELL
        if (shares < qty) {
          return { error: `Insufficient shares. Have ${shares}, trying to sell ${qty}`, status: 400 };
        }

        const newShares = shares - qty;
        const costReduction = shares > 0 ? (qty / shares) * totalCost : 0;
        const newTotalCost = Math.max(0, totalCost - costReduction);
        const newAvgEntry = newShares > 0 ? newTotalCost / newShares : 0;

        const sharesCol = asset === 'A' ? 'shares_a' : 'shares_b';
        const avgCol = asset === 'A' ? 'avg_entry_a' : 'avg_entry_b';
        const costCol = asset === 'A' ? 'total_cost_a' : 'total_cost_b';

        db.prepare(
          `UPDATE users SET cash = cash + ?, ${sharesCol} = ?, ${avgCol} = ?, ${costCol} = ? WHERE id = ?`
        ).run(total, newShares, newAvgEntry, newTotalCost, req.user!.userId);
      }

      // Record the trade
      const tradeInfo = db.prepare(
        `INSERT INTO trades (user_id, asset, side, quantity, price, total)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(req.user!.userId, asset, side, qty, price, total);
      const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeInfo.lastInsertRowid) as TradeRow;

      // Fetch updated user
      const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as UserRow;

      return { trade, portfolio: toPublicUser(updatedUser) };
    });

    const result = executeTrade();

    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({
      trade: {
        id: result.trade.id,
        asset: result.trade.asset,
        side: result.trade.side,
        quantity: result.trade.quantity,
        price: result.trade.price,
        total: result.trade.total,
        ts: result.trade.ts,
      },
      portfolio: result.portfolio,
    });
  } catch (err: any) {
    console.error('[Trading] Trade error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
