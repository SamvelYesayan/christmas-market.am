-- Christmas Calendar: 31 Days of Gifts (1–31 December, Asia/Yerevan).
-- Additive only: reuses advent_doors (one row per day) and advent_openings (one claim per customer per day).
-- Existing doors and openings are kept untouched; only new columns, constraints and guards are added.

-- 1. Days 25–31 are now valid (31 December is the Grand Prize).
ALTER TABLE advent_doors DROP CONSTRAINT IF EXISTS advent_doors_day_check;
ALTER TABLE advent_doors ADD CONSTRAINT advent_doors_day_check CHECK (day BETWEEN 1 AND 31);

-- 2. Gift presentation and availability, managed from the admin panel.
ALTER TABLE advent_doors
  ADD COLUMN IF NOT EXISTS description  TEXT,
  ADD COLUMN IF NOT EXISTS image_url    TEXT,
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS max_claims   INT CHECK (max_claims IS NULL OR max_claims > 0),
  ADD COLUMN IF NOT EXISTS options      JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{key,title,description,image_url,kind,payload}]
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3. Claims record the store-local day they were made on and what was received.
ALTER TABLE advent_openings
  ADD COLUMN IF NOT EXISTS claimed_on DATE,          -- Asia/Yerevan calendar date of the claim, set by the server
  ADD COLUMN IF NOT EXISTS option_key TEXT,          -- the gift option the customer chose (when the day offers a choice)
  ADD COLUMN IF NOT EXISTS outcome    TEXT CHECK (outcome IS NULL OR outcome IN ('gift', 'check_in', 'sold_out', 'grand_entry'));

-- Openings made before this migration: record the local day they actually happened on (new column only).
-- A claim only counts toward the Grand Prize when it was made on its own day, so early/late test openings never count.
UPDATE advent_openings SET claimed_on = (opened_at AT TIME ZONE 'Asia/Yerevan')::date WHERE claimed_on IS NULL;

CREATE INDEX IF NOT EXISTS advent_openings_door_idx ON advent_openings (door_id, opened_at);

-- 4. Database guards (the API enforces the same rules; these make them impossible to bypass):
--    • a claim is permanent (no UPDATE),
--    • a new claim must be dated on its own calendar day,
--    • a 31 December claim requires valid claims for every day 1–30.
CREATE OR REPLACE FUNCTION advent_claim_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  d RECORD;
  n INT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'calendar claims are permanent and cannot be changed' USING ERRCODE = 'check_violation';
  END IF;
  SELECT year, day INTO d FROM advent_doors WHERE id = NEW.door_id;
  IF NEW.claimed_on IS NULL OR NEW.claimed_on <> make_date(d.year, 12, d.day) THEN
    RAISE EXCEPTION 'a calendar gift can only be claimed on its own day' USING ERRCODE = 'check_violation';
  END IF;
  IF d.day = 31 THEN
    SELECT count(*) INTO n FROM advent_openings ao JOIN advent_doors x ON x.id = ao.door_id
     WHERE ao.user_id = NEW.user_id AND x.year = d.year AND x.day BETWEEN 1 AND 30
       AND ao.claimed_on = make_date(x.year, 12, x.day);
    IF n < 30 THEN
      RAISE EXCEPTION 'not eligible for the grand prize' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS advent_claim_guard ON advent_openings;
CREATE TRIGGER advent_claim_guard BEFORE INSERT OR UPDATE ON advent_openings
  FOR EACH ROW EXECUTE FUNCTION advent_claim_guard();

--    • a day that already has claims cannot be moved to another date or deleted (that would rewrite history).
--      Demo doors stay deletable so `npm run seed:demo -- --clean` keeps working in development.
CREATE OR REPLACE FUNCTION advent_door_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_demo AND TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  IF (TG_OP = 'DELETE' OR NEW.year <> OLD.year OR NEW.day <> OLD.day)
     AND EXISTS (SELECT 1 FROM advent_openings WHERE door_id = OLD.id) THEN
    RAISE EXCEPTION 'this calendar day already has claims and cannot be moved or deleted' USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS advent_door_guard ON advent_doors;
CREATE TRIGGER advent_door_guard BEFORE UPDATE OR DELETE ON advent_doors
  FOR EACH ROW EXECUTE FUNCTION advent_door_guard();
