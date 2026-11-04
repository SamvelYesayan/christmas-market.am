-- Christmas Wishes Wall (Ամանորյա բարեմաղթանքներ): visitors leave New Year wishes, staff approve them,
-- approved wishes travel across the homepage. Purely additive: one new table, nothing else is touched.
-- Rollback (removes only the wishes): DROP TABLE christmas_wishes;

CREATE TABLE IF NOT EXISTS christmas_wishes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name    TEXT NOT NULL CHECK (char_length(author_name) BETWEEN 2 AND 60),
  recipient_name TEXT CHECK (recipient_name IS NULL OR char_length(recipient_name) BETWEEN 1 AND 60),
  message        TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 400),
  category       TEXT CHECK (category IS NULL OR category IN ('family','friends','love','health','success','peace','everyone')),
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  locale         TEXT NOT NULL DEFAULT 'hy' CHECK (locale IN ('hy','en')),
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,  -- set when a signed-in visitor wrote it
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at    TIMESTAMPTZ,
  moderated_by   UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Public wall: random/recent approved wishes. Admin: filter by status/category, newest first.
CREATE INDEX IF NOT EXISTS christmas_wishes_public_idx ON christmas_wishes (approved_at DESC) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS christmas_wishes_status_idx ON christmas_wishes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS christmas_wishes_category_idx ON christmas_wishes (category, created_at DESC);
-- Duplicate-submission check (same text within a day).
CREATE INDEX IF NOT EXISTS christmas_wishes_dupe_idx ON christmas_wishes (md5(lower(message)), created_at DESC);
