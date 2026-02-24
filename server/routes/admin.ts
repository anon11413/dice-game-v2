import { Router } from 'express';
import { db } from '../db/db.js';
import { config } from '../config.js';
import type { ServerEngine } from '../engine/ServerEngine.js';

let engineRef: ServerEngine | null = null;

export function setEngineRef(engine: ServerEngine): void {
  engineRef = engine;
}

const router = Router();

// Reset simulation — wipe price history and reset engine state
// Protected by DEV_PIN
router.post('/admin/reset-sim', (req, res) => {
  try {
    const { pin } = req.body;

    if (pin !== config.devPin) {
      res.status(403).json({ error: 'Invalid PIN' });
      return;
    }

    if (!engineRef) {
      res.status(503).json({ error: 'Engine not ready' });
      return;
    }

    // Stop the engine
    engineRef.stop();

    // Wipe DB tables
    const resetDb = db.transaction(() => {
      db.prepare('DELETE FROM price_history').run();
      db.prepare(
        `UPDATE price_state SET
          last_price = 100.0,
          last_seed = ?,
          tick_count = 0,
          last_updated = datetime('now')
        WHERE id = 1`
      ).run(config.seed);
    });
    resetDb();

    console.log(`[Admin] Simulation reset — seed=${config.seed}`);
    res.json({
      message: 'Simulation reset. Restart the server to begin fresh.',
      seed: config.seed,
    });

    // Exit so start.sh or process manager restarts fresh
    setTimeout(() => process.exit(0), 500);
  } catch (err: any) {
    console.error('[Admin] Reset error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
