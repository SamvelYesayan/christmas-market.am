-- Pioneer points through Magical (POST /points/credit and /points/debit). Additive only.
-- Magical is the single source of truth for the balance: these rows record what the store ASKED Magical to do,
-- with the stable reference + idempotency key used for every retry, and what Magical answered.
-- No balance is kept here (balance_after is the value Magical reported for that one ledger row).

CREATE TABLE IF NOT EXISTS pioneer_point_operations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_id        TEXT NOT NULL,                       -- the customer id Magical knows (the store user id)
  kind               TEXT NOT NULL CHECK (kind IN ('credit', 'debit')),
  points             INT  NOT NULL CHECK (points BETWEEN 1 AND 1000000),
  reference          TEXT NOT NULL UNIQUE CHECK (reference ~ '^[A-Za-z0-9._:-]{3,100}$'),
  idempotency_key    TEXT NOT NULL UNIQUE CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{8,200}$'),
  reason             TEXT NOT NULL CHECK (reason ~ '^[a-z][a-z0-9_]{1,39}$'),
  description        TEXT CHECK (description IS NULL OR length(description) <= 200),
  source             TEXT NOT NULL CHECK (source IN ('game_reward', 'gift_redemption')),
  grant_id           UUID UNIQUE REFERENCES reward_grants(id) ON DELETE SET NULL,   -- one credit per game reward
  redemption_id      UUID UNIQUE REFERENCES pioneer_redemptions(id) ON DELETE SET NULL, -- one debit per redemption
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'needs_reconciliation')),
  attempts           INT  NOT NULL DEFAULT 0,
  lease_until        TIMESTAMPTZ,                         -- a worker owns the operation until then
  next_attempt_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error_code    TEXT,
  magical_transaction_id TEXT,
  magical_type       TEXT,
  balance_after      INT,
  magical_created_at TIMESTAMPTZ,
  replayed           BOOLEAN NOT NULL DEFAULT FALSE,      -- Magical answered with Idempotent-Replayed: true
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS pioneer_point_ops_user_idx ON pioneer_point_operations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pioneer_point_ops_open_idx ON pioneer_point_operations (next_attempt_at)
  WHERE status IN ('pending', 'processing', 'needs_reconciliation');

-- A succeeded operation is final: its Magical transaction can never be changed or "un-succeeded".
CREATE OR REPLACE FUNCTION pioneer_point_ops_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'succeeded' AND (NEW.status <> 'succeeded' OR NEW.magical_transaction_id IS DISTINCT FROM OLD.magical_transaction_id
      OR NEW.points <> OLD.points OR NEW.reference <> OLD.reference OR NEW.idempotency_key <> OLD.idempotency_key) THEN
    RAISE EXCEPTION 'a confirmed Pioneer points operation cannot be changed' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.points <> OLD.points OR NEW.reference <> OLD.reference OR NEW.idempotency_key <> OLD.idempotency_key
     OR NEW.kind <> OLD.kind OR NEW.customer_id <> OLD.customer_id THEN
    RAISE EXCEPTION 'the request sent to Magical cannot be changed (it would break idempotent retries)' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pioneer_point_ops_guard ON pioneer_point_operations;
CREATE TRIGGER pioneer_point_ops_guard BEFORE UPDATE ON pioneer_point_operations
  FOR EACH ROW EXECUTE FUNCTION pioneer_point_ops_guard();

-- Gift redemptions (existing table, still empty): richer lifecycle and duplicate-click protection.
ALTER TABLE pioneer_redemptions DROP CONSTRAINT IF EXISTS pioneer_redemptions_status_check;
ALTER TABLE pioneer_redemptions ADD CONSTRAINT pioneer_redemptions_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'needs_reconciliation'));
ALTER TABLE pioneer_redemptions
  ADD COLUMN IF NOT EXISTS client_token   TEXT,            -- one per confirm dialog: repeated clicks reuse it
  ADD COLUMN IF NOT EXISTS product_id     UUID REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title          TEXT,
  ADD COLUMN IF NOT EXISTS stock_reserved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fulfilment     TEXT CHECK (fulfilment IS NULL OR fulfilment IN ('coupon', 'awaiting_handover', 'handed_over')),
  ADD COLUMN IF NOT EXISTS completed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS pioneer_redemptions_client_token_uq ON pioneer_redemptions (user_id, client_token) WHERE client_token IS NOT NULL;
-- At most one unfinished redemption per customer at a time (blocks concurrent double-spends before Magical is even asked).
-- Only redemptions made by this flow (they always carry a client_token) are covered, so older rows — e.g. pending
-- redemptions left from the sandbox era — can never make this migration fail.
CREATE UNIQUE INDEX IF NOT EXISTS pioneer_redemptions_one_open_uq ON pioneer_redemptions (user_id)
  WHERE client_token IS NOT NULL AND status IN ('pending', 'processing', 'needs_reconciliation');

-- Game rewards: new sync states for the Magical credit (existing values kept).
ALTER TABLE reward_grants DROP CONSTRAINT IF EXISTS reward_grants_pioneer_sync_status_check;
ALTER TABLE reward_grants ADD CONSTRAINT reward_grants_pioneer_sync_status_check
  CHECK (pioneer_sync_status IN ('not_applicable', 'pending', 'synced', 'failed', 'no_card', 'needs_reconciliation'));
