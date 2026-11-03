import { withTransaction, many } from '../db.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { buildQuote, checkCoupon } from './pricing.js';
import { findCart, loadCartLines } from './cart.js';
import { awardAchievement } from './rewards.js';
import { getProvider } from '../integrations/payments/index.js';
import { currentLocale, loc, tr } from '../i18n/index.js';

export const ORDER_STATUSES = ['pending_payment', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

export async function hasActivePioneer(db, userId) {
  if (!userId) return false;
  const { rows } = await db.query(`SELECT 1 FROM pioneer_links WHERE user_id=$1 AND status='active'`, [userId]);
  return rows.length > 0;
}

/**
 * Creates an order from the current cart in one transaction: locks variants, checks stock, applies coupon
 * and Pioneer discount, reserves stock, records coupon use and empties the cart.
 */
export async function createOrderFromCart(req, input) {
  const provider = getProvider(input.paymentMethod);
  if (!provider) throw badRequest('This payment method is not available.', 'payment_unavailable');

  return withTransaction(async (db) => {
    const cart = await findCart(db, req);
    if (!cart) throw badRequest('Your sleigh is empty.', 'empty_cart');
    const lines = await loadCartLines(db, cart.id, { lock: true });
    if (!lines.length) throw badRequest('Your sleigh is empty.', 'empty_cart');

    for (const l of lines) {
      if (!l.product.is_active || !l.variant.is_active) throw conflict(`${loc(l.product).name} is no longer available.`, 'unavailable_item');
      if (l.variant.stock < l.quantity) {
        throw conflict(`Only ${l.variant.stock} × ${loc(l.product).name} (${loc(l.variant).name}) left.`, 'insufficient_stock');
      }
    }

    const { rows: [zone] } = await db.query('SELECT * FROM shipping_zones WHERE code=$1 AND is_active', [input.delivery.zone]);
    if (!zone) throw badRequest('Please choose a delivery option.', 'invalid_zone');
    if (zone.requires_address && !(input.delivery.city && input.delivery.address)) {
      throw badRequest('Please enter a delivery address.', 'address_required');
    }

    const userId = req.user?.id ?? null;
    const hasPioneer = await hasActivePioneer(db, userId);
    const subtotal = lines.reduce((s, l) => s + ((l.product.sale_price ?? l.product.price) + l.variant.price_delta) * l.quantity, 0);
    const code = input.couponCode ?? cart.coupon_code ?? null;
    let coupon = null;
    if (code) {
      const r = await checkCoupon(db, code, { subtotal, userId, email: input.customer.email, hasPioneer, lock: true });
      if (r.error) throw badRequest(r.error, 'invalid_coupon');
      coupon = r.coupon;
    }
    const quote = buildQuote({ lines, coupon, zone, hasPioneer });
    const isOnline = provider.kind !== 'offline';

    const { rows: [{ n }] } = await db.query(`SELECT nextval('order_number_seq') AS n`);
    const number = `XM-${new Date().getFullYear() % 100}${String(n).padStart(5, '0')}`;
    const { rows: [order] } = await db.query(
      `INSERT INTO orders (number, user_id, status, payment_status, payment_method, is_test, subtotal, discount, pioneer_discount,
                           shipping, total, coupon_code, customer, delivery, gift_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [number, userId, isOnline ? 'pending_payment' : 'confirmed', isOnline ? 'unpaid' : 'cod', provider.code, !!provider.isTest,
        quote.subtotal, quote.discount, quote.pioneerDiscount, quote.shipping, quote.total, coupon?.code ?? null,
        input.customer, { ...input.delivery, zoneName: zone.name, eta: zone.eta, i18n: { hy: { zoneName: zone.i18n?.hy?.name, eta: zone.i18n?.hy?.eta } } }, input.giftMessage ?? null],
    );

    for (const it of quote.items) {
      await db.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, name, variant_name, sku, unit_price, quantity, total, personalization, i18n)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [order.id, it.productId, it.variantId, it.baseName, it.baseVariantName, it.sku, it.unitPrice, it.quantity, it.total, it.personalization, it.i18n ?? {}],
      );
      await db.query('UPDATE product_variants SET stock = stock - $1 WHERE id = $2', [it.quantity, it.variantId]);
      await db.query('UPDATE products SET sold_count = sold_count + $1 WHERE id = $2', [it.quantity, it.productId]);
    }
    if (coupon) {
      await db.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = $1', [coupon.id]);
      await db.query('INSERT INTO coupon_redemptions (coupon_id, user_id, order_id, email) VALUES ($1,$2,$3,$4)',
        [coupon.id, userId, order.id, input.customer.email]);
    }
    await db.query('INSERT INTO order_status_history (order_id, status, note) VALUES ($1,$2,$3)',
      [order.id, order.status, isOnline ? 'Order placed, awaiting payment' : 'Order placed — pay on delivery']);
    await db.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);
    await db.query('UPDATE carts SET coupon_code = NULL, updated_at = now() WHERE id = $1', [cart.id]);

    let payment = null;
    if (isOnline) {
      ({ rows: [payment] } = await db.query(
        `INSERT INTO payments (order_id, provider, amount, is_test) VALUES ($1,$2,$3,$4) RETURNING *`,
        [order.id, provider.code, order.total, !!provider.isTest],
      ));
    }
    if (!isOnline && !order.is_test) {
      await db.query(`INSERT INTO analytics_events (visitor_id, user_id, type, ref) VALUES ($1,$2,'purchase',$3)`,
        [req.visitorId ?? 'unknown', userId, order.number]);
    }
    const achievement = userId ? await awardAchievement(db, userId, 'first_order') : null;
    return { order, payment, achievement };
  });
}

/** Starts (or restarts) an online payment for an order. Returns provider instructions. */
export async function startPayment(order) {
  const provider = getProvider(order.payment_method);
  if (!provider) throw badRequest('This payment method is no longer available.', 'payment_unavailable');
  if (provider.kind === 'offline') return { type: 'offline' };
  if (order.payment_status === 'paid') throw conflict('This order is already paid.', 'already_paid');
  if (order.status !== 'pending_payment') throw conflict('This order can no longer be paid.', 'not_payable');

  const payment = await withTransaction(async (db) => {
    const { rows: [p] } = await db.query(
      `INSERT INTO payments (order_id, provider, amount, is_test) VALUES ($1,$2,$3,$4) RETURNING *`,
      [order.id, provider.code, order.total, !!provider.isTest],
    );
    await db.query(`UPDATE orders SET payment_status='pending', updated_at=now() WHERE id=$1`, [order.id]);
    return p;
  });
  try {
    const instructions = await provider.createPayment({ order, payment });
    await withTransaction((db) => db.query(
      `UPDATE payments SET status='pending', provider_ref=COALESCE($2, provider_ref), updated_at=now() WHERE id=$1`,
      [payment.id, instructions.providerRef ?? null],
    ));
    return { ...instructions, paymentId: payment.id, isTest: !!provider.isTest };
  } catch (err) {
    logger.error({ err: err.message, order: order.number }, 'payment start failed');
    await withTransaction(async (db) => {
      await db.query(`UPDATE payments SET status='failed', raw=$2, updated_at=now() WHERE id=$1`, [payment.id, { error: err.message }]);
      await db.query(`UPDATE orders SET payment_status='failed', updated_at=now() WHERE id=$1`, [order.id]);
    });
    throw badRequest('We could not reach the payment provider. Please try again or choose another method.', 'payment_start_failed');
  }
}

/** Apply a confirmed provider result. Idempotent: a succeeded payment is never downgraded. */
export async function applyPaymentResult(paymentId, { status, providerRef, raw, amount }) {
  return withTransaction(async (db) => {
    const { rows: [p] } = await db.query('SELECT * FROM payments WHERE id=$1 FOR UPDATE', [paymentId]);
    if (!p) throw notFound('Payment not found.');
    const { rows: [order] } = await db.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [p.order_id]);
    if (p.status === 'succeeded') return { payment: p, order };
    if (status === 'succeeded' && amount != null && amount !== p.amount) {
      logger.error({ paymentId, amount, expected: p.amount }, 'payment amount mismatch');
      status = 'failed';
    }
    await db.query('UPDATE payments SET status=$2, provider_ref=COALESCE($3, provider_ref), raw=$4, updated_at=now() WHERE id=$1',
      [p.id, status, providerRef ?? null, raw ?? null]);
    if (status === 'succeeded') {
      const newStatus = order.status === 'pending_payment' ? 'confirmed' : order.status;
      await db.query(`UPDATE orders SET payment_status='paid', status=$2, updated_at=now() WHERE id=$1`, [order.id, newStatus]);
      await db.query('INSERT INTO order_status_history (order_id, status, note) VALUES ($1,$2,$3)',
        [order.id, newStatus, p.is_test ? 'TEST payment approved (no real money)' : `Payment received via ${p.provider}`]);
      if (!p.is_test) {
        await db.query(`INSERT INTO analytics_events (visitor_id, user_id, type, ref) VALUES ('server',$1,'purchase',$2)`, [order.user_id, order.number]);
      }
    } else if (status === 'failed' || status === 'cancelled') {
      await db.query(`UPDATE orders SET payment_status='failed', updated_at=now() WHERE id=$1 AND payment_status <> 'paid'`, [order.id]);
    }
    const { rows: [fresh] } = await db.query('SELECT * FROM orders WHERE id=$1', [order.id]);
    return { payment: { ...p, status }, order: fresh };
  });
}

/** Cancel an order and return reserved stock (if it had not shipped). */
export async function cancelOrder(db, order, { actorId = null, note = 'Order cancelled' } = {}) {
  if (['cancelled', 'refunded', 'shipped', 'delivered'].includes(order.status)) return false;
  const items = (await db.query('SELECT * FROM order_items WHERE order_id=$1', [order.id])).rows;
  for (const it of items) {
    if (it.variant_id) await db.query('UPDATE product_variants SET stock = stock + $1 WHERE id=$2', [it.quantity, it.variant_id]);
    if (it.product_id) await db.query('UPDATE products SET sold_count = GREATEST(0, sold_count - $1) WHERE id=$2', [it.quantity, it.product_id]);
  }
  await db.query(`UPDATE orders SET status='cancelled', updated_at=now() WHERE id=$1`, [order.id]);
  await db.query('INSERT INTO order_status_history (order_id, status, note, actor_id) VALUES ($1,$2,$3,$4)', [order.id, 'cancelled', note, actorId]);
  return true;
}

/** Releases stock held by online orders that were never paid. */
export async function expireUnpaidOrders() {
  const stale = await many(
    `SELECT id FROM orders WHERE status='pending_payment' AND (
       (payment_status IN ('unpaid','failed') AND created_at < now() - interval '60 minutes') OR
       (payment_status = 'pending' AND created_at < now() - interval '24 hours'))
     LIMIT 100`,
  );
  for (const { id } of stale) {
    await withTransaction(async (db) => {
      const { rows: [o] } = await db.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [id]);
      if (o?.status === 'pending_payment' && o.payment_status !== 'paid') await cancelOrder(db, o, { note: 'Payment not completed in time — stock released' });
    });
  }
  if (stale.length) logger.info({ count: stale.length }, 'expired unpaid orders');
}

export async function orderWithDetails(db, orderId) {
  const { rows: [order] } = await db.query('SELECT * FROM orders WHERE id=$1', [orderId]);
  if (!order) return null;
  const items = (await db.query(
    `SELECT oi.*, p.slug, p.art, (SELECT url FROM product_images pi WHERE pi.product_id = oi.product_id ORDER BY sort LIMIT 1) AS image
       FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE order_id=$1`, [orderId])).rows;
  const history = (await db.query('SELECT status, note, created_at FROM order_status_history WHERE order_id=$1 ORDER BY created_at', [orderId])).rows;
  const payments = (await db.query('SELECT id, provider, amount, status, is_test, created_at FROM payments WHERE order_id=$1 ORDER BY created_at', [orderId])).rows;
  return { ...order, items, history, payments };
}

export const publicOrder = (o) => ({
  number: o.number,
  status: o.status,
  paymentStatus: o.payment_status,
  paymentMethod: o.payment_method,
  isTest: o.is_test,
  currency: o.currency,
  subtotal: o.subtotal,
  discount: o.discount,
  pioneerDiscount: o.pioneer_discount,
  shipping: o.shipping,
  total: o.total,
  couponCode: o.coupon_code,
  customer: o.customer,
  delivery: { ...o.delivery, ...(o.delivery?.i18n?.[currentLocale()] ? Object.fromEntries(Object.entries(o.delivery.i18n[currentLocale()]).filter(([, v]) => v)) : {}), i18n: undefined },
  giftMessage: o.gift_message,
  trackingCode: o.tracking_code,
  createdAt: o.created_at,
  items: o.items?.map((x) => loc(x)).map((i) => ({
    name: i.name, variantName: i.variant_name, sku: i.sku, unitPrice: i.unit_price, quantity: i.quantity, total: i.total,
    personalization: i.personalization, slug: i.slug, art: i.art, image: i.image,
  })),
  history: o.history?.map((h) => ({ ...h, note: tr(h.note) })),
  payments: o.payments?.map((p) => ({ provider: p.provider, amount: p.amount, status: p.status, isTest: p.is_test, createdAt: p.created_at })),
});
