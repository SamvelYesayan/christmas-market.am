// Admin: Christmas Calendar — configure the 31 days, see claims and Grand Prize eligibility.
// Claims are read-only here on purpose: no admin action can add, edit or move a claim, so nobody's
// Grand Prize eligibility can be changed by hand (the database refuses it too — migration 006).
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { many, one, query } from '../../db.js';
import { ah, badRequest, notFound } from '../../lib/errors.js';
import { randomToken } from '../../lib/crypto.js';
import { validate } from '../../middleware/validate.js';
import { config } from '../../config.js';
import { adventToday, dateParts } from '../../lib/time.js';
import { GRAND_DAY, TOTAL_DAYS, VALID_CLAIM_SQL, calendarClock, grandEligibility } from '../../services/calendar.js';
import { audit } from './audit.js';
import { sniff } from './products.js';

const r = Router();
const uploadDir = path.resolve(config.UPLOAD_DIR);
const KINDS = ['coupon', 'points', 'product', 'gift', 'minigame', 'challenge', 'story'];
const yearParam = z.coerce.number().int().min(2024).max(2100);
const dayParams = z.object({ year: yearParam, day: z.coerce.number().int().min(1).max(TOTAL_DAYS) });
const imageUrl = z.string().trim().max(500).regex(/^\/uploads\/[A-Za-z0-9._-]+$|^https:\/\//, 'Use an uploaded image or an https:// address.').nullable().optional();
const text = (max) => z.string().trim().max(max).nullable().optional();
// Per-language overlays (title, teaser, description, story, text…). Text only; existing keys are kept.
const i18nText = z.record(z.string().max(2000));

const optionSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9_-]{1,40}$/, 'Option keys use lowercase letters, numbers, - or _.'),
  title: z.string().trim().min(1).max(120),
  description: text(500),
  image_url: imageUrl,
  kind: z.enum(KINDS).default('gift'),
  payload: z.record(z.any()).default({}),
  i18n: z.object({ hy: i18nText.optional(), en: i18nText.optional() }).optional(),
}).strict();

const daySchema = z.object({
  title: z.string().trim().min(1).max(120),
  teaser: text(200),
  description: text(1000),
  image_url: imageUrl,
  kind: z.enum(KINDS),
  payload: z.record(z.any()).default({}),
  art: z.string().trim().max(30).default('gift'),
  is_available: z.boolean(),
  max_claims: z.number().int().min(1).max(1_000_000).nullable().optional(),
  options: z.array(optionSchema).max(6).default([]),
  i18n: z.object({ hy: i18nText.optional(), en: i18nText.optional() }).default({}),
}).strict().superRefine((v, ctx) => {
  const keys = v.options.map((o) => o.key);
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Each gift option needs its own key.' });
});

const currentYear = () => dateParts(adventToday()).year;

/** Overview: 31 days with configuration and claim counts, plus Grand Prize numbers. */
r.get('/', validate({ query: z.object({ year: yearParam.optional() }) }), ah(async (req, res) => {
  const year = req.query.year ?? currentYear();
  const clock = calendarClock(adventToday(), year);
  const doors = await many('SELECT * FROM advent_doors WHERE year=$1 ORDER BY day', [year]);
  const counts = await many(
    `SELECT d.day, count(*) FILTER (WHERE ${VALID_CLAIM_SQL})::int AS claims,
            count(*) FILTER (WHERE ao.outcome = 'gift')::int AS gifts
       FROM advent_openings ao JOIN advent_doors d ON d.id = ao.door_id WHERE d.year=$1 GROUP BY d.day`, [year]);
  const byDay = new Map(counts.map((c) => [c.day, c]));
  const doorBy = new Map(doors.map((d) => [d.day, d]));
  const people = await participants(year);
  const tally = { on_track: 0, lost: 0, qualified: 0, entered: 0 };
  for (const p of people) tally[grandEligibility(clock.day, new Set(p.days)).status]++;
  res.json({
    year, today: clock.today, todayDay: clock.phase === 'during' ? clock.day : null, phase: clock.phase,
    days: Array.from({ length: TOTAL_DAYS }, (_, i) => {
      const day = i + 1;
      return { day, isGrand: day === GRAND_DAY, door: doorBy.get(day) ?? null, claims: byDay.get(day)?.claims ?? 0, gifts: byDay.get(day)?.gifts ?? 0 };
    }),
    participants: people.length,
    grand: tally,
  });
}));

/** Create or update one day. The year and day come from the URL and can never be changed. */
r.put('/:year/:day', validate({ params: dayParams, body: daySchema }), ah(async (req, res) => {
  const { year, day } = req.params;
  const b = req.body;
  const row = await one(
    `INSERT INTO advent_doors (year, day, title, teaser, description, image_url, kind, payload, art, is_available, max_claims, options, i18n, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())
     ON CONFLICT (year, day) DO UPDATE SET title=EXCLUDED.title, teaser=EXCLUDED.teaser, description=EXCLUDED.description, image_url=EXCLUDED.image_url,
       kind=EXCLUDED.kind, payload=EXCLUDED.payload, art=EXCLUDED.art, is_available=EXCLUDED.is_available, max_claims=EXCLUDED.max_claims,
       options=EXCLUDED.options, i18n=EXCLUDED.i18n, updated_at=now()
     RETURNING *`,
    [year, day, b.title, b.teaser ?? null, b.description ?? null, b.image_url ?? null, b.kind, JSON.stringify(b.payload), b.art, b.is_available,
      b.max_claims ?? null, JSON.stringify(b.options), JSON.stringify(b.i18n)]);
  await audit(req, 'calendar_day_saved', 'advent_doors', row.id, { year, day, title: b.title, kind: b.kind, is_available: b.is_available, options: b.options.length });
  res.json({ door: row });
}));

/** Switch a day's gift on or off without touching anything else. */
r.post('/:year/:day/availability', validate({ params: dayParams, body: z.object({ is_available: z.boolean() }).strict() }), ah(async (req, res) => {
  const row = await one('UPDATE advent_doors SET is_available=$3, updated_at=now() WHERE year=$1 AND day=$2 RETURNING *', [req.params.year, req.params.day, req.body.is_available]);
  if (!row) throw notFound('Set up this day first.');
  await audit(req, req.body.is_available ? 'calendar_day_on' : 'calendar_day_off', 'advent_doors', row.id, { year: req.params.year, day: req.params.day });
  res.json({ door: row });
}));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
/** Upload a gift picture; returns its URL for the day (or an option) to use. */
r.post('/images', upload.single('image'), ah(async (req, res) => {
  if (!req.file) throw badRequest('Choose an image.');
  const ext = sniff(req.file.buffer);
  if (!ext) throw badRequest(`${req.file.originalname} is not a JPEG, PNG, WebP or AVIF image.`);
  await fs.mkdir(uploadDir, { recursive: true });
  const name = `${randomToken(16)}.${ext}`;
  await fs.writeFile(path.join(uploadDir, name), req.file.buffer);
  await audit(req, 'calendar_image', 'advent_doors', null, { file: name });
  res.status(201).json({ url: `/uploads/${name}` });
}));

/** Claims, newest first; filter by day. */
r.get('/:year/claims', validate({ params: z.object({ year: yearParam }), query: z.object({ day: z.coerce.number().int().min(1).max(TOTAL_DAYS).optional(), page: z.coerce.number().int().min(1).max(1000).default(1) }) }), ah(async (req, res) => {
  const { year } = req.params;
  const { day, page } = req.query;
  const pageSize = 50;
  const params = [year, pageSize, (page - 1) * pageSize];
  let where = 'd.year=$1';
  if (day) { params.push(day); where += ` AND d.day=$${params.length}`; }
  const items = await many(
    `SELECT d.day, ao.opened_at, ao.claimed_on, ao.option_key, ao.outcome, (${VALID_CLAIM_SQL}) AS valid,
            u.id AS user_id, u.name, u.email, count(*) OVER()::int AS total
       FROM advent_openings ao JOIN advent_doors d ON d.id = ao.door_id JOIN users u ON u.id = ao.user_id
      WHERE ${where} ORDER BY ao.opened_at DESC LIMIT $2 OFFSET $3`, params);
  res.json({ items: items.map(({ total, ...x }) => x), total: items[0]?.total ?? 0, page, pageSize });
}));

/** Every customer with at least one claim this year, with their validly claimed days. */
async function participants(year, q) {
  const params = [year];
  let filter = 'c.user_id IS NOT NULL';
  if (q) { params.push(`%${q}%`); filter = `(u.name ILIKE $2 OR u.email::text ILIKE $2)`; }
  return many(
    `WITH c AS (
       SELECT ao.user_id, array_agg(d.day ORDER BY d.day) FILTER (WHERE ${VALID_CLAIM_SQL}) AS days, max(ao.opened_at) AS last_at
         FROM advent_openings ao JOIN advent_doors d ON d.id = ao.door_id WHERE d.year=$1 GROUP BY ao.user_id)
     SELECT u.id, u.name, u.email, COALESCE(c.days, '{}') AS days, c.last_at
       FROM users u LEFT JOIN c ON c.user_id = u.id
      WHERE ${filter} AND u.role = 'customer'
      ORDER BY cardinality(COALESCE(c.days, '{}')) DESC, u.name LIMIT 2000`, params);
}

/** Search customers; each row shows completed days, missed days and Grand Prize eligibility. */
r.get('/:year/customers', validate({ params: z.object({ year: yearParam }), query: z.object({
  q: z.string().trim().max(80).optional(), status: z.enum(['on_track', 'lost', 'qualified', 'entered']).optional(), page: z.coerce.number().int().min(1).max(1000).default(1),
}) }), ah(async (req, res) => {
  const { year } = req.params;
  const clock = calendarClock(adventToday(), year);
  const pageSize = 25;
  let rows = (await participants(year, req.query.q)).map((p) => {
    const set = new Set(p.days);
    const g = grandEligibility(clock.day, set);
    return { id: p.id, name: p.name, email: p.email, completedDays: p.days, missedDays: g.missed, completed: set.size, eligibility: g.status, lastClaimAt: p.last_at };
  });
  if (req.query.status) rows = rows.filter((x) => x.eligibility === req.query.status);
  const { page } = req.query;
  res.json({ items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize, todayDay: clock.phase === 'during' ? clock.day : null });
}));

export default r;
