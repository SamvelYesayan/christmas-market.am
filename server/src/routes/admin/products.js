import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { many, one, query, withTransaction } from '../../db.js';
import { ah, badRequest, notFound } from '../../lib/errors.js';
import { randomToken } from '../../lib/crypto.js';
import { validate } from '../../middleware/validate.js';
import { config } from '../../config.js';
import { audit } from './audit.js';
import { loc } from '../../i18n/index.js';

const r = Router();
const uploadDir = path.resolve(config.UPLOAD_DIR);

const variantSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().trim().regex(/^[A-Za-z0-9_-]{2,40}$/),
  name: z.string().trim().min(1).max(80),
  options: z.record(z.any()).default({}),
  price_delta: z.number().int().default(0),
  stock: z.number().int().min(0),
  sort: z.number().int().default(0),
  is_active: z.boolean().default(true),
  i18n: z.record(z.record(z.any())).default({}),
});

const productSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).max(80),
  name: z.string().trim().min(1).max(120),
  subtitle: z.string().max(200).nullable().optional(),
  description: z.string().max(5000).default(''),
  story: z.string().max(3000).nullable().optional(),
  category_id: z.number().int().nullable().optional(),
  price: z.number().int().min(0),
  sale_price: z.number().int().min(0).nullable().optional(),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  is_limited: z.boolean().default(false),
  is_magic: z.boolean().default(false),
  is_personalizable: z.boolean().default(false),
  tags: z.array(z.string().max(30)).max(20).default([]),
  attributes: z.record(z.array(z.string().max(30))).default({}),
  art: z.record(z.any()).default({}),
  i18n: z.record(z.record(z.any())).default({}),
  variants: z.array(variantSchema).min(1).max(50),
});
const FIELDS = Object.keys(productSchema.shape).filter((k) => k !== 'variants');
const JSON_FIELDS = ['attributes', 'art', 'i18n'];
const v = (k, x) => (JSON_FIELDS.includes(k) ? JSON.stringify(x ?? {}) : x);

r.get('/', ah(async (req, res) => {
  const params = [];
  const where = [];
  if (req.query.q) { params.push(`%${String(req.query.q).slice(0, 80)}%`); where.push(`(p.name ILIKE $${params.length} OR p.slug ILIKE $${params.length})`); }
  if (req.query.category) { params.push(String(req.query.category)); where.push(`c.slug = $${params.length}`); }
  if (req.query.lowStock === 'true') where.push('(SELECT COALESCE(SUM(stock),0) FROM product_variants WHERE product_id=p.id) < 10');
  const rows = await many(
    `SELECT p.id, p.slug, p.name, p.i18n, c.i18n AS category_i18n, p.price, p.sale_price, p.is_active, p.is_featured, p.is_limited, p.sold_count, p.art, p.is_demo,
            c.name AS category, (SELECT COALESCE(SUM(stock),0)::int FROM product_variants WHERE product_id=p.id) AS stock,
            (SELECT count(*)::int FROM product_variants WHERE product_id=p.id) AS variant_count,
            (SELECT url FROM product_images WHERE product_id=p.id ORDER BY sort LIMIT 1) AS image
       FROM products p LEFT JOIN categories c ON c.id=p.category_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.created_at DESC LIMIT 500`, params);
  res.json({ items: rows.map((x) => ({ ...loc(x), category: loc({ name: x.category, i18n: x.category_i18n }).name })) });
}));

r.get('/:id', validate({ params: z.object({ id: z.string().uuid() }) }), ah(async (req, res) => {
  const p = await one('SELECT * FROM products WHERE id=$1', [req.params.id]);
  if (!p) throw notFound();
  const [variants, images] = await Promise.all([
    many('SELECT * FROM product_variants WHERE product_id=$1 ORDER BY sort, name', [p.id]),
    many('SELECT * FROM product_images WHERE product_id=$1 ORDER BY sort', [p.id]),
  ]);
  res.json({ item: { ...p, variants, images } });
}));

async function saveVariants(db, productId, variants) {
  const keep = [];
  for (const [i, x] of variants.entries()) {
    const { rows: [row] } = x.id
      ? await db.query(
        `UPDATE product_variants SET sku=$2, name=$3, options=$4, price_delta=$5, stock=$6, sort=$7, is_active=$8, i18n=$10 WHERE id=$1 AND product_id=$9 RETURNING id`,
        [x.id, x.sku, x.name, x.options, x.price_delta, x.stock, x.sort ?? i, x.is_active, productId, x.i18n ?? {}])
      : await db.query(
        `INSERT INTO product_variants (product_id, sku, name, options, price_delta, stock, sort, is_active, i18n) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [productId, x.sku, x.name, x.options, x.price_delta, x.stock, x.sort ?? i, x.is_active, x.i18n ?? {}]);
    if (row) keep.push(row.id);
  }
  // Variants removed in the editor: delete if never ordered, otherwise deactivate to preserve order history.
  await db.query(
    `DELETE FROM product_variants WHERE product_id=$1 AND NOT (id = ANY($2::uuid[])) AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.variant_id = product_variants.id)`,
    [productId, keep]);
  await db.query(`UPDATE product_variants SET is_active=false WHERE product_id=$1 AND NOT (id = ANY($2::uuid[]))`, [productId, keep]);
}

r.post('/', validate({ body: productSchema }), ah(async (req, res) => {
  const b = req.body;
  if (b.sale_price != null && b.sale_price >= b.price) throw badRequest('Sale price must be lower than the regular price.');
  const id = await withTransaction(async (db) => {
    const { rows: [p] } = await db.query(
      `INSERT INTO products (${FIELDS.join(',')}) VALUES (${FIELDS.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`,
      FIELDS.map((k) => v(k, b[k] ?? null)));
    await saveVariants(db, p.id, b.variants);
    return p.id;
  });
  await audit(req, 'create', 'products', id, { name: b.name, price: b.price });
  res.status(201).json({ id });
}));

r.put('/:id', validate({ params: z.object({ id: z.string().uuid() }), body: productSchema.partial() }), ah(async (req, res) => {
  const b = req.body;
  await withTransaction(async (db) => {
    const { rows: [cur] } = await db.query('SELECT price, sale_price FROM products WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!cur) throw notFound();
    const price = b.price ?? cur.price;
    const sale = b.sale_price !== undefined ? b.sale_price : cur.sale_price;
    if (sale != null && sale >= price) throw badRequest('Sale price must be lower than the regular price.');
    const keys = FIELDS.filter((k) => b[k] !== undefined);
    if (keys.length) {
      await db.query(`UPDATE products SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(', ')}, updated_at=now() WHERE id=$1`,
        [req.params.id, ...keys.map((k) => v(k, b[k]))]);
    }
    if (b.variants) await saveVariants(db, req.params.id, b.variants);
  });
  await audit(req, 'update', 'products', req.params.id, { ...b, variants: b.variants?.length });
  res.json({ ok: true });
}));

r.delete('/:id', validate({ params: z.object({ id: z.string().uuid() }) }), ah(async (req, res) => {
  const ordered = await one('SELECT 1 FROM order_items WHERE product_id=$1 LIMIT 1', [req.params.id]);
  if (ordered) {
    await query('UPDATE products SET is_active=false, updated_at=now() WHERE id=$1', [req.params.id]);
    await audit(req, 'archive', 'products', req.params.id);
    return res.json({ ok: true, archived: true, message: 'This product has orders, so it was archived (hidden) instead of deleted.' });
  }
  const images = await many('SELECT url FROM product_images WHERE product_id=$1', [req.params.id]);
  const { rowCount } = await query('DELETE FROM products WHERE id=$1', [req.params.id]);
  if (!rowCount) throw notFound();
  await Promise.all(images.map((i) => fs.unlink(path.join(uploadDir, path.basename(i.url))).catch(() => {})));
  await audit(req, 'delete', 'products', req.params.id);
  res.json({ ok: true });
}));

// ───────── Images ─────────
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 10 } });

export function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buf.subarray(4, 12).toString('ascii').startsWith('ftypavif')) return 'avif';
  return null;
}

r.post('/:id/images', validate({ params: z.object({ id: z.string().uuid() }) }), upload.array('images', 10), ah(async (req, res) => {
  const p = await one('SELECT id, name FROM products WHERE id=$1', [req.params.id]);
  if (!p) throw notFound();
  if (!req.files?.length) throw badRequest('Choose at least one image.');
  await fs.mkdir(uploadDir, { recursive: true });
  const { rows: [{ max }] } = await query('SELECT COALESCE(MAX(sort), -1) AS max FROM product_images WHERE product_id=$1', [p.id]);
  const saved = [];
  for (const [i, f] of req.files.entries()) {
    const ext = sniff(f.buffer);
    if (!ext) throw badRequest(`${f.originalname} is not a JPEG, PNG, WebP or AVIF image.`);
    const name = `${randomToken(16)}.${ext}`;
    await fs.writeFile(path.join(uploadDir, name), f.buffer);
    const { rows: [img] } = await query('INSERT INTO product_images (product_id, url, alt, sort) VALUES ($1,$2,$3,$4) RETURNING *',
      [p.id, `/uploads/${name}`, p.name, max + 1 + i]);
    saved.push(img);
  }
  await audit(req, 'upload_images', 'products', p.id, { count: saved.length });
  res.status(201).json({ images: saved });
}));

r.put('/:id/images/order', validate({ params: z.object({ id: z.string().uuid() }), body: z.object({ ids: z.array(z.string().uuid()).max(50) }) }), ah(async (req, res) => {
  await withTransaction(async (db) => {
    for (const [i, id] of req.body.ids.entries()) await db.query('UPDATE product_images SET sort=$3 WHERE id=$1 AND product_id=$2', [id, req.params.id, i]);
  });
  res.json({ ok: true });
}));

r.delete('/:id/images/:imageId', validate({ params: z.object({ id: z.string().uuid(), imageId: z.string().uuid() }) }), ah(async (req, res) => {
  const img = await one('DELETE FROM product_images WHERE id=$1 AND product_id=$2 RETURNING url', [req.params.imageId, req.params.id]);
  if (!img) throw notFound();
  await fs.unlink(path.join(uploadDir, path.basename(img.url))).catch(() => {});
  await audit(req, 'delete_image', 'products', req.params.id);
  res.json({ ok: true });
}));

export default r;
