// Single source of truth for prices, discounts and shipping. All amounts are integer AMD.
import { config } from '../config.js';
import { loc } from '../i18n/index.js';

export const effectivePrice = (product, variant) =>
  (product.sale_price ?? product.price) + (variant?.price_delta ?? 0);

/**
 * Validate a coupon for a given subtotal/user. Returns { coupon } or { error }.
 * `db` is a pg client or pool; `email` is used for guest per-customer limits.
 */
export async function checkCoupon(db, code, { subtotal, userId, email, hasPioneer, lock = false }) {
  if (!code) return {};
  const { rows } = await db.query(`SELECT * FROM coupons WHERE code = $1 ${lock ? 'FOR UPDATE' : ''}`, [code]);
  const c = rows[0];
  const now = Date.now();
  if (!c || !c.is_active) return { error: 'This code does not exist or is no longer active.' };
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return { error: 'This code is not active yet.' };
  if (c.ends_at && new Date(c.ends_at).getTime() < now) return { error: 'This code has expired.' };
  if (c.user_id && c.user_id !== userId) return { error: 'This code belongs to another account.' };
  if (c.pioneer_only && !hasPioneer) return { error: 'This code is reserved for Magical Pioneer Card holders.' };
  if (c.max_uses != null && c.used_count >= c.max_uses) return { error: 'This code has been fully used.' };
  if (subtotal < c.min_subtotal) return { error: `This code needs a subtotal of at least ${c.min_subtotal.toLocaleString('en-US')} ֏.` };
  if (userId || email) {
    const { rows: [u] } = await db.query(
      `SELECT count(*)::int AS n FROM coupon_redemptions WHERE coupon_id = $1 AND (user_id = $2 OR email = $3)`,
      [c.id, userId ?? null, email ?? null],
    );
    if (u.n >= c.per_user_limit) return { error: 'You have already used this code.' };
  }
  return { coupon: c };
}

export function couponDiscount(coupon, subtotal) {
  if (!coupon) return 0;
  if (coupon.type === 'percent') {
    const d = Math.floor((subtotal * Math.min(coupon.value, 100)) / 100);
    return coupon.max_discount ? Math.min(d, coupon.max_discount) : d;
  }
  if (coupon.type === 'fixed') return Math.min(coupon.value, subtotal);
  return 0;
}

export function shippingCost(zone, subtotalAfterDiscount, coupon) {
  if (!zone) return 0;
  if (coupon?.type === 'free_shipping') return 0;
  if (zone.free_over != null && subtotalAfterDiscount >= zone.free_over) return 0;
  return zone.price;
}

/**
 * lines: [{ product, variant, quantity }]
 * Returns the full quote; pioneer discount is applied after coupons on the remaining subtotal.
 */
export function buildQuote({ lines, coupon, zone, hasPioneer }) {
  const items = lines.map(({ product, variant, quantity, personalization, id }) => {
    const unit = effectivePrice(product, variant);
    const lp = loc(product);
    const lv = loc(variant);
    return {
      id,
      productId: product.id,
      variantId: variant.id,
      slug: product.slug,
      name: lp.name,
      variantName: lv.name,
      baseName: product.name,
      baseVariantName: variant.name,
      i18n: { hy: { name: product.i18n?.hy?.name, variant_name: variant.i18n?.hy?.name } },
      sku: variant.sku,
      art: product.art,
      image: product.image ?? null,
      unitPrice: unit,
      compareAt: product.sale_price != null ? product.price + (variant.price_delta ?? 0) : null,
      quantity,
      personalization: personalization ?? null,
      stock: variant.stock,
      total: unit * quantity,
    };
  });
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const discount = couponDiscount(coupon, subtotal);
  const pioneerDiscount = hasPioneer ? Math.floor(((subtotal - discount) * config.PIONEER_DISCOUNT_PERCENT) / 100) : 0;
  const afterDiscounts = subtotal - discount - pioneerDiscount;
  const shipping = items.length ? shippingCost(zone, afterDiscounts, coupon) : 0;
  return {
    currency: 'AMD',
    items,
    subtotal,
    discount,
    pioneerDiscount,
    pioneerPercent: hasPioneer ? config.PIONEER_DISCOUNT_PERCENT : 0,
    shipping,
    total: afterDiscounts + shipping,
    coupon: coupon ? { code: coupon.code, type: coupon.type, value: coupon.value, description: loc(coupon).description } : null,
    freeShippingOver: zone?.free_over ?? null,
  };
}
