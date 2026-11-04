// Admin visibility into Pioneer Card connections. Read-only by design: points and card data belong to the
// Pioneer system and are adjusted (with its own audit trail) in the Pioneer admin, never from the store.
// Disconnecting a card is done per customer (POST /admin/customers/:id/pioneer/unlink, reason required).
import { Router } from 'express';
import { many, one } from '../../db.js';
import { ah } from '../../lib/errors.js';
import { pioneer, pioneerHealth, checkPioneerConnection } from '../../integrations/pioneer/index.js';
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

// Re-run the key check (GET /me) on demand.
r.post('/check', ah(async (_req, res) => res.json({ health: await checkPioneerConnection() })));

export default r;
