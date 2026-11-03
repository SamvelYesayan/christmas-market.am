import { Router } from 'express';
import { z } from 'zod';
import { one, many, query, withTransaction } from '../db.js';
import { ah, badRequest, conflict, notFound, unavailable } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { pioneerLimiter } from '../middleware/security.js';
import { pioneer, PioneerError } from '../integrations/pioneer/index.js';
import { awardAchievement, createRewardCoupon, syncPioneerPoints } from '../services/rewards.js';
import { PRODUCT_CARD_SQL, productCard } from '../services/catalog.js';
import { config } from '../config.js';
import { loc, tr } from '../i18n/index.js';

const r = Router();

const status = () => ({ mode: pioneer.mode, available: pioneer.configured, sandbox: !!pioneer.sandbox, discountPercent: config.PIONEER_DISCOUNT_PERCENT });

function mapPioneerError(err) {
  if (!(err instanceof PioneerError)) return err;
  if (err.code === 'invalid_card') return badRequest(err.message, 'invalid_card');
  if (err.code === 'insufficient_points') return conflict(err.message, 'insufficient_points');
  if (err.code === 'not_configured') return unavailable(err.message, 'pioneer_unavailable');
  return unavailable('The Pioneer Lodge is not answering right now. Please try again shortly.', 'pioneer_upstream');
}

const activeLink = (userId) => one(`SELECT * FROM pioneer_links WHERE user_id=$1 AND status='active'`, [userId]);

r.get('/status', (_req, res) => res.json(status()));

// Public offers (titles only) so non-members can see what the lodge offers.
r.get('/offers', ah(async (_req, res) => {
  const offers = await many(
    `SELECT o.*, row_to_json(pc.*) AS product FROM pioneer_offers o
       LEFT JOIN LATERAL (${PRODUCT_CARD_SQL} WHERE p.id = o.product_id) pc ON true
      WHERE o.is_active AND (o.starts_at IS NULL OR o.starts_at <= now()) AND (o.ends_at IS NULL OR o.ends_at > now())
      ORDER BY o.points_cost NULLS LAST`);
  res.json({
    offers: offers.map((x) => loc(x)).map((o) => ({
      id: o.id, title: o.title, description: o.description, kind: o.kind, pointsCost: o.points_cost,
      discountPercent: o.discount_percent, product: o.product ? productCard(o.product) : null, stock: o.stock,
    })),
  });
}));

const linkSchema = z.object({
  cardCode: z.string().trim().transform((s) => s.replace(/[\s-]/g, '')).pipe(z.string().regex(/^[0-9A-Za-z]{6,24}$/, 'Enter the code printed on your card')),
  verificationCode: z.string().trim().regex(/^[0-9A-Za-z]{3,12}$/, 'Enter the verification code'),
});

r.post('/link', requireAuth, pioneerLimiter, validate({ body: linkSchema }), ah(async (req, res) => {
  if (await activeLink(req.user.id)) throw conflict('A Pioneer Card is already linked to your account.', 'already_linked');
  let card;
  try {
    card = await pioneer.verifyCard(req.body.cardCode, req.body.verificationCode);
  } catch (err) {
    logger.info({ user: req.user.id, code: err.code }, 'pioneer verify failed');
    throw mapPioneerError(err);
  }
  const achievement = await withTransaction(async (db) => {
    const taken = await db.query(
      `SELECT user_id FROM pioneer_links WHERE external_card_id=$1 AND is_sandbox=$2 AND status='active' AND user_id <> $3`,
      [card.cardId, !!pioneer.sandbox, req.user.id]);
    if (taken.rows.length) throw conflict('This card is already linked to another account.', 'card_taken');
    await db.query(
      `INSERT INTO pioneer_links (user_id, external_card_id, card_masked, tier, is_sandbox, status, linked_at)
       VALUES ($1,$2,$3,$4,$5,'active',now())
       ON CONFLICT (user_id) DO UPDATE SET external_card_id=EXCLUDED.external_card_id, card_masked=EXCLUDED.card_masked,
         tier=EXCLUDED.tier, is_sandbox=EXCLUDED.is_sandbox, status='active', linked_at=now()`,
      [req.user.id, card.cardId, card.maskedNumber, card.tier, !!pioneer.sandbox]);
    return awardAchievement(db, req.user.id, 'pioneer_linked');
  });
  syncPioneerPoints(req.user.id).catch((err) => logger.warn({ err: err.message }, 'post-link sync failed'));
  res.status(201).json({ linked: true, card: { masked: card.maskedNumber, tier: card.tier }, sandbox: !!pioneer.sandbox, achievement });
}));

r.delete('/link', requireAuth, ah(async (req, res) => {
  await query(`UPDATE pioneer_links SET status='unlinked' WHERE user_id=$1`, [req.user.id]);
  res.json({ ok: true });
}));

r.get('/summary', requireAuth, ah(async (req, res) => {
  const link = await activeLink(req.user.id);
  if (!link) return res.json({ ...status(), linked: false });
  let balance = null;
  let history = [];
  let error = null;
  try {
    [balance, history] = await Promise.all([pioneer.getBalance(link.external_card_id), pioneer.getHistory(link.external_card_id)]);
    history = history.map((h) => ({ ...h, description: tr(h.description) }));
    await query('UPDATE pioneer_links SET tier = COALESCE($2, tier), last_synced_at = now() WHERE id=$1', [link.id, balance.tier]);
  } catch (err) {
    error = mapPioneerError(err).message;
  }
  const pending = await one(
    `SELECT COALESCE(SUM(points),0)::int AS points FROM reward_grants WHERE user_id=$1 AND points>0 AND pioneer_sync_status IN ('pending','failed','no_card')`,
    [req.user.id]);
  const redemptions = await many(
    `SELECT r.created_at, r.points, r.status, o.title, o.i18n, c.code AS coupon_code FROM pioneer_redemptions r
       JOIN pioneer_offers o ON o.id=r.offer_id LEFT JOIN coupons c ON c.id=r.coupon_id
      WHERE r.user_id=$1 ORDER BY r.created_at DESC LIMIT 20`, [req.user.id]);
  res.json({
    ...status(),
    linked: true,
    card: { masked: link.card_masked, tier: balance?.tier ?? link.tier, linkedAt: link.linked_at, sandbox: link.is_sandbox },
    balance: balance?.points ?? null,
    history,
    pendingStardust: pending.points,
    redemptions: redemptions.map((x) => loc(x)).map((x) => ({ title: x.title, points: x.points, status: x.status, couponCode: x.coupon_code, createdAt: x.created_at })),
    error,
  });
}));

r.post('/offers/:id/redeem', requireAuth, pioneerLimiter, validate({ params: z.object({ id: z.string().uuid() }) }), ah(async (req, res) => {
  const link = await activeLink(req.user.id);
  if (!link) throw badRequest('Link your Magical Pioneer Card first.', 'no_card');
  const offer = await one(`SELECT * FROM pioneer_offers WHERE id=$1 AND is_active AND (ends_at IS NULL OR ends_at > now())`, [req.params.id]);
  if (!offer) throw notFound('This offer is no longer available.');
  if (!offer.points_cost) throw badRequest('This offer is not redeemable with points.');

  // 1) reserve the redemption locally (and offer stock) so double-clicks cannot redeem twice
  const redemption = await withTransaction(async (db) => {
    if (offer.stock != null) {
      const { rowCount } = await db.query('UPDATE pioneer_offers SET stock = stock - 1 WHERE id=$1 AND stock > 0', [offer.id]);
      if (!rowCount) throw conflict('This reward has been fully claimed.', 'out_of_stock');
    }
    const { rows: [red] } = await db.query(
      `INSERT INTO pioneer_redemptions (user_id, offer_id, points, reference) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.id, offer.id, offer.points_cost, `redeem-${req.user.id.slice(0, 8)}-${Date.now()}`]);
    return red;
  });
  // 2) debit points at the Pioneer system (idempotent reference)
  try {
    await pioneer.redeemPoints(link.external_card_id, offer.points_cost, redemption.reference, offer.title);
  } catch (err) {
    await withTransaction(async (db) => {
      await db.query(`UPDATE pioneer_redemptions SET status='failed', error=$2 WHERE id=$1`, [redemption.id, err.message.slice(0, 300)]);
      if (offer.stock != null) await db.query('UPDATE pioneer_offers SET stock = stock + 1 WHERE id=$1', [offer.id]);
    });
    throw mapPioneerError(err);
  }
  // 3) fulfil: a personal coupon (discount, or 100% of the gift's price for gift offers)
  const coupon = await withTransaction(async (db) => {
    let spec;
    if (offer.kind === 'discount') spec = { type: 'percent', value: offer.discount_percent ?? 10, min_subtotal: 0, valid_days: 30 };
    else {
      const { rows: [p] } = await db.query('SELECT COALESCE(sale_price, price) AS price FROM products WHERE id=$1', [offer.product_id]);
      spec = { type: 'fixed', value: p?.price ?? 0, min_subtotal: p?.price ?? 0, valid_days: 30 };
    }
    const c = await createRewardCoupon(db, req.user.id, spec, { source: 'pioneer', description: offer.title, descriptionHy: offer.i18n?.hy?.title });
    await db.query('UPDATE coupons SET pioneer_only=true WHERE id=$1', [c.id]);
    await db.query(`UPDATE pioneer_redemptions SET status='completed', coupon_id=$2 WHERE id=$1`, [redemption.id, c.id]);
    return c;
  });
  res.status(201).json({
    ok: true,
    couponCode: coupon.code,
    message: tr(offer.kind === 'redeem_gift'
      ? 'Add the gift to your sleigh and use this code at checkout — it covers the gift in full.'
      : 'Your Pioneer discount code is ready for checkout.'),
  });
}));

export default r;
