-- Connect accounts to the real Magical Pioneer Card system (PIONEER_MODE=magical).
-- Purely additive: no table is dropped, no row is deleted. Existing links (e.g. old development
-- sandbox links) are kept as history and tagged with the provider that created them.

ALTER TABLE pioneer_links
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS holder_name TEXT,
  ADD COLUMN IF NOT EXISTS last_balance INT,
  ADD COLUMN IF NOT EXISTS balance_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS member_since TIMESTAMPTZ,
  -- Cardholder session issued by the Pioneer system after a successful card + CVV check,
  -- encrypted with PIONEER_SESSION_KEY (AES-256-GCM). The CVV itself is never stored.
  ADD COLUMN IF NOT EXISTS upstream_session TEXT,
  ADD COLUMN IF NOT EXISTS upstream_session_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unlinked_at TIMESTAMPTZ;

UPDATE pioneer_links SET provider = CASE WHEN is_sandbox THEN 'sandbox' ELSE 'http' END WHERE provider IS NULL;
ALTER TABLE pioneer_links ALTER COLUMN provider SET DEFAULT 'magical';
ALTER TABLE pioneer_links ALTER COLUMN provider SET NOT NULL;

-- Ownership rules now apply to ACTIVE links only, so link history is kept instead of overwritten:
--   • a card can be actively connected to at most one account,
--   • an account can have at most one active card per provider,
--   • a card that was disconnected can be connected again (after a fresh verification).
ALTER TABLE pioneer_links DROP CONSTRAINT IF EXISTS pioneer_links_external_card_id_is_sandbox_key;
ALTER TABLE pioneer_links DROP CONSTRAINT IF EXISTS pioneer_links_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS pioneer_links_active_card_uq ON pioneer_links (provider, external_card_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS pioneer_links_active_user_uq ON pioneer_links (user_id, provider) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS pioneer_links_user_idx ON pioneer_links (user_id);

-- Append-only log of connection events (customer and admin), for support and security review.
CREATE TABLE IF NOT EXISTS pioneer_link_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  link_id     UUID REFERENCES pioneer_links(id) ON DELETE SET NULL,
  provider    TEXT NOT NULL,
  card_masked TEXT,
  event       TEXT NOT NULL CHECK (event IN ('linked','relinked','refreshed','unlinked','admin_unlinked','verify_failed','rejected_taken')),
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  detail      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pioneer_link_events_user_idx ON pioneer_link_events (user_id, created_at DESC);
