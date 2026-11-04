// My Pioneer Card — connect a real Magical Pioneer Card to a store account.
// Rules enforced here (never in the browser):
//   • a card is only connected after the Pioneer system itself accepts card number + verification code;
//   • a card can be actively connected to one account only, an account to one card;
//   • the verification code is passed straight to the Pioneer system and never stored or logged;
//   • points, owner name, rewards and history are read from the Pioneer system — the store cannot change them.
import { Router } from 'express';
import { z } from 'zod';
import { many, one, query, withTransaction } from '../db.js';
import { ah, badRequest, conflict, HttpError, notFound, unavailable } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { pioneerLimiter } from '../middleware/security.js';
import { pioneer, PioneerError } from '../integrations/pioneer/index.js';
import { awardAchievement, createRewardCoupon } from '../services/rewards.js';
import { activeLink, clearSession, logLinkEvent, maskCard, openSession, sealSession } from '../services/pioneer.js';
import { PRODUCT_CARD_SQL, productCard } from '../services/catalog.js';
import { config } from '../config.js';
import { loc, tr } from '../i18n/index.js';

const r = Router();

const status = () => ({
  mode: pioneer.mode,
  available: pioneer.configured,
  discountPercent: config.PIONEER_DISCOUNT_PERCENT,
  portalUrl: pioneer.portalUrl ?? null,
  pointsRedeemable: !!pioneer.supportsRedeem,
});

function mapPioneerError(err) {
  if (!(err instanceof PioneerError)) return err;
  switch (err.code) {
    case 'invalid_card': {
      const e = badRequest('The card number or verification code is incorrect.', 'invalid_card');
      if (Number.isInteger(err.attemptsLeft)) e.details = { attemptsLeft: err.attemptsLeft };
      return e;
    }
    case 'card_inactive': return badRequest('This Pioneer Card is not active. Please contact the Pioneer team.', 'card_inactive');
    case 'too_many_attempts': return new HttpError(429, 'Too many attempts for this card. Please try again later.', 'too_many_attempts', err.retryAfter ? { retryAfter: err.retryAfter } : undefined);
    case 'card_locked': return new HttpError(429, 'This card is locked after too many wrong codes. Please contact the Pioneer team.', 'card_locked');
    case 'service_busy': return new HttpError(503, 'The Pioneer Card service is busy right now. Please try again in a few minutes.', 'pioneer_busy', err.retryAfter ? { retryAfter: err.retryAfter } : undefined);
    case 'not_configured': return unavailable('The Magical Pioneer Card connection is not available yet.', 'pioneer_unavailable');
    default: return unavailable('The Pioneer Card service is not answering right now. Please try again shortly.', 'pioneer_upstream');
  }
}

const digits = (n, msg) => z.string().trim().transform((s) => s.replace(/[\s-]/g, '')).pipe(z.string().regex(new RegExp(`^\\d{${n}}$`), msg));
const linkSchema = z.object({
  cardNumber: digits(8, 'Enter the 8-digit number printed on your card.'),
  verificationCode: digits(3, 'Enter the 3-digit verification code from the back of your card.'),
}).strict();
const refreshSchema = z.object({ verificationCode: linkSchema.shape.verificationCode }).strict();

r.get('/status', (_req, res) => res.json(status()));

// Store offers for Pioneer members (titles only, public).
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

/** Verifies with the Pioneer system and returns { session, card } — throws mapped errors. */
async function verifyWithPioneer(cardNumber, verificationCode) {
  const session = await pioneer.login(cardNumber, verificationCode);
  const card = await pioneer.me(session.token);
  if (card.number !== cardNumber) { // should never happen; refuse rather than link the wrong card
    await pioneer.logout(session.token);
    throw new PioneerError('upstream_error', 'Pioneer returned a different card.');
  }
  return { session, card };
}

r.post('/link', requireAuth, pioneerLimiter, validate({ body: linkSchema }), ah(async (req, res) => {
  const { cardNumber, verificationCode } = req.body;
  if (await activeLink(req.user.id)) throw conflict('A Pioneer Card is already connected to your account.', 'already_linked');

  let verified;
  try {
    verified = await verifyWithPioneer(cardNumber, verificationCode);
  } catch (err) {
    logger.info({ user: req.user.id, code: err.code }, 'pioneer verification failed');
    if (err instanceof PioneerError && !['upstream_error', 'not_configured', 'service_busy'].includes(err.code)) {
      await logLinkEvent({ query }, { userId: req.user.id, cardMasked: maskCard(cardNumber), event: 'verify_failed', detail: err.code }).catch(() => {});
    }
    throw mapPioneerError(err);
  }
  const { session, card } = verified;
  const masked = maskCard(card.number);

  let result;
  try {
    result = await withTransaction(async (db) => {
      const taken = await db.query(
        `SELECT user_id FROM pioneer_links WHERE provider=$1 AND external_card_id=$2 AND status='active' FOR UPDATE`, [pioneer.mode, card.number]);
      if (taken.rows.length) {
        await logLinkEvent(db, { userId: req.user.id, cardMasked: masked, event: 'rejected_taken' });
        return { taken: true };
      }
      const before = await db.query(`SELECT 1 FROM pioneer_links WHERE provider=$1 AND external_card_id=$2 AND user_id=$3 LIMIT 1`, [pioneer.mode, card.number, req.user.id]);
      const { rows: [link] } = await db.query(
        `INSERT INTO pioneer_links (user_id, provider, external_card_id, card_masked, is_sandbox, status, linked_at, holder_name, member_since,
                                    last_balance, balance_synced_at, upstream_session, upstream_session_expires_at, last_synced_at)
         VALUES ($1,$2,$3,$4,false,'active',now(),$5,$6,$7,now(),$8,$9,now()) RETURNING *`,
        [req.user.id, pioneer.mode, card.number, masked, card.holderName, card.memberSince, card.balance,
          sealSession(session.token, req.user.id, card.number), session.expiresAt]);
      await logLinkEvent(db, { userId: req.user.id, linkId: link.id, cardMasked: masked, event: before.rows.length ? 'relinked' : 'linked' });
      const achievement = await awardAchievement(db, req.user.id, 'pioneer_linked');
      return { link, achievement };
    });
  } catch (err) {
    if (err?.code === '23505') result = { taken: true }; // a concurrent request connected the same card first
    else throw err;
  }
  if (result.taken) {
    await pioneer.logout(session.token);
    throw conflict('This Pioneer Card is already connected to another account.', 'card_taken');
  }
  res.status(201).json({ linked: true, card: { masked, holderName: card.holderName }, achievement: result.achievement });
}));

// Re-confirm the connected card with its verification code (the card number is taken from the server, not the browser).
r.post('/refresh', requireAuth, pioneerLimiter, validate({ body: refreshSchema }), ah(async (req, res) => {
  const link = await activeLink(req.user.id);
  if (!link) throw badRequest('Connect your Pioneer Card first.', 'no_card');
  let verified;
  try {
    verified = await verifyWithPioneer(link.external_card_id, req.body.verificationCode);
  } catch (err) {
    if (err instanceof PioneerError && !['upstream_error', 'service_busy'].includes(err.code)) {
      await logLinkEvent({ query }, { userId: req.user.id, linkId: link.id, cardMasked: link.card_masked, event: 'verify_failed', detail: `refresh:${err.code}` }).catch(() => {});
    }
    throw mapPioneerError(err);
  }
  const { session, card } = verified;
  await query(
    `UPDATE pioneer_links SET holder_name=$2, member_since=$3, last_balance=$4, balance_synced_at=now(), last_synced_at=now(),
            upstream_session=$5, upstream_session_expires_at=$6 WHERE id=$1`,
    [link.id, card.holderName, card.memberSince, card.balance, sealSession(session.token, req.user.id, card.number), session.expiresAt]);
  await logLinkEvent({ query }, { userId: req.user.id, linkId: link.id, cardMasked: link.card_masked, event: 'refreshed' });
  res.json({ ok: true });
}));

const unlinkSchema = z.object({ confirm: z.literal(true) }).strict();
r.delete('/link', requireAuth, validate({ body: unlinkSchema }), ah(async (req, res) => {
  const link = await activeLink(req.user.id);
  if (!link) throw notFound('No Pioneer Card is connected to your account.');
  const token = openSession(link);
  await withTransaction(async (db) => {
    await db.query(`UPDATE pioneer_links SET status='unlinked', unlinked_at=now(), upstream_session=NULL, upstream_session_expires_at=NULL WHERE id=$1`, [link.id]);
    await logLinkEvent(db, { userId: req.user.id, linkId: link.id, cardMasked: link.card_masked, event: 'unlinked' });
  });
  if (token) pioneer.logout(token).catch(() => {});
  res.json({ ok: true });
}));

r.get('/summary', requireAuth, ah(async (req, res) => {
  const link = await activeLink(req.user.id);
  if (!link) return res.json({ ...status(), linked: false });

  const token = openSession(link);
  let live = null;
  let error = null;
  if (token) {
    try {
      const [card, transactions, rewards, announcements] = await Promise.all([
        pioneer.me(token), pioneer.transactions(token, 10), pioneer.rewards(token), pioneer.announcements(token)]);
      if (card.number !== link.external_card_id) throw new PioneerError('upstream_error', 'Card mismatch.');
      live = { card, transactions, rewards, announcements };
      await query(`UPDATE pioneer_links SET holder_name=$2, last_balance=$3, balance_synced_at=now(), last_synced_at=now() WHERE id=$1`,
        [link.id, card.holderName, card.balance]);
    } catch (err) {
      if (err instanceof PioneerError && err.code === 'session_expired') await clearSession(link.id);
      else error = mapPioneerError(err).message;
    }
  }
  const pending = await one(
    `SELECT COALESCE(SUM(points),0)::int AS points FROM reward_grants WHERE user_id=$1 AND points>0 AND pioneer_sync_status IN ('pending','failed','no_card')`,
    [req.user.id]);
  res.json({
    ...status(),
    linked: true,
    // true → the connection needs the 3-digit code again before live data can be shown
    needsVerification: !live && !error,
    card: {
      masked: link.card_masked,
      holderName: live?.card.holderName ?? link.holder_name,
      memberSince: live?.card.memberSince ?? link.member_since,
      linkedAt: link.linked_at,
    },
    balance: live ? { points: live.card.balance, live: true, asOf: new Date().toISOString() }
      : link.last_balance != null ? { points: link.last_balance, live: false, asOf: link.balance_synced_at } : null,
    transactions: live?.transactions ?? [],
    rewards: live?.rewards ?? [],
    announcements: live?.announcements ?? [],
    pendingStardust: pending.points,
    error,
  });
}));

// Store offers paid with Pioneer points need a points-debit endpoint in the Pioneer system, which does not exist.
r.post('/offers/:id/redeem', requireAuth, pioneerLimiter, validate({ params: z.object({ id: z.string().uuid() }) }), ah(async (req, res) => {
  if (!pioneer.supportsRedeem) throw new HttpError(501, 'Pioneer points are spent in the Pioneer portal. This store cannot deduct points.', 'not_supported');
  const link = await activeLink(req.user.id);
  if (!link) throw badRequest('Connect your Pioneer Card first.', 'no_card');
  const offer = await one(`SELECT * FROM pioneer_offers WHERE id=$1 AND is_active AND (ends_at IS NULL OR ends_at > now())`, [req.params.id]);
  if (!offer) throw notFound('This offer is no longer available.');
  if (!offer.points_cost) throw badRequest('This offer is not redeemable with points.');
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
  try {
    await pioneer.redeemPoints(link.external_card_id, offer.points_cost, redemption.reference, offer.title);
  } catch (err) {
    await withTransaction(async (db) => {
      await db.query(`UPDATE pioneer_redemptions SET status='failed', error=$2 WHERE id=$1`, [redemption.id, err.message.slice(0, 300)]);
      if (offer.stock != null) await db.query('UPDATE pioneer_offers SET stock = stock + 1 WHERE id=$1', [offer.id]);
    });
    throw mapPioneerError(err);
  }
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
  res.status(201).json({ ok: true, couponCode: coupon.code, message: tr('Your Pioneer discount code is ready for checkout.') });
}));

export default r;
