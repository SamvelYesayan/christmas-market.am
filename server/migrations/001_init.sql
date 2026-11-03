-- Magical Christmas — initial schema. Money is stored as integer AMD.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ───────────── Identity ─────────────
CREATE TABLE houses (
  id          SERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  motto       TEXT NOT NULL,
  animal      TEXT NOT NULL,
  element     TEXT NOT NULL,
  color       TEXT NOT NULL,
  accent      TEXT NOT NULL,
  virtues     TEXT[] NOT NULL DEFAULT '{}',
  description TEXT NOT NULL
);

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           CITEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL,
  phone           TEXT,
  role            TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  personalization_consent BOOLEAN NOT NULL DEFAULT FALSE,
  is_demo         BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  user_agent  TEXT,
  ip          TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

CREATE TABLE user_profiles (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name  TEXT,
  atmosphere    TEXT,               -- cozy | grand | enchanted | nordic
  preferences   JSONB NOT NULL DEFAULT '{}'::jsonb,
  house_id      INT REFERENCES houses(id),
  identity      JSONB,              -- magical identity (title, wand, familiar, star sign…)
  sorted_at     TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────────── Catalog ─────────────
CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  tagline     TEXT,
  description TEXT,
  art         TEXT NOT NULL DEFAULT 'gift',
  color       TEXT NOT NULL DEFAULT '#c8102e',
  sort        INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  subtitle      TEXT,
  description   TEXT NOT NULL DEFAULT '',
  story         TEXT,
  category_id   INT REFERENCES categories(id) ON DELETE SET NULL,
  price         INT NOT NULL CHECK (price >= 0),
  sale_price    INT CHECK (sale_price IS NULL OR sale_price >= 0),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured   BOOLEAN NOT NULL DEFAULT FALSE,
  is_limited    BOOLEAN NOT NULL DEFAULT FALSE,
  is_magic      BOOLEAN NOT NULL DEFAULT FALSE,
  is_personalizable BOOLEAN NOT NULL DEFAULT FALSE,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  -- gift-finder attributes: recipients, ages, interests, personalities, occasions, atmospheres
  attributes    JSONB NOT NULL DEFAULT '{}'::jsonb,
  art           JSONB NOT NULL DEFAULT '{}'::jsonb,
  sold_count    INT NOT NULL DEFAULT 0,
  is_demo       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON products(category_id);
CREATE INDEX products_tags_idx ON products USING GIN (tags);
CREATE INDEX products_search_idx ON products USING GIN (to_tsvector('simple', name || ' ' || coalesce(subtitle,'') || ' ' || description));

CREATE TABLE product_variants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku         TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  options     JSONB NOT NULL DEFAULT '{}'::jsonb,
  price_delta INT NOT NULL DEFAULT 0,
  stock       INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sort        INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX variants_product_idx ON product_variants(product_id);

CREATE TABLE product_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  alt         TEXT,
  sort        INT NOT NULL DEFAULT 0
);

CREATE TABLE reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  city        TEXT,
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        TEXT NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  is_demo     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────────── Commerce ─────────────
CREATE TABLE wishlists (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE coupons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          CITEXT UNIQUE NOT NULL,
  description   TEXT,
  type          TEXT NOT NULL CHECK (type IN ('percent','fixed','free_shipping')),
  value         INT NOT NULL DEFAULT 0,
  min_subtotal  INT NOT NULL DEFAULT 0,
  max_discount  INT,
  max_uses      INT,
  used_count    INT NOT NULL DEFAULT 0,
  per_user_limit INT NOT NULL DEFAULT 1,
  pioneer_only  BOOLEAN NOT NULL DEFAULT FALSE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,  -- personal reward coupon
  source        TEXT NOT NULL DEFAULT 'admin',                -- admin | advent | game | campaign
  starts_at     TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE carts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash  TEXT UNIQUE,
  user_id     UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  coupon_code CITEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id     UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id  UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity    INT NOT NULL CHECK (quantity > 0 AND quantity <= 50),
  personalization TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cart_id, variant_id, personalization)
);

CREATE TABLE shipping_zones (
  id          SERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  price       INT NOT NULL,
  free_over   INT,
  eta         TEXT,
  requires_address BOOLEAN NOT NULL DEFAULT TRUE,
  sort        INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE SEQUENCE order_number_seq START 1001;

CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number          TEXT UNIQUE NOT NULL,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending_payment'
                  CHECK (status IN ('pending_payment','confirmed','processing','shipped','delivered','cancelled','refunded')),
  payment_status  TEXT NOT NULL DEFAULT 'unpaid'
                  CHECK (payment_status IN ('unpaid','pending','paid','failed','refunded','cod')),
  payment_method  TEXT NOT NULL,
  is_test         BOOLEAN NOT NULL DEFAULT FALSE,
  currency        TEXT NOT NULL DEFAULT 'AMD',
  subtotal        INT NOT NULL,
  discount        INT NOT NULL DEFAULT 0,
  pioneer_discount INT NOT NULL DEFAULT 0,
  shipping        INT NOT NULL DEFAULT 0,
  total           INT NOT NULL,
  coupon_code     CITEXT,
  customer        JSONB NOT NULL,
  delivery        JSONB NOT NULL,
  gift_message    TEXT,
  tracking_code   TEXT,
  is_demo         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_idx ON orders(user_id);
CREATE INDEX orders_created_idx ON orders(created_at DESC);

CREATE TABLE order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE SET NULL,
  variant_id  UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  variant_name TEXT,
  sku         TEXT,
  unit_price  INT NOT NULL,
  quantity    INT NOT NULL,
  total       INT NOT NULL,
  personalization TEXT
);

CREATE TABLE order_status_history (
  id          BIGSERIAL PRIMARY KEY,
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  note        TEXT,
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE coupon_redemptions (
  id          BIGSERIAL PRIMARY KEY,
  coupon_id   UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  order_id    UUID REFERENCES orders(id) ON DELETE CASCADE,
  email       CITEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  provider_ref  TEXT,
  amount        INT NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'AMD',
  status        TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','pending','succeeded','failed','cancelled','refunded')),
  is_test       BOOLEAN NOT NULL DEFAULT FALSE,
  raw           JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payments_order_idx ON payments(order_id);

-- ───────────── Pioneer Card ─────────────
CREATE TABLE pioneer_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_card_id TEXT NOT NULL,
  card_masked   TEXT NOT NULL,
  tier          TEXT,
  is_sandbox    BOOLEAN NOT NULL DEFAULT FALSE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','unlinked')),
  linked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  UNIQUE (external_card_id, is_sandbox)
);

CREATE TABLE pioneer_offers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  kind          TEXT NOT NULL CHECK (kind IN ('redeem_gift','discount','exclusive_product')),
  points_cost   INT,
  discount_percent INT,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  min_tier      TEXT,
  stock         INT,
  starts_at     TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pioneer_redemptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id      UUID NOT NULL REFERENCES pioneer_offers(id) ON DELETE CASCADE,
  points        INT NOT NULL,
  reference     TEXT UNIQUE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  coupon_id     UUID REFERENCES coupons(id),
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────────── Experiences & rewards ─────────────
CREATE TABLE reward_rules (
  key         TEXT PRIMARY KEY,         -- e.g. game:catch, game:quiz, hidden, challenge
  config      JSONB NOT NULL,           -- {points_per_score, max_points_per_day, coupon:{…}, …}
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reward_grants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source        TEXT NOT NULL,          -- advent | game:<id> | wheel | mystery | hidden | challenge | sorting
  source_ref    TEXT NOT NULL,          -- idempotency key, unique per user
  kind          TEXT NOT NULL CHECK (kind IN ('points','coupon','badge','product','message')),
  title         TEXT NOT NULL,
  points        INT NOT NULL DEFAULT 0,
  coupon_id     UUID REFERENCES coupons(id) ON DELETE SET NULL,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  pioneer_sync_status TEXT NOT NULL DEFAULT 'not_applicable'
                CHECK (pioneer_sync_status IN ('not_applicable','pending','synced','failed','no_card')),
  pioneer_error TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, source_ref)
);
CREATE INDEX reward_grants_user_idx ON reward_grants(user_id, created_at DESC);

CREATE TABLE advent_doors (
  id          SERIAL PRIMARY KEY,
  year        INT NOT NULL,
  day         INT NOT NULL CHECK (day BETWEEN 1 AND 24),
  title       TEXT NOT NULL,
  teaser      TEXT,
  kind        TEXT NOT NULL CHECK (kind IN ('coupon','points','product','gift','minigame','challenge','story')),
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  art         TEXT NOT NULL DEFAULT 'star',
  is_demo     BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (year, day)
);

CREATE TABLE advent_openings (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  door_id     INT NOT NULL REFERENCES advent_doors(id) ON DELETE CASCADE,
  opened_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, door_id)
);

CREATE TABLE games (
  key         TEXT PRIMARY KEY,         -- catch | tree | mystery | quiz | hidden | wheel
  title       TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  config      JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort        INT NOT NULL DEFAULT 0
);

CREATE TABLE game_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_key    TEXT NOT NULL REFERENCES games(key),
  seed        INT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  score       INT,
  accepted_score INT,
  state       JSONB NOT NULL DEFAULT '{}'::jsonb,
  flagged     BOOLEAN NOT NULL DEFAULT FALSE,
  flag_reason TEXT
);
CREATE INDEX game_sessions_user_idx ON game_sessions(user_id, game_key, started_at DESC);

CREATE TABLE quiz_questions (
  id          SERIAL PRIMARY KEY,
  question    TEXT NOT NULL,
  options     JSONB NOT NULL,           -- ["a","b","c","d"]
  answer_index INT NOT NULL,
  fun_fact    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE wheel_segments (
  id          SERIAL PRIMARY KEY,
  label       TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('points','coupon','message')),
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  weight      INT NOT NULL DEFAULT 1 CHECK (weight >= 0),
  color       TEXT NOT NULL DEFAULT '#c8102e',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE mystery_rewards (
  id          SERIAL PRIMARY KEY,
  label       TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('points','coupon','message')),
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  weight      INT NOT NULL DEFAULT 1,
  rarity      TEXT NOT NULL DEFAULT 'common',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE hidden_objects (
  key         TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  hint        TEXT NOT NULL,
  location    TEXT NOT NULL,            -- route where it is hidden
  points      INT NOT NULL DEFAULT 10,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE hidden_finds (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key  TEXT NOT NULL REFERENCES hidden_objects(key) ON DELETE CASCADE,
  found_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, object_key)
);

CREATE TABLE challenges (
  id          SERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('open_advent','play_game','wishlist_count','quiz_score','find_hidden','visit_academy')),
  target      JSONB NOT NULL DEFAULT '{}'::jsonb,
  reward_points INT NOT NULL DEFAULT 0,
  reward_coupon JSONB,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo     BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX challenges_date_idx ON challenges(date);

CREATE TABLE challenge_completions (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id  INT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, challenge_id)
);

CREATE TABLE achievements (
  key         TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT 'star'
);

CREATE TABLE user_achievements (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL REFERENCES achievements(key) ON DELETE CASCADE,
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_key)
);

-- ───────────── Marketing & content ─────────────
CREATE TABLE campaigns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  headline      TEXT NOT NULL,
  body          TEXT,
  coupon_code   CITEXT,
  pioneer_only  BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at     TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ,
  art           TEXT NOT NULL DEFAULT 'gift',
  color         TEXT NOT NULL DEFAULT '#c8102e',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE banners (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement   TEXT NOT NULL DEFAULT 'home_ribbon',
  title       TEXT NOT NULL,
  subtitle    TEXT,
  cta_label   TEXT,
  cta_link    TEXT,
  image_url   TEXT,
  art         TEXT,
  sort        INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE content_blocks (
  key         TEXT PRIMARY KEY,
  data        JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE christmas_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  location    TEXT,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE newsletter_subscribers (
  email       CITEXT PRIMARY KEY,
  name        TEXT,
  consent_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ
);

-- ───────────── Ops ─────────────
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE analytics_events (
  id          BIGSERIAL PRIMARY KEY,
  visitor_id  TEXT NOT NULL,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  type        TEXT NOT NULL,   -- visit | product_view | add_to_cart | checkout_start | purchase
  ref         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX analytics_type_time_idx ON analytics_events(type, created_at);
