import { Router } from 'express';
import { z } from 'zod';
import { many, one, pool, withTransaction } from '../../db.js';
import { ah, badRequest, notFound } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { ORDER_STATUSES, cancelOrder, orderWithDetails, publicOrder } from '../../services/orders.js';
import { audit } from './audit.js';

const r = Router();

const listSchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  payment: z.enum(['unpaid', 'pending', 'paid', 'failed', 'refunded', 'cod']).optional(),
  test: z.enum(['true', 'false']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

r.get('/', validate({ query: listSchema }), ah(async (req, res) => {
  const q = req.query;
  const where = [];
  const params = [];
  const add = (sql, val) => { params.push(val); where.push(sql.replace('?', `$${params.length}`)); };
  if (q.q) add(`(o.number ILIKE '%' || ? || '%' OR o.customer->>'email' ILIKE '%' || $${params.length + 1} || '%' OR o.customer->>'name' ILIKE '%' || $${params.length + 1} || '%' OR o.customer->>'phone' ILIKE '%' || $${params.length + 1} || '%')`, q.q);
  if (q.status) add('o.status = ?', q.status);
  if (q.payment) add('o.payment_status = ?', q.payment);
  if (q.test) add('o.is_test = ?', q.test === 'true');
  if (q.from) add('o.created_at >= ?::date', q.from);
  if (q.to) add(`o.created_at < ?::date + interval '1 day'`, q.to);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await one(`SELECT count(*)::int AS n FROM orders o ${w}`, params);
  params.push((q.page - 1) * 50);
  const rows = await many(
    `SELECT o.id, o.number, o.status, o.payment_status, o.payment_method, o.is_test, o.total, o.customer, o.delivery, o.created_at,
            (SELECT count(*)::int FROM order_items WHERE order_id=o.id) AS items
       FROM orders o ${w} ORDER BY o.created_at DESC LIMIT 50 OFFSET $${params.length}`, params);
  res.json({ items: rows, total: total.n, pages: Math.ceil(total.n / 50) });
}));

r.get('/:number', ah(async (req, res) => {
  const o = await one('SELECT id, user_id FROM orders WHERE number=$1', [req.params.number]);
  if (!o) throw notFound();
  const order = await orderWithDetails(pool, o.id);
  res.json({ order: { ...publicOrder(order), id: order.id, userId: order.user_id } });
}));

const updateSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  note: z.string().trim().max(500).optional(),
  trackingCode: z.string().trim().max(80).nullable().optional(),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  markPaid: z.boolean().optional(),
});

r.patch('/:number', validate({ body: updateSchema }), ah(async (req, res) => {
  const b = req.body;
  await withTransaction(async (db) => {
    const { rows: [o] } = await db.query('SELECT * FROM orders WHERE number=$1 FOR UPDATE', [req.params.number]);
    if (!o) throw notFound();
    if (b.status && b.status !== o.status) {
      if (b.status === 'cancelled') {
        if (!(await cancelOrder(db, o, { actorId: req.user.id, note: b.note ?? 'Cancelled by admin' }))) throw badRequest('Shipped or closed orders cannot be cancelled.');
      } else {
        if (o.status === 'cancelled') throw badRequest('Cancelled orders cannot be reopened.');
        if (['confirmed', 'processing', 'shipped', 'delivered'].includes(b.status) && !['paid', 'cod'].includes(o.payment_status) && !b.markPaid) {
          throw badRequest('This order is not paid yet. Mark it paid (e.g. bank transfer received) or wait for the payment provider.');
        }
        await db.query('UPDATE orders SET status=$2, updated_at=now() WHERE id=$1', [o.id, b.status]);
        await db.query('INSERT INTO order_status_history (order_id, status, note, actor_id) VALUES ($1,$2,$3,$4)', [o.id, b.status, b.note ?? null, req.user.id]);
        if (b.status === 'refunded') await db.query(`UPDATE orders SET payment_status='refunded' WHERE id=$1`, [o.id]);
      }
    }
    if (b.markPaid && o.payment_status !== 'paid') {
      await db.query(`UPDATE orders SET payment_status='paid', updated_at=now() WHERE id=$1`, [o.id]);
      await db.query('INSERT INTO order_status_history (order_id, status, note, actor_id) VALUES ($1,$2,$3,$4)', [o.id, b.status ?? o.status, 'Payment marked as received by admin', req.user.id]);
    }
    if (b.trackingCode !== undefined) await db.query('UPDATE orders SET tracking_code=$2, updated_at=now() WHERE id=$1', [o.id, b.trackingCode]);
    if (b.deliveryDate !== undefined) await db.query(`UPDATE orders SET delivery = jsonb_set(delivery, '{date}', to_jsonb($2::text)), updated_at=now() WHERE id=$1`, [o.id, b.deliveryDate ?? '']);
  });
  await audit(req, 'update', 'orders', req.params.number, b);
  const o = await one('SELECT id FROM orders WHERE number=$1', [req.params.number]);
  res.json({ order: publicOrder(await orderWithDetails(pool, o.id)) });
}));

export default r;
