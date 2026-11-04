import pg from 'pg';
import { config } from './config.js';
import { logger } from './lib/logger.js';

// Return BIGINT/NUMERIC aggregates as JS numbers (all money values fit safely).
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  max: 15,
  connectionTimeoutMillis: 5000, // fail fast instead of hanging requests when the database is unreachable
});

pool.on('error', (err) => logger.error({ err }, 'postgres pool error'));

export const query = (text, params) => pool.query(text, params);

// Errors meaning "the database cannot be reached / is not accepting connections" (as opposed to a bad query).
const UNAVAILABLE_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH',
  '57P01', '57P02', '57P03', '53300', '08000', '08001', '08003', '08004', '08006', '28000', '28P01', '3D000']);
export function isDbUnavailable(err) {
  if (!err) return false;
  if (UNAVAILABLE_CODES.has(err.code)) return true;
  if (Array.isArray(err.errors) && err.errors.some(isDbUnavailable)) return true; // AggregateError (IPv4 + IPv6 attempts)
  return /timeout exceeded when trying to connect|Connection terminated/i.test(err.message ?? '');
}

/** Where DATABASE_URL points (no credentials), for log messages. */
export function dbTarget() {
  try { const u = new URL(config.DATABASE_URL); return `${u.hostname}:${u.port || 5432}${u.pathname}`; } catch { return '(invalid DATABASE_URL)'; }
}

/** Startup check: logs clearly whether PostgreSQL is reachable. Never throws; the API keeps running and reports 503. */
export async function checkDatabase() {
  try {
    const { rows } = await pool.query('SELECT current_database() AS db, (SELECT count(*) FROM schema_migrations) AS migrations');
    logger.info(`PostgreSQL connected: ${dbTarget()} (${rows[0].migrations} migrations applied)`);
    return true;
  } catch (err) {
    const hint = isDbUnavailable(err)
      ? 'Is PostgreSQL running on that host/port? For the local dev cluster: pg_ctl -D .devdb -o "-p 5433" -l .devdb/server.log start'
      : 'Run npm run db:migrate if the schema is missing.';
    logger.error({ code: err.code, message: err.message }, `PostgreSQL NOT reachable at ${dbTarget()} — database endpoints will answer 503. ${hint}`);
    return false;
  }
}

export async function one(text, params) {
  const { rows } = await pool.query(text, params);
  return rows[0] ?? null;
}

export async function many(text, params) {
  const { rows } = await pool.query(text, params);
  return rows;
}

/** Run fn(client) inside a transaction; rolls back on any thrown error. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
