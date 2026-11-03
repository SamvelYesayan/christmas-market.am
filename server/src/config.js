import { z } from 'zod';

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
  PIONEER_MODE: z.enum(['disabled', 'http', 'sandbox']).default('disabled'),
  PIONEER_API_BASE_URL: z.string().optional(),
  PIONEER_API_KEY: z.string().optional(),
  PIONEER_API_TIMEOUT_MS: z.coerce.number().default(8000),
  PIONEER_PATH_VERIFY: z.string().default('/cards/verify'),
  PIONEER_PATH_BALANCE: z.string().default('/cards/{cardId}/balance'),
  PIONEER_PATH_HISTORY: z.string().default('/cards/{cardId}/transactions'),
  PIONEER_PATH_CREDIT: z.string().default('/cards/{cardId}/credit'),
  PIONEER_PATH_REDEEM: z.string().default('/cards/{cardId}/redeem'),
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

if (isProd && config.PIONEER_MODE === 'sandbox') {
  console.error('PIONEER_MODE=sandbox is not allowed in production.');
  process.exit(1);
}
