// Admin visibility into Pioneer Card connections and points operations. Points and card data belong to Magical:
// staff can see every credit/debit the store asked for and ask the store to check an unknown outcome again (same
// idempotency key), but can never mark an operation as succeeded or change its amount.
// Disconnecting a card is done per customer (POST /admin/customers/:id/pioneer/unlink, reason required).
import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../../db.js';
import { ah, conflict, notFound } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { runOperation } from '../../services/pioneerPoints.js';
import { audit } from './audit.js';
import { pioneer, pioneerHealth, checkPioneerConnection, pointsAllowed } from '../../integrations/pioneer/index.js';
import { config } from '../../config.js';

const r = Router();

r.get('/', ah(async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 80);
  const status = ['active', 'unlinked'].includes(req.query.status) ? req.query.status : null;
  const params = [pioneer.provider];
  let where = 'l.provider = $1';
  if (status) { params.push(status); where += ` AND l.status = $${params.length}`; }
  if (q) { params.push(`%${q}%`); where += ` AND (u.email ILIKE $${params.length} OR u.name ILIKE $${params.length} OR l.holder_name ILIKE $${params.length} OR l.card_masked ILIKE $${params.length})`; }
  const [links, stats, events] = await Promise.all([
    many(
      `SELECT l.id, l.user_id, u.email, u.name AS customer, l.card_masked, l.holder_name, l.status, l.linked_at, l.unlinked_at,
              l.last_balance, l.balance_synced_at
         FROM pioneer_links l JOIN users u ON u.id = l.user_id
        WHERE ${where} ORDER BY (l.status = 'active') DESC, l.linked_at DESC LIMIT 300`, params),
    one(`SELECT count(*) FILTER (WHERE status='active')::int AS active, count(*) FILTER (WHERE status='unlinked')::int AS disconnected
           FROM pioneer_links WHERE provider = $1`, [pioneer.provider]),
    many(
      `SELECT e.created_at, e.event, e.card_masked, e.detail, u.email, a.email AS actor
         FROM pioneer_link_events e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN users a ON a.id = e.actor_id
        WHERE e.provider = $1 ORDER BY e.created_at DESC LIMIT 50`, [pioneer.provider]),
  ]);
  res.json({
    // Never includes the API key — only whether the startup/last check with GET /me succeeded.
    connection: { available: pioneer.configured, baseUrl: config.MAGICAL_PIONEER_API_URL ?? null, health: pioneerHealth },
    stats,
    links,
    events,
  });
}));

const OPEN = ['pending', 'processing', 'needs_reconciliation'];

/** Points operations (credits for game rewards, debits for gift redemptions). */
r.get('/operations', validate({ query: z.object({ status: z.enum(['open', 'succeeded', 'failed', 'all']).default('open') }) }), ah(async (req, res) => {
  const where = req.query.status === 'open' ? "op.status IN ('pending','processing','needs_reconciliation')" : req.query.status === 'all' ? 'true' : 'op.status = $1';
  const params = ['open', 'all'].includes(req.query.status) ? [] : [req.query.status];
  const [items, counts] = await Promise.all([
    many(`SELECT op.id, op.kind, op.source, op.points, op.status, op.attempts, op.last_error_code, op.reference, op.magical_transaction_id,
                 op.balance_after, op.replayed, op.created_at, op.completed_at, op.next_attempt_at, u.id AS user_id, u.email, u.name,
                 COALESCE(g.title, rd.title) AS title
            FROM pioneer_point_operations op LEFT JOIN users u ON u.id = op.user_id
            LEFT JOIN reward_grants g ON g.id = op.grant_id LEFT JOIN pioneer_redemptions rd ON rd.id = op.redemption_id
           WHERE ${where} ORDER BY op.created_at DESC LIMIT 200`, params),
    one(`SELECT count(*) FILTER (WHERE status IN ('pending','processing'))::int AS waiting,
                count(*) FILTER (WHERE status = 'needs_reconciliation')::int AS unknown,
                count(*) FILTER (WHERE status = 'succeeded')::int AS succeeded, count(*) FILTER (WHERE status = 'failed')::int AS failed
           FROM pioneer_point_operations`),
  ]);
  res.json({ items, counts });
}));

/** Ask Magical again for an open operation (same reference + idempotency key: it can never execute twice). */
r.post('/operations/:id/retry', validate({ params: z.object({ id: z.string().uuid() }) }), ah(async (req, res) => {
  if (!pointsAllowed) throw conflict('Pioneer points are blocked on this server, so nothing can be sent to Magical from here.', 'points_blocked');
  const op = await one('SELECT id, status FROM pioneer_point_operations WHERE id=$1', [req.params.id]);
  if (!op) throw notFound();
  if (!OPEN.includes(op.status)) throw conflict('Only waiting or unconfirmed operations can be checked again.', 'not_open');
  await one("UPDATE pioneer_point_operations SET next_attempt_at = now() WHERE id=$1 RETURNING id", [op.id]);
  const after = await runOperation(op.id, { tries: 1 });
  await audit(req, 'pioneer_points_retry', 'pioneer_point_operations', op.id, { before: op.status, after: after.status });
  res.json({ operation: { id: after.id, status: after.status, last_error_code: after.last_error_code, magical_transaction_id: after.magical_transaction_id } });
}));

/** Gift redemptions paid with Pioneer points; physical gifts are handed over by staff. */
r.get('/redemptions', ah(async (_req, res) => {
  res.json({ items: await many(
    `SELECT rd.id, rd.status, rd.points, rd.title, rd.fulfilment, rd.created_at, rd.completed_at, rd.error, u.id AS user_id, u.email, u.name, c.code AS coupon_code
       FROM pioneer_redemptions rd JOIN users u ON u.id = rd.user_id LEFT JOIN coupons c ON c.id = rd.coupon_id
      ORDER BY (rd.fulfilment = 'awaiting_handover') DESC, rd.created_at DESC LIMIT 200`) });
}));

r.post('/redemptions/:id/handed-over', validate({ params: z.object({ id: z.string().uuid() }) }), ah(async (req, res) => {
  const row = await one("UPDATE pioneer_redemptions SET fulfilment='handed_over', updated_at=now() WHERE id=$1 AND status='completed' AND fulfilment='awaiting_handover' RETURNING id", [req.params.id]);
  if (!row) throw conflict('Only a confirmed gift that is waiting to be handed over can be marked.', 'not_awaiting');
  await audit(req, 'pioneer_gift_handed_over', 'pioneer_redemptions', row.id);
  res.json({ ok: true });
}));

// Re-run the key check (GET /me) on demand.
r.post('/check', ah(async (_req, res) => res.json({ health: await checkPioneerConnection() })));

export default r;
