import { Router } from 'express';
import { z } from 'zod';
import { many, query } from '../db.js';
import { ah } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/security.js';
import { PRODUCT_CARD_SQL, productCard } from '../services/catalog.js';
import { currentLocale, loc } from '../i18n/index.js';

const r = Router();

r.get('/content/home', ah(async (_req, res) => {
  const [blocks, banners, campaigns, featured, bestsellers, limited, onSale, events] = await Promise.all([
    many('SELECT key, data, i18n FROM content_blocks'),
    many(`SELECT id, placement, title, subtitle, cta_label, cta_link, image_url, art, i18n FROM banners WHERE is_active ORDER BY sort`).then((r) => r.map((x) => loc(x))),
    many(`SELECT id, name, headline, body, coupon_code, pioneer_only, art, color, ends_at, i18n FROM campaigns
           WHERE is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()) ORDER BY created_at`).then((r) => r.map((x) => loc(x))),
    many(`${PRODUCT_CARD_SQL} WHERE p.is_active AND p.is_featured ORDER BY p.sold_count DESC LIMIT 10`),
    many(`${PRODUCT_CARD_SQL} WHERE p.is_active ORDER BY p.sold_count DESC LIMIT 8`),
    many(`${PRODUCT_CARD_SQL} WHERE p.is_active AND p.is_limited ORDER BY p.created_at DESC LIMIT 4`),
    many(`${PRODUCT_CARD_SQL} WHERE p.is_active AND p.sale_price IS NOT NULL ORDER BY (p.price - p.sale_price) DESC LIMIT 6`),
    many(`SELECT id, title, description, location, starts_at, ends_at, i18n FROM christmas_events WHERE is_active AND starts_at > now() - interval '1 day' ORDER BY starts_at LIMIT 4`).then((r) => r.map((x) => loc(x))),
  ]);
  res.json({
    blocks: Object.fromEntries(blocks.map((b) => [b.key, b.i18n?.[currentLocale()] ?? b.data])),
    banners: banners.map((b) => ({ id: b.id, placement: b.placement, title: b.title, subtitle: b.subtitle, ctaLabel: b.cta_label, ctaLink: b.cta_link, imageUrl: b.image_url, art: b.art })),
    campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, headline: c.headline, body: c.body, couponCode: c.coupon_code, pioneerOnly: c.pioneer_only, art: c.art, color: c.color, endsAt: c.ends_at })),
    featured: featured.map(productCard),
    bestsellers: bestsellers.map(productCard),
    limited: limited.map(productCard),
    onSale: onSale.map(productCard),
    events: events.map((e) => ({ id: e.id, title: e.title, description: e.description, location: e.location, startsAt: e.starts_at, endsAt: e.ends_at })),
  });
}));

r.post('/newsletter', writeLimiter, validate({ body: z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().max(80).optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please confirm you want to receive our letters' }) }),
}) }), ah(async (req, res) => {
  await query(`INSERT INTO newsletter_subscribers (email, name) VALUES ($1,$2)
               ON CONFLICT (email) DO UPDATE SET unsubscribed_at = NULL, name = COALESCE(EXCLUDED.name, newsletter_subscribers.name)`,
  [req.body.email, req.body.name ?? null]);
  res.status(201).json({ ok: true });
}));

// First-party, cookieless analytics. The client only sends this after the visitor accepts analytics.
r.post('/analytics', validate({ body: z.object({ type: z.enum(['visit']), ref: z.string().max(200).optional() }) }), ah(async (req, res) => {
  if (req.visitorId) await query('INSERT INTO analytics_events (visitor_id, user_id, type, ref) VALUES ($1,$2,$3,$4)', [req.visitorId, req.user?.id ?? null, req.body.type, req.body.ref ?? null]);
  res.status(204).end();
}));

export default r;
