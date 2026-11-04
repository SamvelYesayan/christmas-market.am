// Christmas Wishes Wall — public API. Only APPROVED wishes are ever returned; new wishes start as pending.
import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db.js';
import { ah, badRequest } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { validate } from '../middleware/validate.js';
import { wishLimiter } from '../middleware/security.js';

const r = Router();

export const WISH_CATEGORIES = ['family', 'friends', 'love', 'health', 'success', 'peace', 'everyone'];
export const WISH_LIMITS = { author: [2, 60], recipient: [1, 60], message: [10, 400] };

const publicWish = (w) => ({
  id: w.id,
  author: w.author_name,
  recipient: w.recipient_name,
  message: w.message,
  category: w.category,
  approvedAt: w.approved_at,
});

/** Trims, removes control/invisible characters and collapses runs of spaces / blank lines. */
const range = (a, b) => String.fromCharCode(a) + '-' + String.fromCharCode(b);
// C0 controls (except tab/newline), DEL, zero-width and bidi-override characters, BOM.
const INVISIBLE = new RegExp('[' + [range(0, 8), range(11, 12), range(14, 31), range(127, 127), range(0x200b, 0x200f), range(0x2028, 0x202e), range(0xfeff, 0xfeff)].join('') + ']', 'g');
export const tidy = (s) => String(s ?? '')
  .replace(INVISIBLE, '')
  .replace(/\r\n?/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .split('\n').map((l) => l.trim()).join('\n')
  .trim();

const text = ([min, max], tooShort, tooLong) => z.string().transform(tidy).pipe(z.string().min(min, tooShort).max(max, tooLong));
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|am|ru|net|org|io|info|xyz|top|site|online|shop)\b|@[a-z0-9-]+\.[a-z]{2,}|t\.me\/)/i;
const REPEATED = /(.)\1{9,}/u;

const wishSchema = z.object({
  authorName: text(WISH_LIMITS.author, 'Please enter your name (at least 2 characters).', 'Your name is too long (60 characters at most).'),
  recipientName: z.string().optional().transform((v) => (v == null ? undefined : tidy(v) || undefined))
    .pipe(z.string().max(WISH_LIMITS.recipient[1], 'The recipient name is too long (60 characters at most).').optional()),
  message: text(WISH_LIMITS.message, 'Your wish is a little too short (at least 10 characters).', 'Your wish is too long (400 characters at most).'),
  category: z.enum(WISH_CATEGORIES).optional(),
  // Anti-spam: a field humans never see, and the time the form was open.
  website: z.string().max(200).optional(),
  elapsedMs: z.number().int().min(0).max(86_400_000).optional(),
}).strict();

const batchQuery = z.object({
  limit: z.coerce.number().int().min(1).max(40).default(24),
  // ids the browser showed recently, so a new batch brings different wishes (when there are enough)
  exclude: z.string().max(40 * 37).optional()
    .transform((v) => (v ? v.split(',').filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 40) : [])),
});

// A random batch of approved wishes for the homepage wall.
r.get('/wishes', validate({ query: batchQuery }), ah(async (req, res) => {
  const { limit, exclude } = req.query;
  const [{ total }] = await many(`SELECT count(*)::int AS total FROM christmas_wishes WHERE status = 'approved'`);
  let rows = await many(
    `SELECT id, author_name, recipient_name, message, category, approved_at FROM christmas_wishes
      WHERE status = 'approved' AND NOT (id = ANY($2::uuid[])) ORDER BY random() LIMIT $1`, [limit, exclude]);
  if (rows.length < Math.min(limit, total)) {
    // Not enough unseen wishes: top up with seen ones rather than leaving the wall short.
    const more = await many(
      `SELECT id, author_name, recipient_name, message, category, approved_at FROM christmas_wishes
        WHERE status = 'approved' AND NOT (id = ANY($2::uuid[])) ORDER BY random() LIMIT $1`, [limit - rows.length, rows.map((w) => w.id)]);
    rows = rows.concat(more);
  }
  res.set('Cache-Control', 'no-store');
  res.json({ items: rows.map(publicWish), total });
}));

// Newest approved wishes, paged (for reading more than the wall shows).
r.get('/wishes/recent', validate({ query: z.object({ page: z.coerce.number().int().min(1).max(10_000).default(1) }) }), ah(async (req, res) => {
  const pageSize = 12;
  const [{ total }] = await many(`SELECT count(*)::int AS total FROM christmas_wishes WHERE status = 'approved'`);
  const rows = await many(
    `SELECT id, author_name, recipient_name, message, category, approved_at FROM christmas_wishes
      WHERE status = 'approved' ORDER BY approved_at DESC, id LIMIT $1 OFFSET $2`, [pageSize, (req.query.page - 1) * pageSize]);
  res.json({ items: rows.map(publicWish), total, page: req.query.page, pageSize });
}));

// Submit a wish. Always starts as pending; staff approve it in the admin panel.
r.post('/wishes', wishLimiter, validate({ body: wishSchema }), ah(async (req, res) => {
  const b = req.body;
  const accepted = { ok: true, status: 'pending' };
  // Bots: filled the hidden field or submitted faster than a person can type. Answer like a success, keep nothing.
  if (b.website || (b.elapsedMs != null && b.elapsedMs < 2500)) {
    logger.info({ reason: b.website ? 'honeypot' : 'too_fast' }, 'wish discarded as spam');
    return res.status(201).json(accepted);
  }
  for (const v of [b.authorName, b.recipientName, b.message]) {
    if (v && LINK.test(v)) throw badRequest('Please leave links and addresses out of your wish.', 'wish_links');
    if (v && REPEATED.test(v)) throw badRequest('This looks like a typing slip — please check your wish.', 'wish_repeated');
  }
  const dupe = await one(
    `SELECT 1 FROM christmas_wishes WHERE md5(lower(message)) = md5(lower($1)) AND created_at > now() - interval '24 hours' LIMIT 1`, [b.message]);
  if (dupe) return res.status(201).json(accepted); // same wish already waiting — no second copy
  await query(
    `INSERT INTO christmas_wishes (author_name, recipient_name, message, category, locale, user_id) VALUES ($1,$2,$3,$4,$5,$6)`,
    [b.authorName, b.recipientName ?? null, b.message, b.category ?? null, req.locale === 'en' ? 'en' : 'hy', req.user?.id ?? null]);
  res.status(201).json(accepted);
}));

export default r;
