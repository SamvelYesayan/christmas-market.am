// Christmas Calendar — 31 Days of Gifts. All rules live here and are decided by the server:
//  • the calendar day comes from the server clock in Asia/Yerevan (never from the browser),
//  • only today's window can be claimed, once per customer; missed days never reopen,
//  • 31 December (the Grand Prize) is open only to customers with a valid claim for every day 1–30.
// The database repeats the critical rules with triggers (migration 006), so they cannot be bypassed.
import { withTransaction } from '../db.js';
import { HttpError, badRequest, conflict } from '../lib/errors.js';
import { adventToday, dateParts, daysBetween } from '../lib/time.js';
import { awardAchievement, grantReward } from './rewards.js';

export const TOTAL_DAYS = 31;
export const GRAND_DAY = 31;
export const STREAK_DAYS = 30;
export const SOURCE = 'advent';

const pad = (n) => String(n).padStart(2, '0');
export const dayDate = (year, day) => `${year}-12-${pad(day)}`;
/** SQL condition: a claim counts only when it was made on its own calendar day. */
export const VALID_CLAIM_SQL = 'ao.claimed_on = make_date(d.year, 12, d.day)';

/**
 * Where the calendar stands today. December → `day` is the date; Jan–Nov → the coming December (day 0, all locked).
 * For another year (admin views): past years are fully over (day 32), future ones not started (day 0).
 */
export function calendarClock(todayIso = adventToday(), year) {
  const t = dateParts(todayIso);
  const current = t.year;
  const y = year ?? current;
  let day;
  if (y < current) day = TOTAL_DAYS + 1;
  else if (y > current) day = 0;
  else day = t.month === 12 ? t.day : 0;
  const phase = day === 0 ? 'before' : day > TOTAL_DAYS ? 'over' : 'during';
  // Countdown to 1 December, computed on the server from the Yerevan date (never from the browser clock).
  const startsIn = phase === 'before' ? daysBetween(todayIso, dayDate(y, 1)) : 0;
  return { year: y, day, phase, today: todayIso, startsIn };
}

/** Status of one window for a customer: completed | available | missed | locked. */
export function dayStatus(day, clockDay, claimed) {
  if (claimed.has(day)) return 'completed';
  if (day > clockDay) return 'locked';
  if (day < clockDay) return 'missed';
  return 'available';
}

/**
 * Grand Prize eligibility from the set of validly claimed days.
 *  entered    — claimed the Grand Prize on 31 December
 *  qualified  — every day 1–30 claimed
 *  on_track   — nothing missed so far
 *  lost       — at least one day 1–30 has passed unclaimed (permanent)
 */
export function grandEligibility(clockDay, claimed) {
  const missed = [];
  for (let d = 1; d <= Math.min(clockDay - 1, STREAK_DAYS); d++) if (!claimed.has(d)) missed.push(d);
  let completed = 0;
  for (let d = 1; d <= STREAK_DAYS; d++) if (claimed.has(d)) completed++;
  let status;
  if (claimed.has(GRAND_DAY)) status = 'entered';
  else if (missed.length) status = 'lost';
  else if (completed === STREAK_DAYS) status = 'qualified';
  else status = 'on_track';
  return { status, eligible: status !== 'lost', missed, completed, required: STREAK_DAYS };
}

/** Gift options a day offers (sanitised; ignores malformed entries). */
export function doorOptions(door) {
  const list = Array.isArray(door?.options) ? door.options : [];
  return list.filter((o) => o && typeof o.key === 'string' && o.key && typeof o.title === 'string' && o.title);
}

/** The reward to grant for a claim, or null when the gift is informational (story, product showcase, game…). */
export function rewardFor(gift) {
  const p = gift.payload ?? {};
  if (gift.kind === 'coupon' && p.type) return { kind: 'coupon', coupon: p };
  if (gift.kind === 'points' && Number(p.points) > 0) return { kind: 'points', points: Number(p.points) };
  if (gift.kind === 'gift' && p.coupon?.type) return { kind: 'coupon', coupon: p.coupon };
  return null;
}

const MSG = {
  notStarted: 'The Christmas Calendar opens on 1 December.',
  over: 'This year’s Christmas Calendar has ended. See you next December!',
  locked: (d) => `Day ${d} is still locked. Come back on ${d} December!`,
  missed: (d) => `Day ${d} has passed. Missed days cannot be opened later.`,
  already: 'You have already claimed today’s gift. Come back tomorrow!',
  notEligible: 'The Grand Prize is only for those who claimed a gift on every day from 1 to 30 December.',
  chooseOption: 'Please choose one of today’s gifts.',
};
export const CALENDAR_MESSAGES = MSG;

/**
 * Claim today's gift. `day` is what the visitor saw on screen; it must equal the server's today,
 * so a stale page, a changed device clock or a hand-made request can never open another day.
 */
export async function claimDay(userId, { day, optionKey }, todayIso = adventToday()) {
  const clock = calendarClock(todayIso);
  if (clock.phase === 'before') throw new HttpError(403, MSG.notStarted, 'calendar_not_started');
  if (clock.phase === 'over') throw new HttpError(403, MSG.over, 'calendar_over');
  if (day > clock.day) throw new HttpError(403, MSG.locked(day), 'day_locked');
  if (day < clock.day) throw new HttpError(403, MSG.missed(day), 'day_missed');
  const { year } = clock;

  return withTransaction(async (db) => {
    // One claim at a time per customer (double clicks, parallel tabs, scripted bursts).
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`advent:${userId}:${year}`]);

    // Every day exists as a row so a claim can always be recorded, even before the admin configures the gift.
    await db.query(`INSERT INTO advent_doors (year, day, title, kind, art, is_available) VALUES ($1, $2, $3, 'story', $4, false)
                    ON CONFLICT (year, day) DO NOTHING`, [year, day, day === GRAND_DAY ? 'Grand Prize' : `Day ${day}`, day === GRAND_DAY ? 'star' : 'gift']);
    let { rows: [door] } = await db.query('SELECT * FROM advent_doors WHERE year=$1 AND day=$2', [year, day]);

    const { rows: [existing] } = await db.query('SELECT 1 FROM advent_openings WHERE user_id=$1 AND door_id=$2', [userId, door.id]);
    if (existing) throw conflict(MSG.already, 'already_claimed');

    if (day === GRAND_DAY) {
      const { rows: [{ n }] } = await db.query(
        `SELECT count(*)::int AS n FROM advent_openings ao JOIN advent_doors d ON d.id = ao.door_id
          WHERE ao.user_id=$1 AND d.year=$2 AND d.day BETWEEN 1 AND $3 AND ${VALID_CLAIM_SQL}`, [userId, year, STREAK_DAYS]);
      if (n < STREAK_DAYS) throw new HttpError(403, MSG.notEligible, 'grand_not_eligible');
    }

    // Which gift: a configured, available day gives its gift (or the chosen option); otherwise the visit is still recorded.
    const options = doorOptions(door);
    let gift = null;
    let chosen = null;
    if (door.is_available) {
      if (options.length) {
        chosen = options.find((o) => o.key === optionKey);
        if (!chosen) throw badRequest(MSG.chooseOption, 'option_required');
        gift = { ...chosen, kind: chosen.kind ?? 'gift', payload: chosen.payload ?? {} };
      } else {
        gift = { title: door.title, kind: door.kind, payload: door.payload ?? {}, i18n: door.i18n };
      }
    }

    let outcome = day === GRAND_DAY ? 'grand_entry' : gift ? 'gift' : 'check_in';
    if (gift && door.max_claims && day !== GRAND_DAY) {
      ({ rows: [door] } = await db.query('SELECT * FROM advent_doors WHERE id=$1 FOR UPDATE', [door.id])); // serialise the last gifts
      const { rows: [{ n }] } = await db.query(`SELECT count(*)::int AS n FROM advent_openings WHERE door_id=$1 AND outcome='gift'`, [door.id]);
      if (n >= door.max_claims) { outcome = 'sold_out'; gift = null; }
    }

    const { rows: [claim] } = await db.query(
      `INSERT INTO advent_openings (user_id, door_id, claimed_on, option_key, outcome) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING RETURNING *`, [userId, door.id, dayDate(year, day), chosen?.key ?? null, outcome]);
    if (!claim) throw conflict(MSG.already, 'already_claimed');

    let grant = null;
    const reward = gift ? rewardFor(gift) : null;
    if (reward) {
      ({ grant } = await grantReward(db, userId, {
        ...reward, title: gift.title, titleHy: gift.i18n?.hy?.title, source: SOURCE, sourceRef: `${year}-${day}`,
        payload: chosen ? { option: chosen.key } : undefined,
      }));
    }

    const { rows: [{ n: total }] } = await db.query(
      `SELECT count(*)::int AS n FROM advent_openings ao JOIN advent_doors d ON d.id = ao.door_id WHERE ao.user_id=$1 AND d.year=$2 AND ${VALID_CLAIM_SQL}`, [userId, year]);
    const achievements = [];
    for (const [need, key] of [[5, 'advent_5'], [12, 'advent_12'], [24, 'advent_24']]) {
      if (total >= need) { const a = await awardAchievement(db, userId, key); if (a) achievements.push(a); }
    }
    return { door, claim, grant, gift, chosen, outcome, achievements, year };
  });
}
