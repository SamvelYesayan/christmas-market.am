// Pioneer points through Magical — the only way the store changes a Pioneer balance.
//
//   • Magical is the single source of truth. The store keeps no balance; it records each operation it asked
//     Magical to perform (pioneer_point_operations) and what Magical answered.
//   • Every operation gets its reference and Idempotency-Key BEFORE Magical is called, and keeps them for every
//     retry, so a timeout, crash, double click or parallel request can never credit or debit twice.
//   • Outcomes:
//       succeeded            Magical confirmed (201, or 200 replay of the original answer)
//       failed               Magical refused; nothing was executed (e.g. insufficient_points, partner_limit_exceeded)
//       needs_reconciliation the outcome is unknown (timeout, network error, 5xx) → retried with the SAME key until known
//       pending              waiting to be sent (e.g. points:credit not granted yet, Magical busy)
//       processing           a worker is sending it right now (lease; taken over if the worker dies)
//   • If Magical succeeds but saving the result fails, the operation stays open and the next retry receives Magical's
//     replayed original answer — so the customer is never charged (or credited) twice and the result is still recorded.
import { randomUUID } from 'node:crypto';
import { pool, withTransaction } from '../db.js';
import { HttpError, badRequest, conflict, notFound, unavailable } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { hasScope, MagicalApiError, pioneer, pointsAllowed } from '../integrations/pioneer/index.js';
import { activeLink, forgetCustomer } from './pioneer.js';
import { createRewardCoupon } from './rewards.js';

export const KEY_PREFIX = 'christmas-store';
const UNCERTAIN = new Set(['timeout', 'unreachable', 'server_error', 'bad_response']); // the request may have executed
const NOT_SENT = new Set(['points_blocked', 'not_configured', 'insufficient_scope', 'invalid_api_key', 'https_required', 'browser_requests_not_allowed', 'rate_limited']); // definitely not executed
const NEEDS_PEOPLE = new Set(['idempotency_conflict', 'duplicate_reference']); // should never happen with stable keys: stop and flag
const LEASE_SECONDS = 120;
const MAX_AUTO_ATTEMPTS = 40;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const backoffSeconds = (attempts) => Math.min(30 * 60, 30 * 2 ** Math.max(0, attempts - 1)); // 30 s, 1, 2, 4 … 30 min
const clip = (s, n) => (s == null ? null : String(s).slice(0, n));

/** Stable identifiers for one operation: derived from our own record id, never regenerated. */
export const opIds = (kind, ref) => ({ reference: ref, idempotencyKey: `${KEY_PREFIX}:${kind}:${ref}` });

/* ───────────── creating operations ───────────── */

/**
 * Inside the reward transaction: queue a Magical credit for a newly created game reward when the customer has a
 * linked card. One credit per reward (unique grant_id + reference). Returns the operation id or null.
 */
export async function queueGameCredit(db, userId, grant) {
  if (!pointsAllowed || !grant?.id || !(grant.points > 0)) return null; // points blocked here: nothing is queued
  const link = await activeLink(userId, db);
  if (!link) return null;
  const ids = opIds('credit', `cm-grant-${grant.id}`);
  const { rows: [op] } = await db.query(
    `INSERT INTO pioneer_point_operations (user_id, customer_id, kind, points, reference, idempotency_key, reason, description, source, grant_id)
     VALUES ($1, $2, 'credit', $3, $4, $5, 'game_reward', $6, 'game_reward', $7)
     ON CONFLICT (grant_id) DO NOTHING RETURNING id`,
    [userId, String(userId), grant.points, ids.reference, ids.idempotencyKey, clip(grant.title, 200), grant.id]);
  return op?.id ?? null;
}

/* ───────────── running operations ───────────── */

/** Take the operation for this worker (lease). Returns the row, or null if it is finished or someone else has it. */
async function claim(opId) {
  const { rows: [op] } = await pool.query(
    `UPDATE pioneer_point_operations SET status='processing', attempts=attempts+1, lease_until=now() + make_interval(secs => $2)
      WHERE id=$1 AND status IN ('pending','processing','needs_reconciliation') AND (lease_until IS NULL OR lease_until < now())
      RETURNING *`, [opId, LEASE_SECONDS]);
  return op ?? null;
}

const send = (op) => {
  const body = { customerId: op.customer_id, points: op.points, reference: op.reference, reason: op.reason };
  if (op.description) body.description = op.description;
  return op.kind === 'credit' ? pioneer.creditPoints(op.idempotency_key, body) : pioneer.debitPoints(op.idempotency_key, body);
};

/** Magical confirmed: record the ledger transaction and complete what the operation was for — atomically. */
async function finalizeSuccess(op, { transaction: tx, replayed }) {
  if (Number(tx.points) !== op.points || (tx.reference && tx.reference !== op.reference)) {
    // Magical answered for something else: never record it as ours.
    logger.error({ op: op.id, reference: op.reference }, 'Magical points answer does not match the operation');
    return finalizeFailure(op, new MagicalApiError('idempotency_conflict'));
  }
  await withTransaction(async (db) => {
    const { rows: [cur] } = await db.query('SELECT status FROM pioneer_point_operations WHERE id=$1 FOR UPDATE', [op.id]);
    if (cur.status === 'succeeded') return;
    await db.query(
      `UPDATE pioneer_point_operations SET status='succeeded', lease_until=NULL, last_error_code=NULL, magical_transaction_id=$2, magical_type=$3,
              balance_after=$4, magical_created_at=$5, replayed=$6, completed_at=now() WHERE id=$1`,
      [op.id, String(tx.id), clip(tx.type, 40), Number.isInteger(tx.balanceAfter) ? tx.balanceAfter : null, tx.createdAt ?? null, !!replayed]);
    if (op.grant_id) {
      await db.query(`UPDATE reward_grants SET pioneer_sync_status='synced', pioneer_error=NULL WHERE id=$1`, [op.grant_id]);
    }
    if (op.redemption_id) await completeRedemption(db, op.redemption_id);
  });
  if (op.user_id) forgetCustomer(op.user_id);
}

/** Magical refused, or the outcome is unknown. */
async function finalizeFailure(op, err) {
  const code = err instanceof MagicalApiError ? err.code : 'local_error';
  let status;
  let next = null; // seconds until the next automatic attempt
  if (UNCERTAIN.has(code) || code === 'local_error') { status = 'needs_reconciliation'; next = backoffSeconds(op.attempts); }
  else if (NEEDS_PEOPLE.has(code)) { status = 'needs_reconciliation'; next = 100 * 365 * 86400; } // an admin decides
  else if (NOT_SENT.has(code) && op.kind === 'credit') { status = 'pending'; next = code === 'rate_limited' && err.retryAfter ? err.retryAfter : 15 * 60; }
  else status = 'failed';
  if (status !== 'failed' && op.attempts >= MAX_AUTO_ATTEMPTS && !NEEDS_PEOPLE.has(code)) next = 100 * 365 * 86400; // stop retrying; shown to admins

  await withTransaction(async (db) => {
    const { rows: [cur] } = await db.query('SELECT status FROM pioneer_point_operations WHERE id=$1 FOR UPDATE', [op.id]);
    if (cur.status === 'succeeded') return; // a parallel worker already recorded success
    await db.query(
      `UPDATE pioneer_point_operations SET status=$2, lease_until=NULL, last_error_code=$3,
              next_attempt_at = CASE WHEN $4::int IS NULL THEN next_attempt_at ELSE now() + make_interval(secs => $4::int) END,
              completed_at = CASE WHEN $2 = 'failed' THEN now() ELSE NULL END
        WHERE id=$1`, [op.id, status, code, next]);
    if (op.grant_id) {
      const grantStatus = status === 'failed' ? 'failed' : status === 'needs_reconciliation' ? 'needs_reconciliation' : 'pending';
      await db.query(`UPDATE reward_grants SET pioneer_sync_status=$2, pioneer_error=$3 WHERE id=$1`, [op.grant_id, grantStatus, code]);
    }
    if (op.redemption_id) {
      if (status === 'failed') await failRedemption(db, op.redemption_id, code);
      else await db.query(`UPDATE pioneer_redemptions SET status='needs_reconciliation', error=$2, updated_at=now() WHERE id=$1 AND status <> 'completed'`, [op.redemption_id, code]);
    }
  });
  if (status === 'needs_reconciliation') logger.warn({ op: op.id, kind: op.kind, code }, 'Pioneer points outcome unknown; will retry with the same idempotency key');
  else if (status === 'failed') logger.info({ op: op.id, kind: op.kind, code }, 'Pioneer points operation refused by Magical');
}

/**
 * Send one operation to Magical (retrying an unknown outcome a couple of times with the SAME key) and record the result.
 * Returns the operation row as it is afterwards.
 */
export async function runOperation(opId, { tries = 2 } = {}) {
  // Points blocked on this server (development against a remote Magical, or the kill switch): the operation is
  // neither sent nor changed in any way.
  const op = pointsAllowed ? await claim(opId) : null;
  if (op) {
    let result = null;
    let error = null;
    for (let i = 0; i < tries; i++) {
      try { result = await send(op); error = null; break; } catch (e) {
        error = e;
        if (!(e instanceof MagicalApiError) || !UNCERTAIN.has(e.code) || i === tries - 1) break;
        await sleep(400 * (i + 1));
      }
    }
    try {
      if (result) await finalizeSuccess(op, result);
      else await finalizeFailure(op, error);
    } catch (localErr) {
      // Magical may have executed but we could not save it. The lease expires and reconciliation retries with
      // the same key; Magical replays the original answer, and it is recorded then.
      logger.error({ op: op.id, err: localErr.message }, 'could not record a Pioneer points result; reconciliation will retry');
    }
  }
  const { rows: [now] } = await pool.query('SELECT * FROM pioneer_point_operations WHERE id=$1', [opId]);
  return now;
}

/** Send a customer's queued game-reward credits (called after a reward is granted). Never throws. */
export async function sendQueuedCredits(userId) {
  // Not before Magical has granted points:credit: the credit stays queued (no pointless refused calls to Magical).
  if (!pioneer.configured || !pointsAllowed || !hasScope('points:credit')) return;
  const { rows } = await pool.query(
    `SELECT id FROM pioneer_point_operations WHERE user_id=$1 AND kind='credit' AND status IN ('pending','needs_reconciliation')
        AND next_attempt_at <= now() ORDER BY created_at LIMIT 20`, [userId]);
  for (const { id } of rows) await runOperation(id).catch((e) => logger.warn({ err: e.message }, 'credit send failed'));
}

/**
 * Background reconciliation: resend every due operation with its original key (unknown outcomes, crashed workers,
 * credits waiting for points:credit or a quieter Magical). Safe to run repeatedly and in parallel.
 */
export async function reconcilePointOperations({ limit = 50 } = {}) {
  if (!pioneer.configured || !pointsAllowed) return { checked: 0, blocked: !pointsAllowed };
  const { rows } = await pool.query(
    `SELECT id, kind, status FROM pioneer_point_operations
      WHERE (status IN ('pending','needs_reconciliation') AND next_attempt_at <= now())
         OR (status = 'processing' AND lease_until < now())
      ORDER BY next_attempt_at LIMIT $1`, [limit]);
  let checked = 0;
  for (const op of rows) {
    // A new credit is only worth sending once Magical has granted points:credit; unknown outcomes are always resolved.
    if (op.status === 'pending' && op.kind === 'credit' && !hasScope('points:credit')) continue;
    await runOperation(op.id, { tries: 1 }).catch((e) => logger.warn({ err: e.message }, 'reconcile failed'));
    checked++;
  }
  return { checked };
}

/** An unconfirmed debit exists: the card must stay linked until it is settled (Magical needs the link to answer). */
export async function hasOpenDebit(userId) {
  const { rows } = await pool.query("SELECT 1 FROM pioneer_point_operations WHERE user_id=$1 AND kind='debit' AND status IN ('pending','processing','needs_reconciliation') LIMIT 1", [userId]);
  return rows.length > 0;
}
const OPEN_DEBIT_MSG = 'A points redemption is still being confirmed. Please disconnect the card after it is settled.';
export const openDebitError = () => conflict(OPEN_DEBIT_MSG, 'redemption_in_progress');

/* ───────────── gift redemption (debit) ───────────── */

async function completeRedemption(db, redemptionId) {
  const { rows: [rd] } = await db.query(
    `SELECT r.*, o.kind AS offer_kind, o.discount_percent FROM pioneer_redemptions r JOIN pioneer_offers o ON o.id = r.offer_id WHERE r.id=$1 FOR UPDATE OF r`, [redemptionId]);
  if (!rd || rd.status === 'completed') return;
  let couponId = null;
  let fulfilment = 'awaiting_handover';
  if (rd.offer_kind === 'discount' && rd.discount_percent > 0) {
    const c = await createRewardCoupon(db, rd.user_id, { type: 'percent', value: rd.discount_percent, min_subtotal: 0, valid_days: 30 },
      { source: 'pioneer', description: rd.title });
    couponId = c.id;
    fulfilment = 'coupon';
  }
  await db.query(
    `UPDATE pioneer_redemptions SET status='completed', error=NULL, coupon_id=COALESCE($2, coupon_id), fulfilment=$3, completed_at=now(), updated_at=now() WHERE id=$1`,
    [redemptionId, couponId, fulfilment]);
}

async function failRedemption(db, redemptionId, code) {
  const { rows: [rd] } = await db.query(`SELECT * FROM pioneer_redemptions WHERE id=$1 FOR UPDATE`, [redemptionId]);
  if (!rd || rd.status === 'completed' || rd.status === 'failed') return;
  if (rd.stock_reserved) await db.query('UPDATE pioneer_offers SET stock = stock + 1 WHERE id=$1 AND stock IS NOT NULL', [rd.offer_id]);
  await db.query(`UPDATE pioneer_redemptions SET status='failed', error=$2, stock_reserved=false, updated_at=now() WHERE id=$1`, [redemptionId, code]);
}

const REDEEMABLE = ['redeem_gift', 'discount'];

/** Public shape of a redemption for the customer. */
export async function redemptionView(id) {
  const { rows: [r] } = await pool.query(
    `SELECT r.id, r.status, r.points, r.title, r.fulfilment, r.created_at, r.completed_at, r.error, c.code AS coupon_code,
            op.status AS op_status, op.balance_after
       FROM pioneer_redemptions r LEFT JOIN coupons c ON c.id = r.coupon_id
       LEFT JOIN pioneer_point_operations op ON op.redemption_id = r.id WHERE r.id=$1`, [id]);
  return r && {
    id: r.id, status: r.status, points: r.points, title: r.title, fulfilment: r.fulfilment, couponCode: r.coupon_code ?? null,
    createdAt: r.created_at, completedAt: r.completed_at, errorCode: r.status === 'failed' ? r.error : null,
    balanceAfter: r.status === 'completed' ? r.balance_after : null,
  };
}

/** The customer-facing error for a refused debit (nothing was deducted). */
function refusal(code, fields) {
  switch (code) {
    case 'insufficient_points': return new HttpError(409, 'Your Pioneer Card does not have enough points for this gift. Nothing was deducted.', 'insufficient_points', fields ? { balance: fields.balance, points: fields.points } : undefined);
    case 'partner_limit_exceeded': return new HttpError(422, 'This redemption is above the limit Magical allows for the store. Nothing was deducted.', 'points_limit');
    case 'card_inactive': return badRequest('This Pioneer Card is inactive. Please contact Magical. Nothing was deducted.', 'card_inactive');
    case 'link_not_found': return notFound('No Pioneer Card is connected to your account.');
    case 'rate_limited': return unavailable('The Pioneer Card service is busy right now. Nothing was deducted — please try again in a few minutes.', 'pioneer_busy');
    default: return unavailable('The gift could not be redeemed right now. Nothing was deducted — please try again later.', 'redeem_failed');
  }
}

/**
 * Redeem a store gift with Pioneer points. The gift is confirmed only after Magical confirms the debit.
 * clientToken identifies one confirmation (repeated clicks / refreshes reuse it and get the same redemption).
 * → { httpStatus, redemption }
 */
export async function redeemOffer(userId, offerId, clientToken) {
  if (!pioneer.configured) throw unavailable('The Magical Pioneer Card connection is not available yet.', 'pioneer_unavailable');
  if (!hasScope('points:debit')) throw unavailable('Redeeming gifts with Pioneer points is not switched on yet.', 'redeem_not_enabled');

  // Same confirmation again (double click, refresh, retry): return what already happened.
  const { rows: [same] } = await pool.query('SELECT id FROM pioneer_redemptions WHERE user_id=$1 AND client_token=$2', [userId, clientToken]);
  if (same) return { httpStatus: 200, redemption: await redemptionView(same.id), repeated: true };

  const link = await activeLink(userId);
  if (!link) throw notFound('No Pioneer Card is connected to your account.');
  const { rows: [offer] } = await pool.query(
    `SELECT o.*, p.is_active AS product_active, p.name AS product_name,
            (SELECT COALESCE(SUM(v.stock), 0) FROM product_variants v WHERE v.product_id = p.id) AS product_stock
       FROM pioneer_offers o LEFT JOIN products p ON p.id = o.product_id
      WHERE o.id=$1 AND o.is_active AND (o.starts_at IS NULL OR o.starts_at <= now()) AND (o.ends_at IS NULL OR o.ends_at > now())`, [offerId]);
  if (!offer) throw notFound('This gift is no longer available.');
  if (!REDEEMABLE.includes(offer.kind) || !(offer.points_cost > 0)) throw badRequest('This offer cannot be redeemed with points.', 'not_redeemable');
  if (offer.product_id && (!offer.product_active || Number(offer.product_stock) <= 0)) throw conflict('This gift is out of stock right now.', 'out_of_stock');
  if (offer.stock != null && offer.stock <= 0) throw conflict('This gift is out of stock right now.', 'out_of_stock');

  // Live balance from Magical (no cache). Magical's debit is still the final, locked check.
  let card;
  try { card = (await pioneer.card(String(userId))).link; } catch (e) {
    if (e instanceof MagicalApiError && e.code === 'link_not_found') throw notFound('No Pioneer Card is connected to your account.');
    throw unavailable('We cannot check your Pioneer balance right now, so nothing was redeemed. Please try again shortly.', 'pioneer_upstream');
  }
  if (card?.card?.status && card.card.status !== 'active') throw refusal('card_inactive');
  if (!Number.isInteger(card?.balance)) throw unavailable('We cannot check your Pioneer balance right now, so nothing was redeemed. Please try again shortly.', 'pioneer_upstream');
  if (card.balance < offer.points_cost) throw refusal('insufficient_points', { balance: card.balance, points: offer.points_cost });

  // Reserve: one open redemption per customer (unique index), stock taken under the offer's row lock.
  const id = randomUUID();
  const ids = opIds('debit', `cm-gift-${id}`);
  let opId;
  try {
    opId = await withTransaction(async (db) => {
      const { rows: [o] } = await db.query('SELECT stock FROM pioneer_offers WHERE id=$1 FOR UPDATE', [offer.id]);
      if (o.stock != null && o.stock <= 0) throw conflict('This gift is out of stock right now.', 'out_of_stock');
      if (o.stock != null) await db.query('UPDATE pioneer_offers SET stock = stock - 1 WHERE id=$1', [offer.id]);
      await db.query(
        `INSERT INTO pioneer_redemptions (id, user_id, offer_id, points, reference, status, client_token, product_id, title, stock_reserved)
         VALUES ($1,$2,$3,$4,$5,'processing',$6,$7,$8,$9)`,
        [id, userId, offer.id, offer.points_cost, ids.reference, clientToken, offer.product_id, offer.title, o.stock != null]);
      const { rows: [op] } = await db.query(
        `INSERT INTO pioneer_point_operations (user_id, customer_id, kind, points, reference, idempotency_key, reason, description, source, redemption_id)
         VALUES ($1,$2,'debit',$3,$4,$5,'partner_redemption',$6,'gift_redemption',$7) RETURNING id`,
        [userId, String(userId), offer.points_cost, ids.reference, ids.idempotencyKey, clip(offer.title, 200), id]);
      return op.id;
    });
  } catch (e) {
    if (e.code === '23505') {
      const { rows: [again] } = await pool.query('SELECT id FROM pioneer_redemptions WHERE user_id=$1 AND client_token=$2', [userId, clientToken]);
      if (again) return { httpStatus: 200, redemption: await redemptionView(again.id), repeated: true };
      throw conflict('Another redemption is still being confirmed. Please wait a moment.', 'redemption_in_progress');
    }
    throw e;
  }

  const op = await runOperation(opId);
  const redemption = await redemptionView(id);
  if (op.status === 'succeeded') return { httpStatus: 201, redemption };
  if (op.status === 'failed') throw refusal(op.last_error_code);
  // Unknown outcome: not confirmed, never charged twice; reconciliation settles it.
  return { httpStatus: 202, redemption };
}
