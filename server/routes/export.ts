import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getAllPriceHistory } from '../db/queries/prices.js';
import { getAllTradesForUser } from '../db/queries/trades.js';
import { findById, toPublicUser } from '../db/queries/users.js';
import type { ServerEngine } from '../engine/ServerEngine.js';

let engineRef: ServerEngine | null = null;

export function setExportEngineRef(engine: ServerEngine): void {
  engineRef = engine;
}

const router = Router();

// Export engine candles (from memory) as CSV
router.get('/export/candles', (req, res) => {
  try {
    if (!engineRef) {
      res.status(503).json({ error: 'Engine not ready' });
      return;
    }

    const resolution = parseInt(req.query.resolution as string) || 1;
    const candles = engineRef.getCandles(resolution);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=dicestock-candles-r${resolution}-${Date.now()}.csv`);

    // Write CSV header
    res.write('time,open,high,low,close,volume\n');

    // Write data rows
    for (const c of candles) {
      res.write(`${c.time},${c.open},${c.high},${c.low},${c.close},${c.volume}\n`);
    }

    res.end();
  } catch (err: any) {
    console.error('[Export] Candles error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export DB price history as CSV
router.get('/export/price-history', (req, res) => {
  try {
    const rows = getAllPriceHistory();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=dicestock-price-history-${Date.now()}.csv`);

    res.write('id,timestamp,open,high,low,close,volume\n');

    for (const r of rows) {
      res.write(`${r.id},${r.ts},${r.open},${r.high},${r.low},${r.close},${r.volume}\n`);
    }

    res.end();
  } catch (err: any) {
    console.error('[Export] Price history error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export user's trade history as CSV (auth required)
router.get('/export/trades', requireAuth, (req, res) => {
  try {
    const rows = getAllTradesForUser(req.user!.userId);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=dicestock-trades-${Date.now()}.csv`);

    res.write('id,asset,side,quantity,price,total,timestamp\n');

    for (const r of rows) {
      res.write(`${r.id},${r.asset},${r.side},${r.quantity},${r.price},${r.total},${r.ts}\n`);
    }

    res.end();
  } catch (err: any) {
    console.error('[Export] Trades error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export user's portfolio as CSV (auth required)
router.get('/export/portfolio', requireAuth, (req, res) => {
  try {
    const user = findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const pub = toPublicUser(user);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=dicestock-portfolio-${Date.now()}.csv`);

    res.write('field,value\n');
    res.write(`username,${pub.username}\n`);
    res.write(`cash,${pub.cash}\n`);
    res.write(`shares_a,${pub.sharesA}\n`);
    res.write(`shares_b,${pub.sharesB}\n`);
    res.write(`avg_entry_a,${pub.avgEntryA}\n`);
    res.write(`avg_entry_b,${pub.avgEntryB}\n`);
    res.write(`total_cost_a,${pub.totalCostA}\n`);
    res.write(`total_cost_b,${pub.totalCostB}\n`);
    res.write(`created_at,${pub.createdAt}\n`);

    res.end();
  } catch (err: any) {
    console.error('[Export] Portfolio error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
