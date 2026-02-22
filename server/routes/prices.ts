import { Router } from 'express';

const BASE_PRICE = 100;

let currentPrice = BASE_PRICE;
let getCandlesFn: ((resolution: number) => any[]) | null = null;

export function setCurrentPrice(price: number): void {
  currentPrice = price;
}

export function setGetCandles(fn: (resolution: number) => any[]): void {
  getCandlesFn = fn;
}

const router = Router();

router.get('/history', async (req, res) => {
  try {
    if (!getCandlesFn) {
      return res.status(503).json({ error: 'Engine not ready' });
    }

    const resolution = parseInt(req.query.resolution as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 5000, 50000);

    // Read candles from engine memory (tick-count-based times, all resolutions)
    const allCandles = getCandlesFn(resolution);
    const candles = allCandles.slice(-limit);

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
