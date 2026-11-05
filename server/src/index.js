import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { adventOverrideActive, storeToday } from './lib/time.js';
import { pool, checkDatabase } from './db.js';
import { expireUnpaidOrders } from './services/orders.js';
import { syncAllPending } from './services/rewards.js';
import { pioneer, checkPioneerConnection, pointsPolicyNow } from './integrations/pioneer/index.js';
import { listPaymentMethods } from './integrations/payments/index.js';

const app = createApp();
const server = app.listen(config.PORT, () => {
  logger.info(`🎄 Magical Christmas API listening on :${config.PORT} (${config.NODE_ENV})`);
  logger.info(`Pioneer Card integration: ${pioneer.mode}${pioneer.configured ? '' : ' (not connected)'}`);
  if (pointsPolicyNow.allowed) logger.info(`Pioneer points: enabled (${pointsPolicyNow.reason}).`);
  else logger.warn(`Pioneer points: BLOCKED on this server (${pointsPolicyNow.reason}). No credit or debit is ever sent from here; queued operations are left untouched. Development servers send points only to a local Magical (npm run magical:mock).`);
  if (adventOverrideActive()) logger.warn(`Christmas Calendar date override is ON: pretending today is ${config.ADVENT_DATE_OVERRIDE} (real ${config.STORE_TIMEZONE} date: ${storeToday()}). Remove ADVENT_DATE_OVERRIDE from .env to use the real date.`);
  logger.info(`Payment methods: ${listPaymentMethods().map((m) => m.code).join(', ')}`);
  checkDatabase();
  checkPioneerConnection();
});

// Background housekeeping (single instance; move to a scheduler/queue when scaling horizontally).
const timers = [
  setInterval(() => expireUnpaidOrders().catch((err) => logger.error({ err }, 'expire job failed')), 5 * 60_000),
  // Pioneer points: resend queued credits and settle unknown outcomes with their original idempotency keys.
  setInterval(() => syncAllPending().catch((err) => logger.error({ err: err.message }, 'pioneer points reconciliation failed')), 60_000),
  // Re-read the key's scopes (picks up points:credit / points:debit once Magical grants them, and recovers from a failed startup check).
  setInterval(() => checkPioneerConnection().catch(() => {}), 15 * 60_000),
  setInterval(() => pool.query('DELETE FROM sessions WHERE expires_at < now()').catch(() => {}), 60 * 60_000),
];

function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  timers.forEach(clearInterval);
  server.close(() => pool.end().then(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandled rejection'));
