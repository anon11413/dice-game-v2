# Research → Production Migration Notes

## What Was Migrated

The DiceStock simulation engine was developed and tuned in an isolated research project (`dice-game-research-v2`) — a stripped-down copy with no auth, no database, and dev-only routing. Once the engine achieved 9/10 stylized facts, the new features needed to be ported back into the production project (`dice-game-v2`) which has player auth, PostgreSQL, Express API routes, WebSocket broadcasting, and Render deployment.

### Key features ported:
- Bands 11-12 (trend/OU process, support/resistance)
- Grid expansion 100→120 rows (12 bands instead of 10)
- PRICE_SCALE=30 compression across all bands
- SENTIMENT_DECAY 0.80→0.92
- SI_INIT 500K→4M, SQUEEZE_COVER_RATE 0.08→0.0005
- Value agent redesign (3-tier passive limits)
- 9 time-based resolutions replacing old tick-based ones
- CandleAggregator with tickToTimestamp and MAX_CANDLES=10K
- Price scaling infrastructure in stores

---

## Strategy

### What worked
- **Copy engine files wholesale** — `src/engine/` is pure simulation logic with no production dependencies. Safe to overwrite entirely.
- **Copy UI components that only consume engine data** — Chart components, analysis panels, and stores that just read engine output are safe to copy.
- **Preserve production-only infrastructure** — Auth, routing, DB, API routes, landing page, player shell — none of these exist in research, so don't touch them.

### What to NEVER copy blindly
- **Bridge files** (`ServerBridge.ts`) — Production has server-specific logic (REST + WebSocket) that research doesn't have. Must be manually merged.
- **Server files** (`broadcast.ts`, `index.ts`) — Production has DB persistence, auth middleware, and broadcasting that research lacks.

---

## Step-by-Step Process (What We Actually Did)

1. **Identified safe-to-copy files** — Engine core, bands, aggregation, history, orderbook, dice, stores, chart/analysis UI
2. **Copied ~30 files** from research to production
3. **Manually edited** files that needed merging (ServerBridge, server config)
4. **Built** (`npm run build`) after each batch to catch compile errors
5. **Deployed** to Render, hit runtime errors, fixed, redeployed
6. **Ran comprehensive diff** between all files to find remaining gaps
7. **Fixed stragglers** one by one until diff was clean

---

## Issues Encountered (Chronological)

### 1. Server Crash: `Cannot read properties of undefined (reading 'colMeans')`

**What happened:** After deploying the new 12-band engine, the server crashed immediately on the first tick.

**Root cause:** `src/engine/dice/bandStats.ts` was NOT copied from research. The production version hardcoded `new Array(10)` and `for (let b = 0; b < 10; b++)` — only computing stats for 10 bands. With the new 120-row grid (12 bands), `Engine.ts` accessed `stats[10]` (Band 11) which was `undefined`.

**Fix:** Copy `bandStats.ts` from research. The research version dynamically computes band count: `Math.floor(grid.length / (BAND_ROWS * GRID_COLS))`.

**Lesson:** When you add new bands/rows to the grid, EVERY file that iterates over bands needs to be updated. `bandStats.ts` was easy to miss because it's a utility file, not a band file.

---

### 2. Broken Resolution Selector (13 files with stale constants)

**What happened:** Resolution buttons on the chart page didn't work. Clicking 1m, 5m, 1h, etc. did nothing.

**Root cause:** The old `RESOLUTIONS` constants (`TICK=1`, `HOURLY=13`, `DAILY=65`, `WEEKLY=325`) were removed from `constants.ts` and replaced with new time-based ones (`ONE_SEC=5`, `ONE_MIN=325`, etc.). But 13 files still referenced the old names — `RESOLUTIONS.TICK`, `RESOLUTIONS.HOURLY`, etc. — which were all `undefined`.

**Files affected:**
- `ServerBridge.ts`, `ChartPage.tsx`
- 3 overview components, 4 technical components, 4 quant components

**Fix:** Copy all 13 files from research, which had the correct new constant references.

**Lesson:** When renaming exported constants, grep the ENTIRE codebase for the old names before deploying. `RESOLUTIONS.TICK` appeared in UI files far from the engine.

---

### 3. Engine Speed Default

**What happened:** The simulation was running at 25% speed instead of max.

**Root cause:** `server/config.ts` had `ENGINE_SPEED_PCT` defaulting to `'25'`. Research used `'100'`.

**Fix:** One-line edit: `'25'` → `'100'`.

**Lesson:** Check config defaults — they're easy to forget because they're not in the engine code itself.

---

### 4. "Value is null" Chart Crash (The Big One)

**What happened:** After deploying, the chart page showed nothing and the console was flooded with hundreds of `"Value is null"` errors from lightweight-charts' internal Candlestick and Histogram renderers. Every single tick produced a crash.

**Root cause:** A timestamp/tick-count mismatch in the data pipeline.

The `CandleAggregator.addTick()` method uses `tick % resolution === 0` to determine candle boundaries. It expects raw sequential tick counts (0, 1, 2, 3, ...). But `ServerBridge` was feeding it `data.time` — a Unix timestamp from the WebSocket.

The problem: `tickToTimestamp()` maps every 5 consecutive ticks to the same second. Ticks 0-4 all produce timestamp `946684800`. So `946684800 % 325 === 0` evaluates to `true` for EVERY tick in that group, creating a new candle each time. Multiple candles with identical timestamps crash lightweight-charts, which requires strictly increasing time values.

**The fix required 3 files:**

1. `server/ws/broadcast.ts` — Added a `tickCount` field to CANDLE WebSocket events. Also fixed the initial connection message which was sending raw tick count as `time` instead of a timestamp.

2. `server/index.ts` — Pass `currentTickCount` to `broadcastCandle()`.

3. `src/bridge/ServerBridge.ts` — Use `data.time` (timestamp) for history dedup, use `data.tickCount` (raw count) for the CandleAggregator.

**Lesson:** When two systems use different representations of "time" (tick counts vs Unix timestamps), you MUST be explicit about which one flows where. The research project didn't have this problem because the dev-mode worker sends raw tick counts directly — no timestamp conversion in the middle.

---

### 5. Simulation Behavior Mismatch (band6-marketMakers.ts)

**What happened:** After all the above fixes, the simulation was running but the price/stock behavior looked noticeably different from research. The user noticed it.

**Root cause:** `src/engine/bands/band6-marketMakers.ts` was NEVER copied from research. Two critical differences:

- **Line 27:** Missing `/ config.PRICE_SCALE` on the halfSpread calculation. Production computed `halfSpread = P_t * baseSpreadPct * spreadFactor` without dividing by PRICE_SCALE (30). Result: **market maker spreads were 30x wider** than research.

- **Lines 54-56:** Panic withdrawal was more aggressive — `depth * 0.2` vs `0.4`, `halfSpread *= 3.0` vs `2.5`, `numLevels = 5` vs `10`.

**Fix:** Copy the file from research.

**Lesson:** The market maker band is the MOST sensitive band for price dynamics. It refreshes every single tick, provides all resting liquidity, and determines the bid-ask spread. A 30x spread difference changes everything about how the simulation behaves. This was the hardest bug to find because it didn't cause a crash — just subtly wrong behavior.

---

### 6. directionalAgent.ts Also Missing PRICE_SCALE

**What happened:** Found during a comprehensive 81-file diff between research and production.

**Root cause:** `src/engine/bands/directionalAgent.ts` line 83 was missing `/ config.PRICE_SCALE` on the limit order offset calculation. This meant limit orders for bands 1-3, 7-10, and 11-12 (all bands using the directional agent) were placed **30x further from the current price** than in research.

**Fix:** Add `/ config.PRICE_SCALE` to the offset calc.

**Lesson:** When a new constant like `PRICE_SCALE` is introduced, you have to check EVERY file that computes price offsets. It's not just the band files — it's also shared utilities like `directionalAgent.ts`.

---

### 7. SET_PRICE_SCALE Message Pathway Not Ported

**What happened:** Also found during the comprehensive diff. Three files had a `SET_PRICE_SCALE` feature in research that was missing in production:

- `src/engine/worker.ts` — Missing the `case 'SET_PRICE_SCALE'` handler
- `src/bridge/messages.ts` — Missing the type in the `WorkerCommand` union
- `src/bridge/useSimulation.ts` — Missing the `setPriceScale` callback

**Fix:** Add the missing code to all three files.

**Lesson:** Message-passing pathways span multiple files (worker handler, type definition, hook callback). If you port the engine feature but not the message pathway, the feature exists but can't be used at runtime.

---

### 8. Cold Start Performance (tsx → esbuild)

**What happened:** The Render free-tier site took ~10 minutes to cold start after sleeping.

**Root cause:** The start command was `tsx server/index.ts`, which meant every cold start had to transpile 14 TypeScript server files PLUS the entire `src/engine/` tree at runtime. On Render's free-tier hardware, this was extremely slow.

**Fix:** Added an esbuild step to the build command that bundles the entire server into a single 62KB JavaScript file (`dist-server/index.mjs`). The start command became `node dist-server/index.mjs` — no transpilation needed.

Also moved `tsx` from `dependencies` to `devDependencies` since it's only needed for local development (`dev:server`).

**Lesson:** Never use a TypeScript runtime transpiler (`tsx`, `ts-node`) in production. Pre-compile during the build step. esbuild is already available via Vite and can bundle the server in <1 second.

---

## Tips for Next Time

### Before starting
1. **Run a full diff FIRST** — Before copying anything, run `diff -rq research/src/engine production/src/engine` to see ALL differences. Don't start copying until you understand the full scope.
2. **List the files that should NOT be copied** — Identify production-only files (auth, routes, DB, config) upfront and mark them as off-limits.

### During migration
3. **Copy in layers** — Engine core first, then bands, then aggregation, then stores, then UI. Build after each layer.
4. **Grep for removed/renamed exports** — When you delete or rename something in `constants.ts`, immediately grep the entire project for the old name.
5. **Check shared utilities** — Files like `directionalAgent.ts`, `bandStats.ts`, and `worker.ts` are used by many bands. They're easy to miss.
6. **Watch for PRICE_SCALE** — Any file that computes a price offset needs to divide by PRICE_SCALE. Search for `state.P_t *` to find them all.

### After migration
7. **Run a comprehensive diff of ALL files** — Not just the ones you think you changed. The comprehensive 81-file diff at the end is what found `directionalAgent.ts` and the `SET_PRICE_SCALE` pathway.
8. **Test the server locally** — Run `npm start` and check the console for crashes before deploying. The `bandStats.ts` crash would have been caught instantly.
9. **Check both dev mode AND server mode** — The chart crash only happened in server mode because the data pipeline is different (WebSocket timestamps vs direct tick counts).

### Production-specific
10. **Pre-compile the server** — Use esbuild to bundle server TS → JS during build. Never transpile at runtime in production.
11. **Keep tsx in devDependencies** — It's a development tool, not a production dependency.
12. **Test cold start** — After changing the start command, verify locally with `node dist-server/index.mjs` before deploying.
