import { z } from 'zod';

const unsetIfEmpty = (schema) => z.preprocess((v) => (v === '' ? undefined : v), schema);
const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: bool.default('false'),
  APP_ORIGIN: z.string().default('http://localhost:5173'),
  PUBLIC_API_URL: z.string().default('http://localhost:4000'),
  SESSION_TTL_DAYS: z.coerce.number().default(30),
  TRUST_PROXY: z.coerce.number().default(0),
  UPLOAD_DIR: z.string().default('uploads'),
  LOG_LEVEL: z.string().default('info'),

  // Payments
  PAYMENTS_TEST_MODE: bool.default('false'),
  IDRAM_REC_ACCOUNT: z.string().optional(),
  IDRAM_SECRET_KEY: z.string().optional(),
  AMERIA_CLIENT_ID: z.string().optional(),
  AMERIA_USERNAME: z.string().optional(),
  AMERIA_PASSWORD: z.string().optional(),
  AMERIA_API_URL: z.string().optional(),
  ARCA_MERCHANT_USER: z.string().optional(),
  ARCA_MERCHANT_PASSWORD: z.string().optional(),
  ARCA_API_URL: z.string().optional(),
  TELCELL_SHOP_ID: z.string().optional(),
  TELCELL_SHOP_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Magical Pioneer Card
  //   disabled → card connection unavailable (no simulation of any kind)
  //   magical  → the real Magical Pioneer Card system (magical-full) at PIONEER_API_BASE_URL
  PIONEER_MODE: z.enum(['disabled', 'magical']).default('disabled'),
  PIONEER_API_BASE_URL: unsetIfEmpty(z.string().url().optional()),
  PIONEER_PORTAL_URL: unsetIfEmpty(z.string().url().optional()), // where cardholders claim Pioneer rewards (default: {base}/pioneer-card)
  PIONEER_API_TIMEOUT_MS: z.coerce.number().default(8000),
  // 64 hex chars (32 bytes). Encrypts the Pioneer cardholder session stored per connected account.
  PIONEER_SESSION_KEY: unsetIfEmpty(z.string().regex(/^[0-9a-fA-F]{64}$/, 'PIONEER_SESSION_KEY must be 64 hex characters').optional()),
  PIONEER_DISCOUNT_PERCENT: z.coerce.number().min(0).max(50).default(5),

  // Advent calendar: override "today" for development/QA only (YYYY-MM-DD). Ignored in production.
  ADVENT_DATE_OVERRIDE: z.string().optional(),
  STORE_TIMEZONE: z.string().default('Asia/Yerevan'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export const isProd = config.NODE_ENV === 'production';

if (config.PIONEER_MODE === 'magical') {
  const missing = ['PIONEER_API_BASE_URL', 'PIONEER_SESSION_KEY'].filter((k) => !config[k]);
  if (missing.length) console.error(`PIONEER_MODE=magical needs ${missing.join(' and ')} — the card connection stays disabled until they are set.`);
  if (isProd && config.PIONEER_API_BASE_URL && !config.PIONEER_API_BASE_URL.startsWith('https://')) {
    console.error('PIONEER_API_BASE_URL must use https:// in production (card verification codes are sent to it).');
    process.exit(1);
  }
}
