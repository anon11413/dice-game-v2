CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  cash          NUMERIC(12, 2) NOT NULL DEFAULT 100.00,
  shares_a      INTEGER NOT NULL DEFAULT 0,
  shares_b      INTEGER NOT NULL DEFAULT 0,
  avg_entry_a   NUMERIC(12, 4) NOT NULL DEFAULT 0,
  avg_entry_b   NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total_cost_a  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_cost_b  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_history (
  id        SERIAL PRIMARY KEY,
  ts        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  open      NUMERIC(12, 4) NOT NULL,
  high      NUMERIC(12, 4) NOT NULL,
  low       NUMERIC(12, 4) NOT NULL,
  close     NUMERIC(12, 4) NOT NULL,
  volume    BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_price_history_ts ON price_history(ts);

CREATE TABLE IF NOT EXISTS price_state (
  id           INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_price   NUMERIC(12, 4) NOT NULL DEFAULT 100.0,
  last_seed    INTEGER NOT NULL DEFAULT 42,
  tick_count   INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO price_state (last_price, last_seed, tick_count)
VALUES (100.0, 42, 0)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS trades (
  id        SERIAL PRIMARY KEY,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset     CHAR(1) NOT NULL CHECK (asset IN ('A', 'B')),
  side      VARCHAR(4) NOT NULL CHECK (side IN ('BUY', 'SELL')),
  quantity  INTEGER NOT NULL CHECK (quantity > 0),
  price     NUMERIC(12, 4) NOT NULL,
  total     NUMERIC(14, 2) NOT NULL,
  ts        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id, ts DESC);
