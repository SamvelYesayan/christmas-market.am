// Christmas Calendar dates in Asia/Yerevan (UTC+4, no daylight saving).
// Each case starts from a real instant (UTC) and checks the Yerevan calendar date, the calendar state and what can be claimed.
// Claims are exercised in the test year 2096 with the same instants shifted by years, so real 2026 data is never touched.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.js';
import { adventOverrideActive, adventToday, storeToday } from '../src/lib/time.js';
import { calendarClock, claimDay, grandEligibility } from '../src/services/calendar.js';

const TAG = `dt${Date.now().toString(36)}`;
const users = [];
async function makeUser(name) {
  const { rows: [u] } = await pool.query(`INSERT INTO users (email, password_hash, name) VALUES ($1, 'x-not-a-real-hash', $2) RETURNING id`, [`${name}-${TAG}@christmas-market.test`, `${name} ${TAG}`]);
  users.push(u.id);
  return u.id;
}
/** Yerevan date for a UTC instant in the test year (2026 → 2096; Yerevan has no daylight saving, so the offset is the same). */
const inTestYear = (utc) => storeToday(new Date(utc.replace(/^2026/, '2096').replace(/^2027/, '2097')));
async function rejects(promise, code) {
  await assert.rejects(promise, (e) => { assert.equal(e.code, code, `${e.code}: ${e.message}`); return true; });
}

after(async () => {
  if (users.length) await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [users]);
  await pool.query('DELETE FROM advent_doors WHERE year=2096');
  await pool.end();
});

test('the real date is used: no override is active and adventToday() is the Yerevan date', () => {
  assert.equal(adventOverrideActive(), false, 'ADVENT_DATE_OVERRIDE is set in .env — remove it so the calendar follows the real date');
  const now = new Date();
  assert.equal(adventToday(now), storeToday(now));
  assert.match(adventToday(), /^\d{4}-\d{2}-\d{2}$/);
});

test('the server process timezone does not matter — only Asia/Yerevan does', () => {
  const instant = new Date('2026-11-30T20:30:00Z'); // 00:30 on 1 December in Yerevan, still 30 November in UTC
  const before = process.env.TZ;
  for (const tz of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Tokyo']) {
    process.env.TZ = tz;
    assert.equal(storeToday(instant), '2026-12-01', tz);
  }
  if (before === undefined) delete process.env.TZ; else process.env.TZ = before;
});

test('November 5, 2026: calendar not started, countdown 26 days, nothing can be claimed', async () => {
  for (const utc of ['2026-11-05T08:00:00Z', '2026-11-04T20:00:00Z', '2026-11-05T19:59:59Z']) assert.equal(storeToday(new Date(utc)), '2026-11-05', utc);
  assert.equal(storeToday(new Date('2026-11-04T19:59:59Z')), '2026-11-04', 'one second before Yerevan midnight is still the 4th');
  const clock = calendarClock('2026-11-05');
  assert.deepEqual(clock, { year: 2026, day: 0, phase: 'before', today: '2026-11-05', startsIn: 26 });
  assert.equal(calendarClock('2026-11-30').startsIn, 1);
  assert.equal(grandEligibility(clock.day, new Set()).status, 'on_track', 'nobody has missed anything yet');
  const u = await makeUser('november');
  for (const day of [1, 5, 8, 31]) await rejects(claimDay(u, { day }, '2026-11-05'), 'calendar_not_started'); // December 8 included: no early unlock
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM advent_openings WHERE user_id=$1', [u]);
  assert.equal(rows[0].n, 0);
});

test('December 1: opens at Yerevan midnight (20:00 UTC on 30 November), day 1 only', async () => {
  assert.equal(storeToday(new Date('2026-11-30T19:59:59Z')), '2026-11-30');
  assert.equal(storeToday(new Date('2026-11-30T20:00:00Z')), '2026-12-01');
  assert.deepEqual(calendarClock('2026-12-01'), { year: 2026, day: 1, phase: 'during', today: '2026-12-01', startsIn: 0 });
  const u = await makeUser('first');
  await rejects(claimDay(u, { day: 1 }, inTestYear('2026-11-30T19:59:59Z')), 'calendar_not_started');
  const today = inTestYear('2026-11-30T20:00:30Z'); // 00:00:30 in Yerevan
  assert.equal(today, '2096-12-01');
  await rejects(claimDay(u, { day: 2 }, today), 'day_locked');
  assert.ok((await claimDay(u, { day: 1 }, today)).claim);
  await rejects(claimDay(u, { day: 1 }, today), 'already_claimed');
});

test('December 8: day 8 is today, day 7 is missed, day 9 is locked', async () => {
  assert.equal(storeToday(new Date('2026-12-07T21:00:00Z')), '2026-12-08', 'UTC still says the 7th, Yerevan says the 8th');
  assert.equal(storeToday(new Date('2026-12-08T19:59:59Z')), '2026-12-08');
  assert.equal(storeToday(new Date('2026-12-08T20:00:00Z')), '2026-12-09');
  assert.equal(calendarClock('2026-12-08').day, 8);
  const u = await makeUser('eighth');
  const today = inTestYear('2026-12-07T21:00:00Z');
  assert.equal(today, '2096-12-08');
  await rejects(claimDay(u, { day: 7 }, today), 'day_missed');
  await rejects(claimDay(u, { day: 9 }, today), 'day_locked');
  assert.ok((await claimDay(u, { day: 8 }, today)).claim);
  assert.deepEqual(grandEligibility(8, new Set([8])).missed, [1, 2, 3, 4, 5, 6, 7]);
});

test('December 31: Grand Prize for a customer who claimed every Yerevan day 1–30; refused for one who missed a day', async () => {
  assert.equal(storeToday(new Date('2026-12-30T20:00:00Z')), '2026-12-31');
  assert.equal(storeToday(new Date('2026-12-31T19:59:59Z')), '2026-12-31');
  assert.equal(storeToday(new Date('2026-12-31T20:00:00Z')), '2027-01-01', 'the calendar ends at Yerevan midnight');
  assert.equal(calendarClock('2026-12-31').day, 31);
  assert.equal(calendarClock('2027-01-01', 2026).phase, 'over');

  const loyal = await makeUser('loyal');
  const late = await makeUser('late');
  for (let d = 1; d <= 30; d++) {
    // Each claim happens a few minutes after Yerevan midnight — still the previous day in UTC.
    const utc = `2026-${d === 1 ? '11-30' : `12-${String(d - 1).padStart(2, '0')}`}T20:05:00Z`;
    const today = inTestYear(utc);
    assert.equal(today, `2096-12-${String(d).padStart(2, '0')}`);
    await claimDay(loyal, { day: d }, today);
    if (d !== 15) await claimDay(late, { day: d }, today);
  }
  const dec31 = inTestYear('2026-12-30T20:00:00Z');
  assert.equal((await claimDay(loyal, { day: 31 }, dec31)).outcome, 'grand_entry');
  await rejects(claimDay(late, { day: 31 }, dec31), 'grand_not_eligible');
  // After Yerevan midnight it is 1 January: December is closed (the next calendar starts next December).
  await rejects(claimDay(late, { day: 31 }, inTestYear('2026-12-31T20:00:00Z')), 'calendar_not_started');
});
