import { Router } from 'express';
import { z } from 'zod';
import { many, one, query, withTransaction } from '../../db.js';
import { ah, badRequest, notFound } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { publicGrant } from '../../services/rewards.js';
import { audit } from './audit.js';
import { pioneer, MagicalApiError } from '../../integrations/pioneer/index.js';
import { mapMagicalError } from '../pioneer.js';
import { logLinkEvent } from '../../services/pioneer.js';

const r = Router();

r.get('/', ah(async (req, res) => {
  const params = [];
  let where = '';
  if (req.query.q) { params.push(`%${String(req.query.q).slice(0, 80)}%`); where = 'WHERE u.email ILIKE $1 OR u.name ILIKE $1 OR u.phone ILIKE $1'; }
  if (req.query.pioneer === 'true') where += `${where ? ' AND' : 'WHERE'} l.id IS NOT NULL`;
  const rows = await many(
    `SELECT u.id, u.email, u.name, u.phone, u.role, u.is_active, u.created_at, u.last_login_at, u.is_demo, u.marketing_consent,
            h.name AS house, l.card_masked, l.status AS pioneer_status,
            (SELECT count(*)::int FROM orders o WHERE o.user_id=u.id AND NOT o.is_test) AS orders,
            (SELECT COALESCE(SUM(total),0)::int FROM orders o WHERE o.user_id=u.id AND NOT o.is_test AND o.payment_status IN ('paid','cod') AND o.status NOT IN ('cancelled','refunded')) AS spent
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id=u.id LEFT JOIN houses h ON h.id=p.house_id
       LEFT JOIN pioneer_links l ON l.user_id=u.id AND l.status='active' AND l.provider='${pioneer.provider}'
       ${where} ORDER BY u.created_at DESC LIMIT 500`, params);
  res.json({ items: rows });
}));

r.get('/:id', validate({ params: z.object({ id: z.string().uuid() }) }), ah(async (req, res) => {
  const u = await one(
    `SELECT u.id, u.email, u.name, u.phone, u.role, u.is_active, u.created_at, u.last_login_at, u.marketing_consent, u.personalization_consent,
            p.display_name, p.atmosphere, p.preferences, p.identity, h.name AS house
       FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id LEFT JOIN houses h ON h.id=p.house_id WHERE u.id=$1`, [req.params.id]);
  if (!u) throw notFound();
  const [orders, pioneer, grants] = await Promise.all([
    many('SELECT number, status, payment_status, total, is_test, created_at FROM orders WHERE user_id=$1 ORDER BY created_at DESC', [u.id]),
    one(`SELECT card_masked, holder_name, status, linked_at, last_balance, balance_synced_at FROM pioneer_links
          WHERE user_id=$1 AND provider=$2 ORDER BY (status='active') DESC, linked_at DESC LIMIT 1`, [u.id, pioneer.provider]),
    many('SELECT g.*, c.code AS coupon_code FROM reward_grants g LEFT JOIN coupons c ON c.id=g.coupon_id WHERE g.user_id=$1 ORDER BY g.created_at DESC LIMIT 50', [u.id]),
  ]);
  res.json({ item: { ...u, orders, pioneer, rewards: grants.map(publicGrant) } });
}));

r.patch('/:id', validate({ params: z.object({ id: z.string().uuid() }), body: z.object({ is_active: z.boolean().optional(), role: z.enum(['customer', 'admin']).optional() }) }), ah(async (req, res) => {
  if (req.params.id === req.user.id && (req.body.is_active === false || req.body.role === 'customer')) throw badRequest('You cannot disable or demote your own account.');
  const u = await one('UPDATE users SET is_active=COALESCE($2,is_active), role=COALESCE($3,role), updated_at=now() WHERE id=$1 RETURNING id, is_active, role',
    [req.params.id, req.body.is_active ?? null, req.body.role ?? null]);
  if (!u) throw notFound();
  if (req.body.is_active === false) await query('DELETE FROM sessions WHERE user_id=$1', [u.id]);
  await audit(req, 'update', 'users', u.id, req.body);
  res.json({ item: u });
}));

// Disconnects a customer's card (e.g. reported lost or connected to the wrong account). It never touches points:
// balances live in the Pioneer system. The customer can connect again only with a fresh card + code verification.
r.post('/:id/pioneer/unlink', validate({ params: z.object({ id: z.string().uuid() }), body: z.object({ reason: z.string().trim().min(3).max(300) }) }), ah(async (req, res) => {
  // Magical owns the link: unlink there first (an already-missing link is fine), then update the local mirror.
  try {
    await pioneer.unlink(req.params.id);
  } catch (err) {
    if (!(err instanceof MagicalApiError && err.code === 'link_not_found')) throw mapMagicalError(err);
  }
  const done = await withTransaction(async (db) => {
    const { rows: [link] } = await db.query(
      `UPDATE pioneer_links SET status='unlinked', unlinked_at=now(), upstream_session=NULL, upstream_session_expires_at=NULL
        WHERE user_id=$1 AND status='active' AND provider=$2 RETURNING id, card_masked`, [req.params.id, pioneer.provider]);
    if (!link) return { card_masked: null };
    await logLinkEvent(db, { userId: req.params.id, linkId: link.id, cardMasked: link.card_masked, event: 'admin_unlinked', actorId: req.user.id, detail: req.body.reason });
    return link;
  });
  await audit(req, 'pioneer_unlink', 'users', req.params.id, { card: done.card_masked, reason: req.body.reason });
  res.json({ ok: true });
}));

export default r;
