import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { findById, resetAccount, toPublicUser, updateLastSeen } from '../db/queries/users.js';
import { getTradeHistory } from '../db/queries/trades.js';

const router = Router();

router.get('/me', requireAuth, (req, res) => {
  try {
    const user = findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    updateLastSeen(user.id);
    res.json({ user: toPublicUser(user) });
  } catch (err: any) {
    console.error('[User] Get profile error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/trades', requireAuth, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const rows = getTradeHistory(req.user!.userId, limit);

    const trades = rows.map((r) => ({
      id: r.id,
      asset: r.asset,
      side: r.side,
      quantity: r.quantity,
      price: r.price,
      total: r.total,
      ts: r.ts,
    }));

    res.json({ trades });
  } catch (err: any) {
    console.error('[User] Trade history error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/settings/reset', requireAuth, (req, res) => {
  try {
    const user = resetAccount(req.user!.userId);
    res.json({ user: toPublicUser(user), message: 'Account reset to $100' });
  } catch (err: any) {
    console.error('[User] Reset error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
