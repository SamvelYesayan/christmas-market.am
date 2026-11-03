-- Bilingual content (Armenian default, English secondary). Base columns keep English;
-- i18n holds per-locale overlays: {"hy": {"name": "…", …}}.
ALTER TABLE products          ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE product_variants  ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE categories        ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE houses            ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE advent_doors      ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE quiz_questions    ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE wheel_segments    ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE mystery_rewards   ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE challenges        ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE campaigns         ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE banners           ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE christmas_events  ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE pioneer_offers    ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE achievements      ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE hidden_objects    ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE shipping_zones    ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE games             ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE coupons           ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE content_blocks    ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
-- Snapshot of localized names at purchase time
ALTER TABLE order_items       ADD COLUMN i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
-- Remember the language a customer uses (for future emails/notifications)
ALTER TABLE users             ADD COLUMN locale TEXT NOT NULL DEFAULT 'hy' CHECK (locale IN ('hy','en'));
