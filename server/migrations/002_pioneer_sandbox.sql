-- Ledger used ONLY by the development sandbox Pioneer adapter (PIONEER_MODE=sandbox).
-- The production adapter never reads or writes this table.
CREATE TABLE pioneer_sandbox_ledger (
  id          BIGSERIAL PRIMARY KEY,
  card_id     TEXT NOT NULL,
  points      INT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('opening','credit','redeem')),
  reference   TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pioneer_sandbox_ledger_card_idx ON pioneer_sandbox_ledger(card_id);
