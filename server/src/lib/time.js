import { config, isProd } from '../config.js';

/**
 * Today's date (YYYY-MM-DD) in the store timezone (Asia/Yerevan), from the server clock.
 * `now` is injectable for tests; the browser's clock or timezone is never used.
 */
export function storeToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.STORE_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** A development/QA date override is active (never in production). */
export const adventOverrideActive = () => !isProd && !!config.ADVENT_DATE_OVERRIDE;

/** The Advent calendar's "today": the real Yerevan date, unless a development-only override is explicitly set. */
export function adventToday(now = new Date()) {
  if (adventOverrideActive()) return config.ADVENT_DATE_OVERRIDE;
  return storeToday(now);
}

export function dateParts(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

/** Whole days from one YYYY-MM-DD date to another (calendar dates, no clock or timezone involved). */
export function daysBetween(fromIso, toIso) {
  const utc = (iso) => { const { year, month, day } = dateParts(iso); return Date.UTC(year, month - 1, day); };
  return Math.round((utc(toIso) - utc(fromIso)) / 86400000);
}

/** SQL fragment: the store-local calendar date of a timestamptz column. */
export const localDate = (col) => `(${col} AT TIME ZONE '${config.STORE_TIMEZONE.replace(/'/g, '')}')::date`;
