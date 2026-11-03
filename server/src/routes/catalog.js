import { Router } from 'express';
import { z } from 'zod';
import { one, many, query } from '../db.js';
import { ah, notFound, unauthorized } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/security.js';
import { PRODUCT_CARD_SQL, productCard } from '../services/catalog.js';
import { giftFinder } from '../services/recommend.js';
import { loc, tr } from '../i18n/index.js';

const r = Router();

r.get('/categories', ah(async (_req, res) => {
  const rows = await many(
    `SELECT c.slug, c.name, c.tagline, c.description, c.art, c.color, c.i18n,
            (SELECT count(*)::int FROM products p WHERE p.category_id = c.id AND p.is_active) AS product_count
       FROM categories c WHERE c.is_active ORDER BY c.sort, c.name`);
  res.json({ categories: rows.map((x) => loc(x)).map((c) => ({ ...c, i18n: undefined, productCount: c.product_count, product_count: undefined })) });
}));

const listSchema = z.object({
  category: z.string().max(60).optional(),
  q: z.string().trim().max(80).optional(),
  tag: z.string().max(40).optional(),
  featured: z.enum(['true', 'false']).optional(),
  limited: z.enum(['true', 'false']).optional(),
  magic: z.enum(['true', 'false']).optional(),
  onSale: z.enum(['true', 'false']).optional(),
  min: z.coerce.number().int().min(0).optional(),
  max: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['popular', 'price_asc', 'price_desc', 'new', 'name']).default('popular'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

r.get('/products', validate({ query: listSchema }), ah(async (req, res) => {
  const q = req.query;
  const where = ['p.is_active'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
  if (q.category) add('c.slug = ?', q.category);
  if (q.q) {
    params.push(q.q);
    const i = params.length;
    where.push(`(p.name ILIKE '%' || $${i} || '%' OR p.subtitle ILIKE '%' || $${i} || '%' OR lower($${i}) = ANY(p.tags))`);
  }
  if (q.tag) add('? = ANY(p.tags)', q.tag);
  if (q.featured === 'true') where.push('p.is_featured');
  if (q.limited === 'true') where.push('p.is_limited');
  if (q.magic === 'true') where.push('p.is_magic');
  if (q.onSale === 'true') where.push('p.sale_price IS NOT NULL');
  if (q.min != null) add('COALESCE(p.sale_price, p.price) >= ?', q.min);
  if (q.max != null) add('COALESCE(p.sale_price, p.price) <= ?', q.max);
  const order = {
    popular: 'p.sold_count DESC, p.is_featured DESC',
    price_asc: 'COALESCE(p.sale_price, p.price) ASC',
    price_desc: 'COALESCE(p.sale_price, p.price) DESC',
    new: 'p.created_at DESC',
    name: 'p.name ASC',
  }[q.sort];
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const total = await one(`SELECT count(*)::int AS n FROM products p LEFT JOIN categories c ON c.id=p.category_id ${whereSql}`, params);
  params.push(q.limit, (q.page - 1) * q.limit);
  const rows = await many(`${PRODUCT_CARD_SQL} ${whereSql} ORDER BY ${order}, p.id LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  res.json({ products: rows.map(productCard), total: total.n, page: q.page, pages: Math.ceil(total.n / q.limit) });
}));

r.get('/products/:slug', ah(async (req, res) => {
  const p = await one(`${PRODUCT_CARD_SQL} WHERE p.slug = $1 AND p.is_active`, [req.params.slug]);
  if (!p) throw notFound('This gift has wandered off.');
  const full = loc(await one('SELECT description, story, i18n FROM products WHERE id=$1', [p.id]));
  const [variants, images, reviews, related] = await Promise.all([
    many('SELECT id, sku, name, options, price_delta, stock, i18n FROM product_variants WHERE product_id=$1 AND is_active ORDER BY sort, name', [p.id]).then((r) => r.map((x) => loc(x))),
    many('SELECT id, url, alt FROM product_images WHERE product_id=$1 ORDER BY sort', [p.id]),
    many('SELECT author_name, city, rating, body, created_at FROM reviews WHERE product_id=$1 AND is_approved ORDER BY created_at DESC LIMIT 20', [p.id]),
    many(`${PRODUCT_CARD_SQL} WHERE p.is_active AND p.id <> $1 AND (p.category_id = $2 OR p.tags && $3)
          ORDER BY (p.category_id = $2) DESC, p.sold_count DESC LIMIT 8`, [p.id, p.category_id, p.tags]),
  ]);
  let wished = false;
  if (req.user) wished = !!(await one('SELECT 1 FROM wishlists WHERE user_id=$1 AND product_id=$2', [req.user.id, p.id]));
  if (req.visitorId) {
    query(`INSERT INTO analytics_events (visitor_id, user_id, type, ref) VALUES ($1,$2,'product_view',$3)`, [req.visitorId, req.user?.id ?? null, p.slug]).catch(() => {});
  }
  res.json({
    product: {
      ...productCard(p),
      description: full.description,
      story: full.story,
      attributes: p.attributes,
      variants: variants.map((v) => ({ id: v.id, sku: v.sku, name: v.name, options: v.options, priceDelta: v.price_delta, stock: v.stock })),
      images,
      reviews: reviews.map((x) => ({ author: x.author_name, city: x.city, rating: x.rating, body: x.body, createdAt: x.created_at })),
      wished,
    },
    related: related.map(productCard),
  });
}));

const reviewSchema = z.object({ rating: z.number().int().min(1).max(5), body: z.string().trim().min(10).max(1500) });

r.post('/products/:slug/reviews', writeLimiter, validate({ body: reviewSchema }), ah(async (req, res) => {
  if (!req.user) throw unauthorized('Please sign in to leave a review.');
  const p = await one('SELECT id FROM products WHERE slug=$1', [req.params.slug]);
  if (!p) throw notFound();
  await query(`INSERT INTO reviews (product_id, user_id, author_name, rating, body) VALUES ($1,$2,$3,$4,$5)`,
    [p.id, req.user.id, req.user.name, req.body.rating, req.body.body]);
  res.status(201).json({ ok: true, message: tr('Thank you! Your review will appear after our elves read it.') });
}));

const finderSchema = z.object({
  recipient: z.enum(['child', 'teen', 'partner', 'parent', 'grandparent', 'friend', 'colleague', 'self']).optional(),
  age: z.enum(['kids', 'teens', 'adults', 'seniors']).optional(),
  interests: z.array(z.string().max(20)).max(6).default([]),
  budget: z.object({ min: z.number().int().min(0), max: z.number().int().min(0) }).optional(),
  personality: z.string().max(20).optional(),
  occasion: z.string().max(20).optional(),
});

r.post('/gift-finder', validate({ body: finderSchema }), ah(async (req, res) => {
  const results = await giftFinder(req.body);
  res.json({ products: results.map(productCard) });
}));

r.get('/reviews/highlights', ah(async (_req, res) => {
  const rows = await many(
    `SELECT r.author_name, r.city, r.rating, r.body, p.name AS product_name, p.slug, p.art, p.i18n
       FROM reviews r LEFT JOIN products p ON p.id = r.product_id
      WHERE r.is_approved AND r.rating >= 4 ORDER BY r.created_at DESC LIMIT 8`);
  res.json({ reviews: rows.map((x) => ({ author: x.author_name, city: x.city, rating: x.rating, body: x.body, product: x.slug ? { name: loc({ name: x.product_name, i18n: x.i18n }).name, slug: x.slug, art: x.art } : null })) });
}));

export default r;
