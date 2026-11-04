// Admin moderation for the Christmas Wishes Wall (mounted under /admin, which already requires the admin role).
import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../../db.js';
import { ah, notFound } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { audit } from './audit.js';
import { WISH_CATEGORIES, WISH_LIMITS, tidy } from '../wishes.js';

const r = Router();
const STATUSES = ['pending', 'approved', 'rejected'];
const PAGE = 50;

const listQuery = z.object({
  status: z.enum(STATUSES).optional().or(z.literal('').transform(() => undefined)),
  category: z.enum(WISH_CATEGORIES).optional().or(z.literal('').transform(() => undefined)),
  q: z.string().max(80).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

r.get('/', validate({ query: listQuery }), ah(async (req, res) => {
  const { status, category, q, page } = req.query;
  const where = [];
  const params = [];
  if (status) { params.push(status); where.push(`status = $${params.length}`); }
  if (category) { params.push(category); where.push(`category = $${params.length}`); }
  if (q?.trim()) { params.push(`%${q.trim()}%`); where.push(`(author_name ILIKE $${params.length} OR recipient_name ILIKE $${params.length})`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [items, total, counts] = await Promise.all([
    many(`SELECT w.*, u.email AS user_email FROM christmas_wishes w LEFT JOIN users u ON u.id = w.user_id ${w}
           ORDER BY (w.status = 'pending') DESC, w.created_at DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`, params),
    one(`SELECT count(*)::int AS n FROM christmas_wishes ${w}`, params),
    many(`SELECT status, count(*)::int AS n FROM christmas_wishes GROUP BY status`),
  ]);
  res.json({ items, total: total.n, page, pageSize: PAGE, counts: Object.fromEntries(STATUSES.map((s) => [s, counts.find((c) => c.status === s)?.n ?? 0])) });
}));

const idParam = z.object({ id: z.string().uuid() });

r.post('/:id/status', validate({ params: idParam, body: z.object({ status: z.enum(STATUSES) }).strict() }), ah(async (req, res) => {
  const row = await one(
    `UPDATE christmas_wishes SET status = $2, updated_at = now(), moderated_by = $3,
            approved_at = CASE WHEN $2 = 'approved' THEN COALESCE(approved_at, now()) ELSE NULL END
      WHERE id = $1 RETURNING *`, [req.params.id, req.body.status, req.user.id]);
  if (!row) throw notFound('Wish not found.');
  await audit(req, `wish_${req.body.status}`, 'christmas_wishes', row.id);
  res.json({ item: row });
}));

const editSchema = z.object({
  author_name: z.string().transform(tidy).pipe(z.string().min(WISH_LIMITS.author[0]).max(WISH_LIMITS.author[1])).optional(),
  recipient_name: z.string().nullable().transform((v) => (v == null ? null : tidy(v) || null)).pipe(z.string().max(WISH_LIMITS.recipient[1]).nullable()).optional(),
  message: z.string().transform(tidy).pipe(z.string().min(WISH_LIMITS.message[0]).max(WISH_LIMITS.message[1])).optional(),
  category: z.enum(WISH_CATEGORIES).nullable().optional(),
}).strict();

r.patch('/:id', validate({ params: idParam, body: editSchema }), ah(async (req, res) => {
  const keys = Object.keys(req.body).filter((k) => req.body[k] !== undefined);
  if (!keys.length) {
    const row = await one('SELECT * FROM christmas_wishes WHERE id = $1', [req.params.id]);
    if (!row) throw notFound('Wish not found.');
    return res.json({ item: row });
  }
  const row = await one(
    `UPDATE christmas_wishes SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
    [req.params.id, ...keys.map((k) => req.body[k])]);
  if (!row) throw notFound('Wish not found.');
  await audit(req, 'update', 'christmas_wishes', row.id, req.body);
  res.json({ item: row });
}));

r.delete('/:id', validate({ params: idParam }), ah(async (req, res) => {
  const { rowCount } = await query('DELETE FROM christmas_wishes WHERE id = $1', [req.params.id]);
  if (!rowCount) throw notFound('Wish not found.');
  await audit(req, 'delete', 'christmas_wishes', req.params.id);
  res.json({ ok: true });
}));

export default r;
