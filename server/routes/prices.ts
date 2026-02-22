import { Router } from 'express';
import { getHistory } from '../db/queries/prices.js';

const BASE_PRICE = 100;

let currentPrice = BASE_PRICE;

export function setCurrentPrice(price: number): void {
  currentPrice = price;
}

const router = Router();

router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10000, 50000);
    const rows = await getHistory(limit);

    const candles = rows.map((r) => ({
      time: Math.floor(r.ts.getTime() / 1000),
      open: parseFloat(r.open),
      high: parseFloat(r.high),
      low: parseFloat(r.low),
      close: parseFloat(r.close),
      volume: parseInt(r.volume, 10),
    }));

    res.json({ candles });
  } catch (err: any) {
    console.error('[Prices] History error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/price', (_req, res) => {
  const priceB = Math.max(0.01, 2 * BASE_PRICE - currentPrice);
  res.json({
    price: currentPrice,
    priceB,
    timestamp: new Date().toISOString(),
  });
});

export default router;
