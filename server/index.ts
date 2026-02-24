import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './config.js';
import { db } from './db/db.js';
import { migrate } from './db/migrate.js';
import { insertCandle } from './db/queries/prices.js';
import { ServerEngine } from './engine/ServerEngine.js';
import { initWebSocket, broadcastCandle, broadcastAnalysis, setCurrentPriceForWS } from './ws/broadcast.js';

import authRoutes from './routes/auth.js';
import pricesRoutes, { setCurrentPrice, setGetCandles } from './routes/prices.js';
import tradingRoutes, { setGetCurrentPrice } from './routes/trading.js';
import userRoutes from './routes/user.js';
import exportRoutes, { setExportEngineRef } from './routes/export.js';
import adminRoutes, { setEngineRef } from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// How often to persist to DB (every 390 ticks = 1 sim "day")
const DB_PERSIST_INTERVAL = 390;

async function main() {
  // 1. Run database migrations (SQLite — always local, no timeout needed)
  try {
    migrate();
  } catch (err: any) {
    console.error(`[Server] DB migration failed: ${err.message}`);
    process.exit(1);
  }

  // 2. Create engine — always fresh start from seed, no replay
  const seed = config.seed;
  const engine = new ServerEngine(seed);
  console.log(`[Server] Fresh start with seed=${seed}`);

  // Wire up current price accessor for trade execution
  setCurrentPrice(engine.getPrice());
  setGetCurrentPrice(() => engine.getPrice());
  // Wire up candle accessor for history endpoint (serves from engine memory)
  setGetCandles((resolution) => engine.getCandles(resolution));
  // Wire up engine ref for admin reset and CSV export
  setEngineRef(engine);
  setExportEngineRef(engine);

  // 3. Set up Express
  const app = express();
  const httpServer = createServer(app);

  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api', authRoutes);
  app.use('/api', pricesRoutes);
  app.use('/api', tradingRoutes);
  app.use('/api', userRoutes);
  app.use('/api', exportRoutes);
  app.use('/api', adminRoutes);

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

  // 4. Initialize WebSocket
  initWebSocket(httpServer);

  // 5. Start listening FIRST so Render detects the port immediately
  httpServer.listen(config.port, '0.0.0.0', () => {
    console.log(`[Server] DiceStock running on port ${config.port}`);
    console.log(`[Server] Engine price: $${engine.getPrice().toFixed(2)}`);
  });

  // 6. Start engine loop — configurable ticks/sec, DB persistence every 390 ticks
  let ticksSinceLastPersist = 0;

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
    broadcastCandle(candle, currentPrice, currentTickCount);

    // Broadcast analysis data at ~5Hz (every 5 ticks) for Analysis page
    if (currentTickCount % 5 === 0) {
      broadcastAnalysis(engine.getAnalysisData());
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

    // Persist candle to DB every 390 ticks
    if (ticksSinceLastPersist >= DB_PERSIST_INTERVAL) {
      try {
        insertCandle(aggOpen, aggHigh, aggLow, aggClose, aggVolume);
      } catch (err: any) {
        console.error('[Server] Failed to persist candle:', err.message);
      }

      // Reset accumulators
      ticksSinceLastPersist = 0;
      aggHigh = -Infinity;
      aggLow = Infinity;
      aggVolume = 0;

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

  // Graceful shutdown
  const shutdown = () => {
    console.log('[Server] Shutting down...');
    engine.stop();
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Server] Fatal error:', err);
  process.exit(1);
});
