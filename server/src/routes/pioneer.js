// My Pioneer Card — link a Magical Pioneer Card through the official Magical Integration API v1.
// Rules (enforced here, never in the browser):
//   • the customer id sent to Magical is always the signed-in user's id from the session;
//   • card number + CVV go straight to Magical once and are never stored, cached or logged;
//   • Magical is the source of truth for links, balances, transactions and rewards;
//   • points change only through Magical (POST /points/credit|debit, services/pioneerPoints.js): game rewards are
//     credited, store gifts are redeemed by a debit that Magical must confirm first. The store keeps no balance.
import { Router } from 'express';
import { z } from 'zod';
import { many, query, withTransaction } from '../db.js';
import { ah, badRequest, conflict, HttpError, notFound, unavailable } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { pioneerLimiter, redeemLimiter } from '../middleware/security.js';
import { hasScope, pioneer, MagicalApiError } from '../integrations/pioneer/index.js';
import { hasOpenDebit, openDebitError, redeemOffer } from '../services/pioneerPoints.js';
import { awardAchievement } from '../services/rewards.js';
import { activeLink, cached, forgetCustomer, holderOf, logLinkEvent, markUnlinked, saveActiveLink } from '../services/pioneer.js';
import { PRODUCT_CARD_SQL, productCard } from '../services/catalog.js';
import { config } from '../config.js';
import { loc } from '../i18n/index.js';

const r = Router();

const status = () => ({
  available: pioneer.configured,
  discountPercent: config.PIONEER_DISCOUNT_PERCENT,
  pointsEarnable: hasScope('points:credit'), // game rewards are credited to the card through Magical
  pointsRedeemable: hasScope('points:debit'), // store gifts can be redeemed with Pioneer points
});

/** Magical error → safe customer-facing error. Never exposes upstream messages, stack traces or credentials. */
export function mapMagicalError(err) {
  if (!(err instanceof MagicalApiError)) return err;
  const retry = err.retryAfter ? { retryAfter: err.retryAfter } : undefined;
  switch (err.code) {
    case 'invalid_card_credentials': {
      const left = err.fields?.attemptsBeforeLock;
      return new HttpError(400, 'The card number or security code is incorrect.', 'invalid_card', Number.isInteger(left) ? { attemptsLeft: left } : undefined);
    }
    case 'card_already_linked': return conflict('This Pioneer Card is already connected to another account.', 'card_taken');
    case 'customer_already_linked': return conflict('A Pioneer Card is already connected to your account.', 'already_linked');
    case 'card_inactive': return badRequest('This Pioneer Card is inactive. Please contact Magical.', 'card_inactive');
    case 'too_many_attempts': return new HttpError(429, 'Too many attempts. Please try again later.', 'too_many_attempts', retry);
    case 'card_locked': return new HttpError(429, 'This card is locked after too many wrong codes. Please contact Magical support.', 'card_locked');
    case 'validation_failed': return badRequest('Please check the card number and security code.', 'validation_failed');
    case 'rate_limited': return new HttpError(503, 'The Pioneer Card service is busy right now. Please try again in a few minutes.', 'pioneer_busy', retry);
    case 'link_not_found': return notFound('No Pioneer Card is connected to your account.');
    case 'reward_not_found': return notFound('This reward is not available.');
    case 'not_configured': return unavailable('The Magical Pioneer Card connection is not available yet.', 'pioneer_unavailable');
    case 'invalid_api_key':
    case 'insufficient_scope':
    case 'https_required':
    case 'browser_requests_not_allowed':
      logger.error({ code: err.code, status: err.status }, 'Magical Pioneer integration configuration error');
      return unavailable('The Pioneer Card service is temporarily unavailable.', 'pioneer_config');
    default: // server_error, timeout, unreachable, bad_response, anything unknown
      logger.warn({ code: err.code, status: err.status }, 'Magical Pioneer API request failed');
      return unavailable('The Pioneer Card service is temporarily unavailable. Please try again shortly.', 'pioneer_upstream');
  }
}

const digits = (n, msg) => z.string().trim().transform((s) => s.replace(/[\s-]/g, '')).pipe(z.string().regex(new RegExp(`^\\d{${n}}$`), msg));
const linkSchema = z.object({
  cardNumber: digits(8, 'Enter the 8-digit number printed on your card.'),
  verificationCode: digits(3, 'Enter the 3-digit verification code from the back of your card.'),
}).strict();

r.get('/status', (_req, res) => res.json(status()));

// Store offers shown to Pioneer members (public).
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
      redeemable: ['redeem_gift', 'discount'].includes(o.kind) && o.points_cost > 0,
    })),
  });
}));

// Public Magical reward catalog (GET /rewards). Empty when the integration is not available.
r.get('/rewards', ah(async (_req, res) => {
  if (!pioneer.configured) return res.json({ items: [] });
  try {
    const data = await cached('catalog:', () => pioneer.rewards());
    res.json({ items: Array.isArray(data.items) ? data.items : [] });
  } catch (err) {
    throw mapMagicalError(err);
  }
}));

r.post('/link', requireAuth, pioneerLimiter, validate({ body: linkSchema }), ah(async (req, res) => {
  const { cardNumber, verificationCode } = req.body;
  if (await activeLink(req.user.id)) throw conflict('A Pioneer Card is already connected to your account.', 'already_linked');

  let magical;
  try {
    magical = (await pioneer.link(req.user.id, cardNumber, verificationCode)).link;
  } catch (err) {
    const masked = `•••• ${cardNumber.slice(4)}`;
    if (err instanceof MagicalApiError && err.code === 'customer_already_linked') {
      // Magical already has a card for this customer (e.g. linked before this store kept a record): mirror it.
      try {
        const existing = (await pioneer.card(req.user.id)).link;
        await withTransaction((db) => saveActiveLink(db, req.user.id, existing));
      } catch { /* mirror is best effort; the error below still tells the customer */ }
    }
    if (err instanceof MagicalApiError && ['invalid_card_credentials', 'card_already_linked', 'card_inactive', 'too_many_attempts', 'card_locked', 'customer_already_linked'].includes(err.code)) {
      await logLinkEvent({ query }, { userId: req.user.id, cardMasked: masked, event: err.code === 'card_already_linked' ? 'rejected_taken' : 'verify_failed', detail: err.code }).catch(() => {});
    }
    throw mapMagicalError(err);
  }
  if (!magical?.card) throw mapMagicalError(new MagicalApiError('bad_response'));

  const result = await withTransaction(async (db) => {
    const link = await saveActiveLink(db, req.user.id, magical);
    await logLinkEvent(db, { userId: req.user.id, linkId: link.id, cardMasked: link.card_masked, event: 'linked' });
    const achievement = await awardAchievement(db, req.user.id, 'pioneer_linked');
    return { link, achievement };
  });
  forgetCustomer(req.user.id);
  res.status(201).json({
    linked: true,
    card: { masked: magical.card.number, last4: magical.card.last4, holderName: holderOf(magical.card), status: magical.card.status },
    balance: magical.balance,
    achievement: result.achievement,
  });
}));

const unlinkSchema = z.object({ confirm: z.literal(true) }).strict();
r.delete('/link', requireAuth, validate({ body: unlinkSchema }), ah(async (req, res) => {
  if (await hasOpenDebit(req.user.id)) throw openDebitError();
  const link = await activeLink(req.user.id);
  try {
    await pioneer.unlink(req.user.id);
  } catch (err) {
    // Already unlinked on Magical's side → just bring the local mirror in line.
    if (!(err instanceof MagicalApiError && err.code === 'link_not_found')) throw mapMagicalError(err);
    if (!link) throw mapMagicalError(err);
  }
  if (link) {
    await withTransaction(async (db) => {
      await markUnlinked(db, link.id);
      await logLinkEvent(db, { userId: req.user.id, linkId: link.id, cardMasked: link.card_masked, event: 'unlinked' });
    });
  }
  forgetCustomer(req.user.id);
  res.json({ ok: true });
}));

/** Reconciles the local mirror when Magical says there is no link any more (e.g. Magical-side unlink). */
async function dropStaleLink(link, userId) {
  await withTransaction(async (db) => {
    await markUnlinked(db, link.id);
    await logLinkEvent(db, { userId, linkId: link.id, cardMasked: link.card_masked, event: 'unlinked', detail: 'unlinked in Magical' });
  });
  forgetCustomer(userId);
}

const pageQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) });

/** The customer's recent Pioneer points activity in the store (game credits, gift debits) with their status. */
async function storeActivity(userId, locale) {
  const rows = await many(
    `SELECT op.id, op.kind, op.source, op.points, op.status, op.last_error_code, op.created_at, op.completed_at,
            COALESCE(g.payload->'i18n'->$2->>'title', g.title, o.i18n->$2->>'title', r.title) AS title,
            r.fulfilment, c.code AS coupon_code
       FROM pioneer_point_operations op
       LEFT JOIN reward_grants g ON g.id = op.grant_id
       LEFT JOIN pioneer_redemptions r ON r.id = op.redemption_id
       LEFT JOIN pioneer_offers o ON o.id = r.offer_id
       LEFT JOIN coupons c ON c.id = r.coupon_id
      WHERE op.user_id = $1 ORDER BY op.created_at DESC LIMIT 30`, [userId, locale]);
  return rows.map((x) => ({
    id: x.id, kind: x.kind, source: x.source, points: x.points, title: x.title,
    // pending/processing/needs_reconciliation are all 'waiting for Magical' to the customer
    status: x.status === 'succeeded' ? 'done' : x.status === 'failed' ? 'failed' : 'waiting',
    errorCode: x.status === 'failed' ? x.last_error_code : null,
    fulfilment: x.fulfilment ?? null, couponCode: x.status === 'succeeded' ? x.coupon_code ?? null : null,
    createdAt: x.created_at, completedAt: x.completed_at,
  }));
}

r.get('/summary', requireAuth, validate({ query: z.object({ fresh: z.enum(['1']).optional() }) }), ah(async (req, res) => {
  const link = await activeLink(req.user.id);
  if (!link) return res.json({ ...status(), linked: false });
  const id = req.user.id;
  if (req.query.fresh) forgetCustomer(id); // 'Refresh balance' reads Magical again
  const activity = await storeActivity(id, req.locale);
  let card;
  try {
    card = (await cached(`card:${id}`, () => pioneer.card(id))).link;
  } catch (err) {
    if (err instanceof MagicalApiError && err.code === 'link_not_found') {
      await dropStaleLink(link, id);
      return res.json({ ...status(), linked: false, unlinkedRemotely: true });
    }
    // Magical unavailable: no current balance is shown. The last confirmed value is labelled as such, never as current.
    return res.json({
      ...status(), linked: true, live: false, error: mapMagicalError(err).message,
      card: { masked: link.card_masked, holderName: link.holder_name, memberSince: link.member_since, linkedAt: link.linked_at, status: null },
      balance: null,
      lastConfirmed: link.last_balance != null ? { points: link.last_balance, asOf: link.balance_synced_at } : null,
      transactions: null, rewards: [], activity,
    });
  }
  const [tx, rw] = await Promise.allSettled([
    cached(`tx:1:${id}`, () => pioneer.transactions(id, 1, 20)),
    cached(`rewards:${id}`, () => pioneer.customerRewards(id)),
  ]);
  await query(`UPDATE pioneer_links SET card_masked=$2, holder_name=$3, last_balance=$4, balance_synced_at=now(), last_synced_at=now() WHERE id=$1`,
    [link.id, card.card?.number ?? link.card_masked, holderOf(card.card), Number.isInteger(card.balance) ? card.balance : link.last_balance]);
  res.json({
    ...status(),
    linked: true,
    live: true,
    card: { masked: card.card?.number, last4: card.card?.last4, holderName: holderOf(card.card), status: card.card?.status, memberSince: card.card?.memberSince, linkedAt: card.linkedAt },
    balance: { points: card.balance, live: true, asOf: new Date().toISOString() },
    transactions: tx.status === 'fulfilled' ? tx.value : null,
    rewards: rw.status === 'fulfilled' && Array.isArray(rw.value.items) ? rw.value.items : [],
    activity,
    partialError: tx.status === 'rejected' || rw.status === 'rejected' ? 'The Pioneer Card service is temporarily unavailable. Please try again shortly.' : null,
  });
}));

r.get('/transactions', requireAuth, validate({ query: pageQuery }), ah(async (req, res) => {
  if (!(await activeLink(req.user.id))) throw notFound('No Pioneer Card is connected to your account.');
  try {
    res.json(await cached(`tx:${req.query.page}:${req.user.id}`, () => pioneer.transactions(req.user.id, req.query.page, 20)));
  } catch (err) {
    throw mapMagicalError(err);
  }
}));

r.get('/rewards/:rewardId/eligibility', requireAuth, validate({ params: z.object({ rewardId: z.string().regex(/^\d{1,9}$/) }) }), ah(async (req, res) => {
  if (!(await activeLink(req.user.id))) throw notFound('No Pioneer Card is connected to your account.');
  try {
    res.json(await pioneer.eligibility(req.user.id, req.params.rewardId));
  } catch (err) {
    throw mapMagicalError(err);
  }
}));

// Redeem a store gift with Pioneer points. requestId is created once per confirmation in the browser, so repeated
// clicks, refreshes and retries return the same redemption instead of debiting again. The cost, the balance check and
// the debit are all decided here and by Magical — never by the browser.
const redeemSchema = { params: z.object({ id: z.string().uuid() }), body: z.object({ requestId: z.string().uuid() }).strict() };
r.post('/offers/:id/redeem', requireAuth, redeemLimiter, validate(redeemSchema), ah(async (req, res) => {
  const out = await redeemOffer(req.user.id, req.params.id, req.body.requestId);
  res.status(out.httpStatus).json({ redemption: out.redemption, repeated: !!out.repeated });
}));

export default r;
