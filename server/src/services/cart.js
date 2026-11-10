// Carts are identified by the signed-in user, or by an opaque cookie token for guests.
// On sign-in the guest cart is merged into the user's cart.
import { isProd } from '../config.js';
import { randomToken, sha256 } from '../lib/crypto.js';
import { isMobileClient } from '../middleware/auth.js';

export const CART_COOKIE = 'mc_cart';

const cartCookieOpts = { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/', maxAge: 60 * 86400 * 1000 };

// The native app keeps its guest-cart token in secure storage and sends it as X-Cart-Token (no cookies).
export const CART_HEADER = 'x-cart-token';
const guestToken = (req) => {
  const cookie = req.cookies?.[CART_COOKIE];
  if (cookie) return cookie;
  const h = isMobileClient(req) ? req.get(CART_HEADER) : null;
  return h && /^[A-Za-z0-9_-]{20,64}$/.test(h) ? h : null;
};

export async function findCart(db, req) {
  if (req.user) {
    const { rows } = await db.query('SELECT * FROM carts WHERE user_id = $1', [req.user.id]);
    return rows[0] ?? null;
  }
  const token = guestToken(req);
  if (!token) return null;
  const { rows } = await db.query('SELECT * FROM carts WHERE token_hash = $1', [sha256(token)]);
  return rows[0] ?? null;
}

export async function getOrCreateCart(db, req, res) {
  const existing = await findCart(db, req);
  if (existing) return existing;
  if (req.user) {
    const { rows } = await db.query(
      'INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET updated_at = now() RETURNING *',
      [req.user.id],
    );
    return rows[0];
  }
  const token = randomToken(24);
  const { rows } = await db.query('INSERT INTO carts (token_hash) VALUES ($1) RETURNING *', [sha256(token)]);
  if (isMobileClient(req)) res.set('X-Cart-Token', token);
  else res.cookie(CART_COOKIE, token, cartCookieOpts);
  return rows[0];
}

/** Move guest cart items into the user's cart after login/registration. */
export async function mergeGuestCart(db, req, res, userId) {
  const token = guestToken(req);
  if (!token) return;
  const { rows: [guest] } = await db.query('SELECT * FROM carts WHERE token_hash = $1', [sha256(token)]);
  res.clearCookie(CART_COOKIE, { ...cartCookieOpts, maxAge: undefined });
  if (!guest) return;
  const { rows: [userCart] } = await db.query(
    'INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET updated_at = now() RETURNING *',
    [userId],
  );
  await db.query(
    `INSERT INTO cart_items (cart_id, variant_id, quantity, personalization)
     SELECT $1, variant_id, quantity, personalization FROM cart_items WHERE cart_id = $2
     ON CONFLICT (cart_id, variant_id, personalization) DO UPDATE SET quantity = LEAST(50, cart_items.quantity + EXCLUDED.quantity)`,
    [userCart.id, guest.id],
  );
  if (guest.coupon_code && !userCart.coupon_code) await db.query('UPDATE carts SET coupon_code=$1 WHERE id=$2', [guest.coupon_code, userCart.id]);
  await db.query('DELETE FROM carts WHERE id = $1', [guest.id]);
}

/** Loads cart lines with product + variant rows (optionally locking variants for checkout). */
export async function loadCartLines(db, cartId, { lock = false } = {}) {
  const { rows } = await db.query(
    `SELECT ci.id, ci.quantity, ci.personalization,
            row_to_json(p.*) AS product, row_to_json(v.*) AS variant,
            (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort LIMIT 1) AS image
       FROM cart_items ci
       JOIN product_variants v ON v.id = ci.variant_id
       JOIN products p ON p.id = v.product_id
      WHERE ci.cart_id = $1
      ORDER BY ci.created_at
      ${lock ? 'FOR UPDATE OF v' : ''}`,
    [cartId],
  );
  return rows.map((r) => ({ id: r.id, quantity: r.quantity, personalization: r.personalization, product: { ...r.product, image: r.image }, variant: r.variant }));
}
