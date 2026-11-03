import { config, isProd } from '../config.js';

/** Today's date (YYYY-MM-DD) in the store timezone. Used for daily limits and challenges. */
export function storeToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.STORE_TIMEZONE }).format(new Date());
}

/** The Advent calendar's "today" — overridable outside production so QA can open December doors early. */
export function adventToday() {
  if (!isProd && config.ADVENT_DATE_OVERRIDE) return config.ADVENT_DATE_OVERRIDE;
  return storeToday();
}

export function dateParts(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

/** SQL fragment: the store-local calendar date of a timestamptz column. */
export const localDate = (col) => `(${col} AT TIME ZONE '${config.STORE_TIMEZONE.replace(/'/g, '')}')::date`;
