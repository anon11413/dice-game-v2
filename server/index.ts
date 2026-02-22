import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './config.js';
import { pool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { getPriceState, updatePriceState, insertCandle } from './db/queries/prices.js';
import { ServerEngine } from './engine/ServerEngine.js';
import { initWebSocket, broadcastCandle } from './ws/broadcast.js';

import authRoutes from './routes/auth.js';
import pricesRoutes, { setCurrentPrice } from './routes/prices.js';
import tradingRoutes, { setGetCurrentPrice } from './routes/trading.js';
import userRoutes from './routes/user.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  // 1. Run database migrations
  try {
    await migrate();
  } catch (err) {
    console.error('[Server] DB migration failed — running without database');
    console.error('[Server] API endpoints requiring DB will fail');
  }

  // 2. Load price state from DB
  let seed = 42;
  let tickCount = 0;
  try {
    const state = await getPriceState();
    if (state) {
      seed = state.last_seed;
      tickCount = state.tick_count;
      console.log(`[Server] Resuming from seed=${seed}, tickCount=${tickCount}, price=$${parseFloat(state.last_price).toFixed(2)}`);
    }
  } catch {
    console.log('[Server] No price state found, starting fresh');
  }

  // 3. Create and initialize engine
  const engine = new ServerEngine(seed);
  if (tickCount > 0) {
    engine.replayToTick(tickCount);
  }

  // Wire up current price accessor for trade execution
  setCurrentPrice(engine.getPrice());
  setGetCurrentPrice(() => engine.getPrice());

  // 4. Set up Express
  const app = express();
  const httpServer = createServer(app);

  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api', authRoutes);
  app.use('/api', pricesRoutes);
  app.use('/api', tradingRoutes);
  app.use('/api', userRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      price: engine.getPrice(),
      tickCount: engine.getTickCount(),
      uptime: process.uptime(),
    });
  });

  // Serve static files in production
  if (config.isProduction) {
    const distPath = path.join(__dirname, '..', 'dist');
    app.use(express.static(distPath));
    // Express 5 requires named wildcard (path-to-regexp v8)
    app.get('/{*path}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 5. Initialize WebSocket
  initWebSocket(httpServer);

  // 6. Start engine loop
  engine.start(async (candle, currentPrice, tickCount) => {
    // Update in-memory price for API
    setCurrentPrice(currentPrice);

    // Persist to database
    try {
      await insertCandle(candle.open, candle.high, candle.low, candle.close, candle.volume);
      await updatePriceState(currentPrice, seed, tickCount);
    } catch (err: any) {
      console.error('[Server] Failed to persist candle:', err.message);
    }

    // Broadcast to WebSocket clients
    broadcastCandle(candle, currentPrice);
  });

  // 7. Start listening
  httpServer.listen(config.port, () => {
    console.log(`[Server] DiceStock running on port ${config.port}`);
    console.log(`[Server] Engine price: $${engine.getPrice().toFixed(2)}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Server] Shutting down...');
    engine.stop();
    try {
      await updatePriceState(engine.getPrice(), seed, engine.getTickCount());
      console.log('[Server] Final state saved');
    } catch {}
    await pool.end();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Server] Fatal error:', err);
  process.exit(1);
});
