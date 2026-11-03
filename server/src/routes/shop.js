// Wishlist, cart and checkout.
import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { one, many, pool, query, withTransaction } from '../db.js';
import { ah, badRequest, notFound } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/security.js';
import { PRODUCT_CARD_SQL, productCard } from '../services/catalog.js';
import { findCart, getOrCreateCart, loadCartLines } from '../services/cart.js';
import { buildQuote, checkCoupon } from '../services/pricing.js';
import { awardAchievement } from '../services/rewards.js';
import { createOrderFromCart, hasActivePioneer, orderWithDetails, publicOrder, startPayment } from '../services/orders.js';
import { listPaymentMethods } from '../integrations/payments/index.js';
import { loc } from '../i18n/index.js';

const r = Router();

// ───────── Wishlist ─────────
r.get('/wishlist', requireAuth, ah(async (req, res) => {
  const rows = await many(`${PRODUCT_CARD_SQL} JOIN wishlists w ON w.product_id = p.id WHERE w.user_id = $1 ORDER BY w.created_at DESC`, [req.user.id]);
  res.json({ products: rows.map(productCard) });
}));

r.post('/wishlist/:productId', requireAuth, validate({ params: z.object({ productId: z.string().uuid() }) }), ah(async (req, res) => {
  const achievement = await withTransaction(async (db) => {
    await db.query('INSERT INTO wishlists (user_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, req.params.productId]);
    const { rows: [c] } = await db.query('SELECT count(*)::int AS n FROM wishlists WHERE user_id=$1', [req.user.id]);
    return c.n >= 5 ? awardAchievement(db, req.user.id, 'wish_maker') : null;
  });
  res.status(201).json({ ok: true, achievement });
}));

r.delete('/wishlist/:productId', requireAuth, validate({ params: z.object({ productId: z.string().uuid() }) }), ah(async (req, res) => {
  await query('DELETE FROM wishlists WHERE user_id=$1 AND product_id=$2', [req.user.id, req.params.productId]);
  res.json({ ok: true });
}));

// ───────── Cart ─────────
async function cartResponse(db, req, cart, zoneCode) {
  if (!cart) return { items: [], subtotal: 0, discount: 0, pioneerDiscount: 0, shipping: 0, total: 0, currency: 'AMD', coupon: null, count: 0 };
  const lines = await loadCartLines(db, cart.id);
  const hasPioneer = await hasActivePioneer(db, req.user?.id);
  const subtotal = lines.reduce((s, l) => s + ((l.product.sale_price ?? l.product.price) + l.variant.price_delta) * l.quantity, 0);
  let coupon = null;
  let couponError = null;
  if (cart.coupon_code) {
    const c = await checkCoupon(db, cart.coupon_code, { subtotal, userId: req.user?.id, hasPioneer });
    coupon = c.coupon ?? null;
    couponError = c.error ?? null;
  }
  const zone = zoneCode ? (await db.query('SELECT * FROM shipping_zones WHERE code=$1 AND is_active', [zoneCode])).rows[0] : null;
  const quote = buildQuote({ lines, coupon, zone, hasPioneer });
  return { ...quote, count: quote.items.reduce((s, i) => s + i.quantity, 0), couponError, pendingCoupon: couponError ? cart.coupon_code : null, hasPioneer };
}

r.get('/cart', ah(async (req, res) => {
  const cart = await findCart(pool, req);
  res.json(await cartResponse(pool, req, cart, req.query.zone));
}));

const addSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(50).default(1),
  personalization: z.string().trim().max(60).optional().transform((v) => v || null),
});

r.post('/cart/items', writeLimiter, validate({ body: addSchema }), ah(async (req, res) => {
  const { variantId, quantity, personalization } = req.body;
  const v = await one(
    `SELECT v.*, p.is_active AS product_active, p.is_personalizable FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=$1`,
    [variantId],
  );
  if (!v || !v.is_active || !v.product_active) throw notFound('This gift is no longer available.');
  if (personalization && !v.is_personalizable) throw badRequest('This gift cannot be personalised.');
  const cart = await getOrCreateCart(pool, req, res);
  const existing = await one('SELECT quantity FROM cart_items WHERE cart_id=$1 AND variant_id=$2 AND personalization IS NOT DISTINCT FROM $3', [cart.id, variantId, personalization]);
  const next = (existing?.quantity ?? 0) + quantity;
  if (next > v.stock) throw badRequest(v.stock ? `Only ${v.stock} left in stock.` : 'Sold out — the elves are making more.', 'insufficient_stock');
  if (existing) {
    await query('UPDATE cart_items SET quantity=$4 WHERE cart_id=$1 AND variant_id=$2 AND personalization IS NOT DISTINCT FROM $3', [cart.id, variantId, personalization, Math.min(50, next)]);
  } else {
    await query('INSERT INTO cart_items (cart_id, variant_id, quantity, personalization) VALUES ($1,$2,$3,$4)', [cart.id, variantId, quantity, personalization]);
  }
  await query('UPDATE carts SET updated_at=now() WHERE id=$1', [cart.id]);
  if (req.visitorId) query(`INSERT INTO analytics_events (visitor_id, user_id, type, ref) VALUES ($1,$2,'add_to_cart',$3)`, [req.visitorId, req.user?.id ?? null, v.sku]).catch(() => {});
  res.status(201).json(await cartResponse(pool, req, cart));
}));

r.patch('/cart/items/:id', validate({ params: z.object({ id: z.string().uuid() }), body: z.object({ quantity: z.number().int().min(1).max(50) }) }), ah(async (req, res) => {
  const cart = await findCart(pool, req);
  if (!cart) throw notFound();
  const item = await one(`SELECT ci.*, v.stock FROM cart_items ci JOIN product_variants v ON v.id=ci.variant_id WHERE ci.id=$1 AND ci.cart_id=$2`, [req.params.id, cart.id]);
  if (!item) throw notFound();
  if (req.body.quantity > item.stock) throw badRequest(`Only ${item.stock} left in stock.`, 'insufficient_stock');
  await query('UPDATE cart_items SET quantity=$1 WHERE id=$2', [req.body.quantity, item.id]);
  res.json(await cartResponse(pool, req, cart));
}));

r.delete('/cart/items/:id', validate({ params: z.object({ id: z.string().uuid() }) }), ah(async (req, res) => {
  const cart = await findCart(pool, req);
  if (cart) await query('DELETE FROM cart_items WHERE id=$1 AND cart_id=$2', [req.params.id, cart.id]);
  res.json(await cartResponse(pool, req, cart));
}));

r.post('/cart/coupon', writeLimiter, validate({ body: z.object({ code: z.string().trim().min(3).max(40) }) }), ah(async (req, res) => {
  const cart = await getOrCreateCart(pool, req, res);
  const lines = await loadCartLines(pool, cart.id);
  const subtotal = lines.reduce((s, l) => s + ((l.product.sale_price ?? l.product.price) + l.variant.price_delta) * l.quantity, 0);
  const result = await checkCoupon(pool, req.body.code, { subtotal, userId: req.user?.id, hasPioneer: await hasActivePioneer(pool, req.user?.id) });
  if (result.error) throw badRequest(result.error, 'invalid_coupon');
  await query('UPDATE carts SET coupon_code=$1 WHERE id=$2', [result.coupon.code, cart.id]);
  res.json(await cartResponse(pool, req, { ...cart, coupon_code: result.coupon.code }));
}));

r.delete('/cart/coupon', ah(async (req, res) => {
  const cart = await findCart(pool, req);
  if (cart) await query('UPDATE carts SET coupon_code=NULL WHERE id=$1', [cart.id]);
  res.json(await cartResponse(pool, req, cart && { ...cart, coupon_code: null }));
}));

// ───────── Checkout ─────────
r.get('/checkout/options', ah(async (req, res) => {
  const zones = (await many('SELECT code, name, description, price, free_over, eta, requires_address, i18n FROM shipping_zones WHERE is_active ORDER BY sort')).map((x) => loc(x));
  if (req.visitorId) query(`INSERT INTO analytics_events (visitor_id, user_id, type) VALUES ($1,$2,'checkout_start')`, [req.visitorId, req.user?.id ?? null]).catch(() => {});
  res.json({
    zones: zones.map((z) => ({ code: z.code, name: z.name, description: z.description, price: z.price, freeOver: z.free_over, eta: z.eta, requiresAddress: z.requires_address })),
    paymentMethods: listPaymentMethods(),
    upcomingPaymentMethods: listPaymentMethods({ includeUnavailable: true }).filter((m) => !m.available && !m.isTest).map((m) => m.label),
    currency: 'AMD',
  });
}));

r.get('/checkout/quote', validate({ query: z.object({ zone: z.string().max(40).optional() }) }), ah(async (req, res) => {
  const cart = await findCart(pool, req);
  res.json(await cartResponse(pool, req, cart, req.query.zone));
}));

const phone = z.string().trim().regex(/^\+?[0-9 ()-]{6,20}$/, 'Please enter a valid phone number');
const orderSchema = z.object({
  customer: z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().toLowerCase().email().max(200), phone }),
  delivery: z.object({
    zone: z.string().max(40),
    city: z.string().trim().max(80).optional(),
    address: z.string().trim().max(300).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes: z.string().trim().max(500).optional(),
  }),
  paymentMethod: z.string().max(40),
  couponCode: z.string().trim().max(40).optional(),
  giftMessage: z.string().trim().max(300).optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Please accept the terms of sale' }) }),
});

r.post('/orders', writeLimiter, validate({ body: orderSchema }), ah(async (req, res) => {
  const { order, achievement } = await createOrderFromCart(req, req.body);
  let payment = { type: 'offline' };
  let paymentError = null;
  if (order.status === 'pending_payment') {
    try {
      payment = await startPayment(order);
    } catch (err) {
      paymentError = err.message;
    }
  }
  res.status(201).json({ order: publicOrder(await orderWithDetails(pool, order.id)), payment, paymentError, achievement, accessKey: orderAccessKey(order) });
}));

// Guests access their order with number + email, or with the access key returned at creation.
const orderAccessKey = (o) => crypto.createHash('sha256').update(`${o.id}:${o.customer.email}`).digest('hex').slice(0, 24);

async function findAccessibleOrder(req, number) {
  const o = await one('SELECT * FROM orders WHERE number=$1', [number]);
  if (!o) return null;
  if (req.user && (o.user_id === req.user.id || req.user.role === 'admin')) return o;
  const key = req.query.key ?? req.body?.key;
  const email = (req.query.email ?? req.body?.email ?? '').toString().trim().toLowerCase();
  if (key && key === orderAccessKey(o)) return o;
  if (email && email === String(o.customer.email).toLowerCase()) return o;
  return null;
}

r.get('/orders', requireAuth, ah(async (req, res) => {
  const rows = await many('SELECT id FROM orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
  const orders = await Promise.all(rows.map((o) => orderWithDetails(pool, o.id)));
  res.json({ orders: orders.map(publicOrder) });
}));

r.get('/orders/:number', validate({ params: z.object({ number: z.string().max(20) }) }), ah(async (req, res) => {
  const o = await findAccessibleOrder(req, req.params.number);
  if (!o) throw notFound('We could not find that order. Check the number and email.');
  res.json({ order: publicOrder(await orderWithDetails(pool, o.id)) });
}));

r.post('/orders/:number/pay', writeLimiter, ah(async (req, res) => {
  const o = await findAccessibleOrder(req, req.params.number);
  if (!o) throw notFound();
  res.json({ payment: await startPayment(o) });
}));

export default r;
