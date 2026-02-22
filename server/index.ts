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
import { initWebSocket, broadcastCandle, broadcastAnalysis, setCurrentPriceForWS } from './ws/broadcast.js';

import authRoutes from './routes/auth.js';
import pricesRoutes, { setCurrentPrice, setGetCandles } from './routes/prices.js';
import tradingRoutes, { setGetCurrentPrice } from './routes/trading.js';
import userRoutes from './routes/user.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// How often to persist to DB (every 390 ticks = 1 sim "day")
const DB_PERSIST_INTERVAL = 390;

async function main() {
  // ── 1. Listen IMMEDIATELY so Render health probes pass ──
  let engineReady = false;
  let engine: ServerEngine | null = null;

  const app = express();
  const httpServer = createServer(app);

  app.use(cors());
  app.use(express.json());

  // Health check — responds instantly even during engine replay
  app.get('/api/health', (_req, res) => {
    if (!engineReady || !engine) {
      return res.json({ status: 'starting', uptime: process.uptime() });
    }
    res.json({
      status: 'ok',
      price: engine.getPrice(),
      tickCount: engine.getTickCount(),
      uptime: process.uptime(),
    });
  });

  // Serve static files in production (SPA loads while engine warms up)
  if (config.isProduction) {
    const distPath = path.join(__dirname, '..', 'dist');
    app.use(express.static(distPath));
    // Express 5 requires named wildcard (path-to-regexp v8)
    app.get('/{*path}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Initialize WebSocket
  initWebSocket(httpServer);

  httpServer.listen(config.port, () => {
    console.log(`[Server] Listening on port ${config.port} (engine starting...)`);
  });

  // ── 2. DB migrations + load state ──
  try {
    await migrate();
  } catch (err) {
    console.error('[Server] DB migration failed — running without database');
    console.error('[Server] API endpoints requiring DB will fail');
  }

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

  // ── 3. Create engine + async replay (yields to event loop) ──
  engine = new ServerEngine(seed);
  if (tickCount > 0) {
    await engine.replayToTick(tickCount);
  }

  // Wire up current price accessor for trade execution
  setCurrentPrice(engine.getPrice());
  setGetCurrentPrice(() => engine.getPrice());
  // Wire up candle accessor for history endpoint (serves from engine memory)
  setGetCandles((resolution) => engine.getCandles(resolution));

  // ── 4. API routes (registered after engine is ready) ──
  app.use('/api', authRoutes);
  app.use('/api', pricesRoutes);
  app.use('/api', tradingRoutes);
  app.use('/api', userRoutes);

  // ── 5. Start engine loop — 25 ticks/sec ──
  let ticksSinceLastPersist = 0;
  let dbWriteInProgress = false;

  // Accumulate an aggregate candle for DB persistence (390-tick OHLCV)
  let aggOpen = 0;
  let aggHigh = -Infinity;
  let aggLow = Infinity;
  let aggClose = 0;
  let aggVolume = 0;

  engine.start((candle, currentPrice, currentTickCount) => {
    // Update in-memory price for REST API
    setCurrentPrice(currentPrice);
    setCurrentPriceForWS(currentPrice, currentTickCount);

    // Broadcast every tick to WebSocket clients
    broadcastCandle(candle, currentPrice);

    // Broadcast analysis data at ~5Hz (every 5 ticks) for Analysis page
    if (currentTickCount % 5 === 0) {
      broadcastAnalysis(engine!.getAnalysisData());
    }

    // Accumulate aggregate candle for DB
    ticksSinceLastPersist++;
    if (ticksSinceLastPersist === 1) {
      aggOpen = candle.open;
      aggHigh = candle.high;
      aggLow = candle.low;
    } else {
      if (candle.high > aggHigh) aggHigh = candle.high;
      if (candle.low < aggLow) aggLow = candle.low;
    }
    aggClose = candle.close;
    aggVolume += candle.volume;

    // Persist to DB every 390 ticks (don't await — fire and forget with error logging)
    if (ticksSinceLastPersist >= DB_PERSIST_INTERVAL && !dbWriteInProgress) {
      dbWriteInProgress = true;
      const saveOpen = aggOpen;
      const saveHigh = aggHigh;
      const saveLow = aggLow;
      const saveClose = aggClose;
      const saveVolume = aggVolume;
      const saveTickCount = currentTickCount;

      // Reset accumulators
      ticksSinceLastPersist = 0;
      aggHigh = -Infinity;
      aggLow = Infinity;
      aggVolume = 0;

      // Fire-and-forget DB write
      (async () => {
        try {
          await insertCandle(saveOpen, saveHigh, saveLow, saveClose, saveVolume);
          await updatePriceState(currentPrice, seed, saveTickCount);
        } catch (err: any) {
          console.error('[Server] Failed to persist candle:', err.message);
        } finally {
          dbWriteInProgress = false;
        }
      })();

      // Log every ~10 persist cycles
      if (currentTickCount % (DB_PERSIST_INTERVAL * 10) < DB_PERSIST_INTERVAL) {
        const mem = process.memoryUsage();
        console.log(
          `[Engine] Tick #${currentTickCount} | Price: $${currentPrice.toFixed(2)} | ` +
          `Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB`
        );
      }
    }
  });

  engineReady = true;
  console.log(`[Server] Engine ready — price: $${engine.getPrice().toFixed(2)}`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Server] Shutting down...');
    engine!.stop();
    try {
      await updatePriceState(engine!.getPrice(), seed, engine!.getTickCount());
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
