// Server-side reward engine. Every reward is a row in reward_grants with a unique (user, source, source_ref),
// which makes all reward endpoints idempotent and stops replay/duplicate claims.
import { one, many, query } from '../db.js';
import { couponCode } from '../lib/crypto.js';
import { logger } from '../lib/logger.js';
import { pioneer } from '../integrations/pioneer/index.js';
import { currentLocale } from '../i18n/index.js';

export async function getRule(db, key) {
  const { rows } = await db.query('SELECT config FROM reward_rules WHERE key = $1 AND is_active', [key]);
  return rows[0]?.config ?? null;
}

async function activePioneerLink(db, userId) {
  const { rows } = await db.query(`SELECT * FROM pioneer_links WHERE user_id = $1 AND status = 'active'`, [userId]);
  return rows[0] ?? null;
}

/** Create a personal, single-use coupon from a spec { type, value, min_subtotal, valid_days }. */
export async function createRewardCoupon(db, userId, spec, { source, description, descriptionHy }) {
  const ends = new Date(Date.now() + (spec.valid_days ?? 7) * 86400000);
  const { rows } = await db.query(
    `INSERT INTO coupons (code, description, type, value, min_subtotal, max_uses, per_user_limit, user_id, source, ends_at, i18n)
     VALUES ($1,$2,$3,$4,$5,1,1,$6,$7,$8,$9) RETURNING *`,
    [couponCode(source === 'advent' ? 'ADVENT' : 'MAGIC'), description, spec.type, spec.value ?? 0, spec.min_subtotal ?? 0, userId, source, ends, descriptionHy ? { hy: { description: descriptionHy } } : {}],
  );
  return rows[0];
}

/**
 * Grant a reward inside the caller's transaction. Returns { grant, created }.
 * reward = { source, sourceRef, kind: points|coupon|badge|product|message, title, points?, coupon?: spec, productId?, payload? }
 */
export async function grantReward(db, userId, reward) {
  const existing = await db.query(
    'SELECT g.*, c.code AS coupon_code FROM reward_grants g LEFT JOIN coupons c ON c.id = g.coupon_id WHERE g.user_id=$1 AND g.source=$2 AND g.source_ref=$3',
    [userId, reward.source, reward.sourceRef],
  );
  if (existing.rows[0]) return { grant: existing.rows[0], created: false };

  let couponId = null;
  let code = null;
  if (reward.kind === 'coupon' && reward.coupon) {
    const c = await createRewardCoupon(db, userId, reward.coupon, { source: reward.source.split(':')[0], description: reward.title, descriptionHy: reward.titleHy });
    couponId = c.id;
    code = c.code;
  }
  const points = reward.kind === 'points' ? Math.max(0, Math.floor(reward.points ?? 0)) : 0;
  const link = points > 0 ? await activePioneerLink(db, userId) : null;
  const payload = { ...(reward.payload ?? {}), ...(reward.titleHy ? { i18n: { hy: { title: reward.titleHy } } } : {}) };
  const syncStatus = points > 0 ? (link ? 'pending' : 'no_card') : 'not_applicable';
  const { rows } = await db.query(
    `INSERT INTO reward_grants (user_id, source, source_ref, kind, title, points, coupon_id, product_id, payload, pioneer_sync_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (user_id, source, source_ref) DO NOTHING
     RETURNING *`,
    [userId, reward.source, reward.sourceRef, reward.kind, reward.title, points, couponId, reward.productId ?? null, payload, syncStatus],
  );
  if (!rows[0]) {
    // Lost a race with a concurrent identical request — return the winner's grant.
    const again = await db.query('SELECT * FROM reward_grants WHERE user_id=$1 AND source=$2 AND source_ref=$3', [userId, reward.source, reward.sourceRef]);
    return { grant: again.rows[0], created: false };
  }
  return { grant: { ...rows[0], coupon_code: code }, created: true };
}

export const publicGrant = (g) => g && ({
  id: g.id,
  source: g.source,
  kind: g.kind,
  title: g.payload?.i18n?.[currentLocale()]?.title ?? g.title,
  points: g.points,
  couponCode: g.coupon_code ?? null,
  payload: g.payload ? { ...g.payload, ...(g.payload.i18n?.[currentLocale()] ?? {}), i18n: undefined } : g.payload,
  pioneerSyncStatus: g.pioneer_sync_status,
  createdAt: g.created_at,
});

/** Push pending Stardust to the linked Pioneer card. Safe to call repeatedly (idempotent references). */
export async function syncPioneerPoints(userId) {
  if (!pioneer.configured) return;
  const link = await one(`SELECT * FROM pioneer_links WHERE user_id=$1 AND status='active'`, [userId]);
  if (!link) return;
  const pending = await many(
    `SELECT * FROM reward_grants WHERE user_id=$1 AND points > 0 AND pioneer_sync_status IN ('pending','failed','no_card') ORDER BY created_at LIMIT 100`,
    [userId],
  );
  for (const g of pending) {
    try {
      await pioneer.creditPoints(link.external_card_id, g.points, `grant-${g.id}`, `Christmas Market: ${g.title}`);
      await query(`UPDATE reward_grants SET pioneer_sync_status='synced', pioneer_error=NULL WHERE id=$1`, [g.id]);
    } catch (err) {
      logger.warn({ err: err.message, grant: g.id }, 'pioneer credit failed');
      await query(`UPDATE reward_grants SET pioneer_sync_status='failed', pioneer_error=$2 WHERE id=$1`, [g.id, err.message.slice(0, 300)]);
      if (err.code === 'not_configured' || err.code === 'upstream_error') break;
    }
  }
  await query('UPDATE pioneer_links SET last_synced_at = now() WHERE id = $1', [link.id]);
}

/** Retries failed/pending syncs for everyone; run periodically from index.js. */
export async function syncAllPending() {
  if (!pioneer.configured) return;
  const users = await many(
    `SELECT DISTINCT g.user_id FROM reward_grants g JOIN pioneer_links l ON l.user_id = g.user_id AND l.status='active'
      WHERE g.points > 0 AND g.pioneer_sync_status IN ('pending','failed','no_card') LIMIT 200`,
  );
  for (const u of users) await syncPioneerPoints(u.user_id);
}

export async function awardAchievement(db, userId, key) {
  const { rows } = await db.query(
    `INSERT INTO user_achievements (user_id, achievement_key) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING achievement_key`,
    [userId, key],
  );
  if (!rows[0]) return null;
  const { rows: [a] } = await db.query('SELECT key, title, description, icon FROM achievements WHERE key=$1', [key]);
  return a;
}

export async function stardustBalance(db, userId) {
  const { rows: [r] } = await db.query('SELECT COALESCE(SUM(points),0)::int AS total FROM reward_grants WHERE user_id = $1', [userId]);
  return r.total;
}
