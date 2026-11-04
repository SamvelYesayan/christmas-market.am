import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../../db.js';
import { ah } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';

const r = Router();

// Revenue counts real (non-test) orders that are paid or cash-on-delivery and not cancelled/refunded.
const REVENUE = `NOT o.is_test AND o.payment_status IN ('paid','cod') AND o.status NOT IN ('cancelled','refunded')`;

r.get('/', validate({ query: z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }) }), ah(async (req, res) => {
  const days = req.query.days;
  const since = `now() - interval '${days} days'`;
  const [totals, prev, byDay, popular, customers, houses, funnel, statuses, lowStock, pioneer] = await Promise.all([
    one(`SELECT COALESCE(SUM(total),0)::int AS revenue, count(*)::int AS orders, COALESCE(ROUND(AVG(total)),0)::int AS aov,
                COALESCE(SUM(discount + pioneer_discount),0)::int AS discounts
           FROM orders o WHERE ${REVENUE} AND o.created_at >= ${since}`),
    one(`SELECT COALESCE(SUM(total),0)::int AS revenue, count(*)::int AS orders FROM orders o
          WHERE ${REVENUE} AND o.created_at >= now() - interval '${days * 2} days' AND o.created_at < ${since}`),
    many(`SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(SUM(o.total),0)::int AS revenue, count(o.id)::int AS orders
            FROM generate_series((${since})::date, now()::date, interval '1 day') d
            LEFT JOIN orders o ON o.created_at::date = d::date AND ${REVENUE}
           GROUP BY d ORDER BY d`),
    many(`SELECT oi.name, p.slug, SUM(oi.quantity)::int AS units, SUM(oi.total)::int AS revenue
            FROM order_items oi JOIN orders o ON o.id=oi.order_id LEFT JOIN products p ON p.id=oi.product_id
           WHERE ${REVENUE} AND o.created_at >= ${since} GROUP BY oi.name, p.slug ORDER BY units DESC LIMIT 10`),
    one(`SELECT count(*)::int AS total,
                count(*) FILTER (WHERE created_at >= ${since})::int AS new,
                (SELECT count(DISTINCT user_id)::int FROM orders o WHERE ${REVENUE} AND user_id IS NOT NULL) AS buyers,
                (SELECT count(*)::int FROM (SELECT user_id FROM orders o WHERE ${REVENUE} AND user_id IS NOT NULL GROUP BY user_id HAVING count(*) > 1) x) AS repeat_buyers,
                (SELECT count(*)::int FROM newsletter_subscribers WHERE unsubscribed_at IS NULL) AS subscribers
           FROM users WHERE role='customer'`),
    many(`SELECT h.name, h.color, count(p.user_id)::int AS members FROM houses h LEFT JOIN user_profiles p ON p.house_id=h.id GROUP BY h.id ORDER BY h.id`),
    many(`SELECT type, count(DISTINCT visitor_id)::int AS visitors FROM analytics_events WHERE created_at >= ${since} GROUP BY type`),
    many(`SELECT status, count(*)::int AS n FROM orders WHERE NOT is_test AND created_at >= ${since} GROUP BY status`),
    many(`SELECT p.name, v.name AS variant, v.sku, v.stock FROM product_variants v JOIN products p ON p.id=v.product_id
           WHERE p.is_active AND v.is_active AND v.stock < 5 ORDER BY v.stock LIMIT 10`),
    one(`SELECT count(*) FILTER (WHERE status='active' AND provider='magical')::int AS linked,
                (SELECT COALESCE(SUM(points),0)::int FROM reward_grants WHERE created_at >= ${since}) AS stardust_awarded,
                (SELECT count(*)::int FROM pioneer_redemptions WHERE status='completed' AND created_at >= ${since}) AS redemptions
           FROM pioneer_links`),
  ]);
  const f = Object.fromEntries(funnel.map((x) => [x.type, x.visitors]));
  const visits = f.visit ?? 0;
  res.json({
    days,
    revenue: totals.revenue,
    orders: totals.orders,
    aov: totals.aov,
    discounts: totals.discounts,
    previous: prev,
    byDay,
    popular,
    customers,
    houses,
    statuses,
    lowStock,
    pioneer,
    funnel: {
      visits,
      productViews: f.product_view ?? 0,
      addToCart: f.add_to_cart ?? 0,
      checkout: f.checkout_start ?? 0,
      purchases: totals.orders,
      conversionRate: visits ? Number(((totals.orders / visits) * 100).toFixed(2)) : null,
    },
  });
}));

export default r;
