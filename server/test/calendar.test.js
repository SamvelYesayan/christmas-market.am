// Christmas Calendar — 31 Days of Gifts.
//  • Rule tests run the real claim service against the database with a simulated server date in a far-future
//    test year (2098), so every December day can be exercised. Test users and days are removed afterwards.
//  • HTTP tests hit the running API (today = ADVENT_DATE_OVERRIDE) to prove the browser cannot pick the date.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.js';
import { calendarClock, claimDay, dayStatus, grandEligibility } from '../src/services/calendar.js';

const YEAR = 2098;
const TAG = `cal${Date.now().toString(36)}`;
const dec = (d) => `${YEAR}-12-${String(d).padStart(2, '0')}`;
const users = [];

async function makeUser(name) {
  const { rows: [u] } = await pool.query(
    `INSERT INTO users (email, password_hash, name) VALUES ($1, 'x-not-a-real-hash', $2) RETURNING id`, [`${name}-${TAG}@christmas-market.test`, `${name} ${TAG}`]);
  users.push(u.id);
  return u.id;
}
const claim = (uid, day, today, extra = {}) => claimDay(uid, { day, ...extra }, typeof today === 'number' ? dec(today) : today);
async function rejects(promise, status, code) {
  await assert.rejects(promise, (e) => { assert.equal(e.status, status, `${e.status} ${e.code} ${e.message}`); if (code) assert.equal(e.code, code); return true; });
}
async function validDays(uid) {
  const { rows } = await pool.query(
    `SELECT d.day FROM advent_openings ao JOIN advent_doors d ON d.id = ao.door_id
      WHERE ao.user_id=$1 AND d.year=$2 AND ao.claimed_on = make_date(d.year, 12, d.day) ORDER BY d.day`, [uid, YEAR]);
  return new Set(rows.map((r) => r.day));
}

before(async () => {
  // Day 1: a coupon. Day 2: a choice of two gifts. Day 3: a limited gift (1 available). Day 31: the Grand Prize. Others: not set up.
  const door = (day, title, kind, payload, extra = {}) => pool.query(
    `INSERT INTO advent_doors (year, day, title, kind, payload, is_available, max_claims, options) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (year, day) DO NOTHING`,
    [YEAR, day, title, kind, payload, extra.is_available ?? true, extra.max_claims ?? null, JSON.stringify(extra.options ?? [])]);
  await door(1, 'Test 10% coupon', 'coupon', { type: 'percent', value: 10, min_subtotal: 0, valid_days: 3 });
  await door(2, 'Pick one', 'gift', {}, { options: [{ key: 'cocoa', title: 'Cocoa', kind: 'points', payload: { points: 5 } }, { key: 'story', title: 'A story', kind: 'story', payload: { story: 'Once upon a snowfall' } }] });
  await door(3, 'Only one left', 'points', { points: 3 }, { max_claims: 1 });
  await door(31, 'Test Grand Prize', 'gift', { text: 'Grand!' });
});

after(async () => {
  if (users.length) await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [users]); // claims, rewards and coupons cascade
  await pool.query('DELETE FROM advent_doors WHERE year=$1', [YEAR]);
  await pool.end();
});

test('rules: calendar clock, day status and eligibility are pure and predictable', () => {
  assert.deepEqual(calendarClock('2098-11-30'), { year: 2098, day: 0, phase: 'before', today: '2098-11-30' });
  assert.equal(calendarClock('2098-12-31').day, 31);
  assert.equal(calendarClock('2099-01-02', 2098).phase, 'over');
  const claimed = new Set([1, 2, 3]);
  assert.equal(dayStatus(3, 4, claimed), 'completed');
  assert.equal(dayStatus(4, 4, claimed), 'available');
  assert.equal(dayStatus(5, 4, claimed), 'locked');
  assert.equal(dayStatus(2, 4, new Set()), 'missed');
  assert.equal(grandEligibility(4, claimed).status, 'on_track');
  assert.deepEqual(grandEligibility(5, claimed).missed, [4]);
  assert.equal(grandEligibility(5, claimed).status, 'lost');
  const all30 = new Set(Array.from({ length: 30 }, (_, i) => i + 1));
  assert.equal(grandEligibility(31, all30).status, 'qualified');
  assert.equal(grandEligibility(31, new Set([...all30, 31])).status, 'entered');
});

test('1. a customer claims the December 1 gift', async () => {
  const a = await makeUser('first');
  const r = await claim(a, 1, 1);
  assert.equal(r.outcome, 'gift');
  assert.equal(r.grant.kind, 'coupon');
  assert.ok(r.grant.coupon_code, 'a personal coupon was issued');
  assert.deepEqual([...await validDays(a)], [1]);
});

test('2 + 9. claiming every day 1–30 qualifies, and the Grand Prize opens on December 31', async () => {
  const a = await makeUser('faithful');
  for (let d = 1; d <= 30; d++) {
    const extra = d === 2 ? { optionKey: 'cocoa' } : {};
    const r = await claim(a, d, d, extra);
    assert.ok(['gift', 'check_in', 'sold_out'].includes(r.outcome), `day ${d}: ${r.outcome}`);
  }
  const days = await validDays(a);
  assert.equal(days.size, 30);
  assert.equal(grandEligibility(31, days).status, 'qualified');
  const grand = await claim(a, 31, 31);
  assert.equal(grand.outcome, 'grand_entry');
  assert.equal(grandEligibility(31, await validDays(a)).status, 'entered');
});

test('3 + 4. missing one day loses eligibility for good; later days can still be claimed', async () => {
  const b = await makeUser('forgetful');
  for (let d = 1; d <= 14; d++) await claim(b, d, d, d === 2 ? { optionKey: 'story' } : {});
  // 15 December passes without a claim. On the 16th:
  assert.deepEqual(grandEligibility(16, await validDays(b)).missed, [15]);
  assert.equal(grandEligibility(16, await validDays(b)).status, 'lost');
  const back = await claim(b, 16, 16);
  assert.ok(back.outcome, 'returning customer can claim today');
  for (let d = 17; d <= 30; d++) await claim(b, d, d);
  assert.equal((await validDays(b)).size, 29);
  assert.equal(grandEligibility(31, await validDays(b)).status, 'lost');
});

test('5. the same day cannot be claimed twice, even with simultaneous requests', async () => {
  const c = await makeUser('eager');
  await claim(c, 4, 4);
  await rejects(claim(c, 4, 4), 409, 'already_claimed');
  const d = await makeUser('clicker');
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => claim(d, 5, 5)));
  assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1, 'exactly one of six parallel claims wins');
  assert.ok(results.filter((x) => x.status === 'rejected').every((x) => x.reason.code === 'already_claimed'));
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM reward_grants WHERE user_id=$1 AND source='advent'`, [d]);
  assert.ok(rows[0].n <= 1, 'no duplicate rewards');
});

test('6 + 7. future days stay locked and missed days never reopen', async () => {
  const e = await makeUser('peeker');
  await rejects(claim(e, 6, 5), 403, 'day_locked');
  await rejects(claim(e, 31, 5), 403, 'day_locked');
  await rejects(claim(e, 7, 8), 403, 'day_missed');
  await rejects(claim(e, 1, '2098-11-28'), 403, 'calendar_not_started');
  assert.equal((await validDays(e)).size, 0);
});

test('10. an ineligible customer cannot take part in the Grand Prize', async () => {
  const f = await makeUser('latecomer');
  for (let d = 2; d <= 30; d++) await claim(f, d, d, d === 2 ? { optionKey: 'cocoa' } : {}); // missed 1 December
  await rejects(claim(f, 31, 31), 403, 'grand_not_eligible');
  assert.ok(!(await validDays(f)).has(31));
});

test('gift choice and limited gifts', async () => {
  const g = await makeUser('chooser');
  await rejects(claim(g, 2, 2), 400, 'option_required');
  await rejects(claim(g, 2, 2, { optionKey: 'not-an-option' }), 400, 'option_required');
  const r = await claim(g, 2, 2, { optionKey: 'cocoa' });
  assert.equal(r.claim.option_key, 'cocoa');
  assert.equal(r.grant.points, 5);
  // Day 3 had one gift; it was taken by an earlier test, so the day still counts but no gift is promised.
  const h = await makeUser('lastone');
  const late = await claim(h, 3, 3);
  assert.equal(late.outcome, 'sold_out');
  assert.equal(late.grant, null);
  assert.ok((await validDays(h)).has(3), 'the day still counts toward the Grand Prize');
});

test('database guards: claims are permanent, dated on their own day, and 31 December needs all 30 days', async () => {
  const x = await makeUser('sneaky');
  const { rows: [door6] } = await pool.query('SELECT id FROM advent_doors WHERE year=$1 AND day=6', [YEAR]);
  const { rows: [door31] } = await pool.query('SELECT id FROM advent_doors WHERE year=$1 AND day=31', [YEAR]);
  // Backdating a missed day by writing the row directly is refused.
  await assert.rejects(pool.query(`INSERT INTO advent_openings (user_id, door_id, claimed_on) VALUES ($1,$2,$3)`, [x, door6.id, dec(9)]), /own day/);
  await assert.rejects(pool.query(`INSERT INTO advent_openings (user_id, door_id) VALUES ($1,$2)`, [x, door6.id]), /own day/);
  // Entering the Grand Prize without the 30 days is refused.
  await assert.rejects(pool.query(`INSERT INTO advent_openings (user_id, door_id, claimed_on) VALUES ($1,$2,$3)`, [x, door31.id, dec(31)]), /grand prize/);
  // An existing claim cannot be moved to another date.
  await claim(x, 6, 6);
  await assert.rejects(pool.query(`UPDATE advent_openings SET claimed_on=$3 WHERE user_id=$1 AND door_id=$2`, [x, door6.id, dec(7)]), /permanent/);
  // A day with claims cannot be moved or deleted.
  await assert.rejects(pool.query(`UPDATE advent_doors SET day=29 WHERE id=$1`, [door6.id]), /cannot be moved or deleted/);
  await assert.rejects(pool.query(`DELETE FROM advent_doors WHERE id=$1`, [door6.id]), /cannot be moved or deleted/);
});

/* ───────── HTTP: the browser cannot choose the date ───────── */
const BASE = `${process.env.API_URL ?? 'http://localhost:4000'}/api/v1`;
const ORIGIN = (process.env.APP_ORIGIN ?? 'http://localhost:5173').split(',')[0];
function client() {
  const jar = new Map();
  return async (method, path, body, headers = {}) => {
    const res = await fetch(BASE + path, {
      method, body: body ? JSON.stringify(body) : undefined,
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Locale': 'en', Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...headers },
    });
    for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)); }
    return { status: res.status, data: await res.json().catch(() => null) };
  };
}

test('8. date manipulation from the browser is ignored or rejected (HTTP)', async () => {
  const guest = client();
  const cal = await guest('GET', '/advent');
  assert.equal(cal.status, 200);
  assert.equal(cal.data.days.length, 31);
  assert.equal(cal.data.days[30].isGrand, true);
  const today = cal.data.todayDay;
  if (!today) return; // outside December without ADVENT_DATE_OVERRIDE: nothing more to check over HTTP
  assert.equal((await guest('POST', '/advent/claim', { day: today })).status, 401, 'guests must sign in');

  const u = client();
  const reg = await u('POST', '/auth/register', { name: `Calendar ${TAG}`, email: `http-${TAG}@christmas-market.test`, password: 'snowy-password-123' });
  assert.equal(reg.status, 201);
  const { rows: [me] } = await pool.query('SELECT id FROM users WHERE email=$1', [`http-${TAG}@christmas-market.test`]);
  users.push(me.id);

  // Sending a date, year or other fields is refused outright.
  assert.equal((await u('POST', '/advent/claim', { day: today, date: '2026-12-01' })).status, 400);
  assert.equal((await u('POST', '/advent/claim', { day: today, year: 2025 })).status, 400);
  // Headers and query strings that claim another date change nothing: yesterday stays missed, tomorrow stays locked.
  const spoof = { Date: 'Tue, 01 Dec 2026 10:00:00 GMT', 'X-Advent-Date': '2026-12-01', 'X-Timezone': 'Pacific/Kiritimati' };
  if (today > 1) assert.equal((await u('POST', '/advent/claim?date=2026-12-01', { day: today - 1 }, spoof)).data.error.code, 'day_missed');
  if (today < 31) assert.equal((await u('POST', '/advent/claim?today=2026-12-31', { day: today + 1 }, spoof)).data.error.code, 'day_locked');
  if (today < 31) assert.equal((await u('POST', '/advent/claim', { day: 31 })).status, 403);

  // Today works once.
  const ok = await u('POST', '/advent/claim', { day: today, ...(cal.data.days[today - 1].options?.[0] ? { optionKey: cal.data.days[today - 1].options[0].key } : {}) });
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(ok.data.window.status, 'completed');
  assert.equal(ok.data.progress.completed, 1);
  assert.equal((await u('POST', '/advent/claim', { day: today })).status, 409);
  const mine = await u('GET', '/advent');
  assert.equal(mine.data.days[today - 1].status, 'completed');
  assert.equal(mine.data.grand.status, today === 1 ? 'on_track' : 'lost');
  // Locked days never leak their gift.
  if (today < 30) assert.equal(mine.data.days[today].title, undefined);
});
