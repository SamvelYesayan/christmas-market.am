import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { pool, checkDatabase } from './db.js';
import { expireUnpaidOrders } from './services/orders.js';
import { syncAllPending } from './services/rewards.js';
import { pioneer, checkPioneerConnection } from './integrations/pioneer/index.js';
import { listPaymentMethods } from './integrations/payments/index.js';

const app = createApp();
const server = app.listen(config.PORT, () => {
  logger.info(`🎄 Magical Christmas API listening on :${config.PORT} (${config.NODE_ENV})`);
  logger.info(`Pioneer Card integration: ${pioneer.mode}${pioneer.configured ? '' : ' (not connected)'}`);
  logger.info(`Payment methods: ${listPaymentMethods().map((m) => m.code).join(', ')}`);
  checkDatabase();
  checkPioneerConnection();
});

// Background housekeeping (single instance; move to a scheduler/queue when scaling horizontally).
const timers = [
  setInterval(() => expireUnpaidOrders().catch((err) => logger.error({ err }, 'expire job failed')), 5 * 60_000),
  setInterval(() => syncAllPending().catch((err) => logger.error({ err }, 'pioneer sync job failed')), 10 * 60_000),
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
