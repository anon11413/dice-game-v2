CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  cash          REAL NOT NULL DEFAULT 100.00,
  shares_a      INTEGER NOT NULL DEFAULT 0,
  shares_b      INTEGER NOT NULL DEFAULT 0,
  avg_entry_a   REAL NOT NULL DEFAULT 0,
  avg_entry_b   REAL NOT NULL DEFAULT 0,
  total_cost_a  REAL NOT NULL DEFAULT 0,
  total_cost_b  REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_history (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        TEXT NOT NULL DEFAULT (datetime('now')),
  open      REAL NOT NULL,
  high      REAL NOT NULL,
  low       REAL NOT NULL,
  close     REAL NOT NULL,
  volume    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_price_history_ts ON price_history(ts);

CREATE TABLE IF NOT EXISTS price_state (
  id           INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_price   REAL NOT NULL DEFAULT 100.0,
  last_seed    INTEGER NOT NULL DEFAULT 42,
  tick_count   INTEGER NOT NULL DEFAULT 0,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO price_state (id, last_price, last_seed, tick_count)
VALUES (1, 100.0, 42, 0);

CREATE TABLE IF NOT EXISTS trades (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset     TEXT NOT NULL CHECK (asset IN ('A', 'B')),
  side      TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  quantity  INTEGER NOT NULL CHECK (quantity > 0),
  price     REAL NOT NULL,
  total     REAL NOT NULL,
  ts        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id, ts DESC);
