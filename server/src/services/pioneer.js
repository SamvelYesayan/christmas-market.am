// Pioneer Card links between store accounts and Magical Pioneer Cards (Integration API v1).
// Magical owns the link (keyed by our customer id), the card, its balance, history and rewards.
// pioneer_links is the store's local mirror, used for member pricing, the account header and the admin view.
// It never holds a CVV, a full card number or any Magical credential.
import { query } from '../db.js';
import { pioneer } from '../integrations/pioneer/index.js';

/** Local link reference: Magical identifies links by the store customer id, so that is what we keep. */
export const linkRef = (userId) => `customer:${userId}`;

/** The account's active link for the configured Pioneer provider (older providers' rows are ignored history). */
export const activeLink = (userId, db = { query }) =>
  db.query(`SELECT * FROM pioneer_links WHERE user_id=$1 AND provider=$2 AND status='active' LIMIT 1`, [userId, pioneer.provider]).then((r) => r.rows[0] ?? null);

export const logLinkEvent = (db, { userId, linkId = null, cardMasked = null, event, actorId = null, detail = null }) =>
  db.query(
    `INSERT INTO pioneer_link_events (user_id, link_id, provider, card_masked, event, actor_id, detail) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, linkId, pioneer.provider, cardMasked, event, actorId, detail],
  );

/** Holder name as Magical returns it; unnamed cards ("Pioneer Member") have no holder. */
export const holderOf = (card) => (card?.firstName || card?.lastName ? card.displayName ?? [card.firstName, card.lastName].filter(Boolean).join(' ') : null);

/** Records (or refreshes) the local mirror of an active Magical link. Returns the row. */
export async function saveActiveLink(db, userId, magicalLink) {
  const card = magicalLink.card ?? {};
  const params = [userId, pioneer.provider, linkRef(userId), card.number ?? `•••• ${card.last4 ?? ''}`.trim(), holderOf(card),
    card.memberSince ?? null, Number.isInteger(magicalLink.balance) ? magicalLink.balance : null, magicalLink.linkedAt ?? new Date().toISOString()];
  const existing = await db.query(`SELECT id FROM pioneer_links WHERE user_id=$1 AND provider=$2 AND status='active' FOR UPDATE`, [userId, pioneer.provider]);
  if (existing.rows[0]) {
    const { rows: [row] } = await db.query(
      `UPDATE pioneer_links SET card_masked=$2, holder_name=$3, member_since=$4, last_balance=COALESCE($5::int, last_balance),
              balance_synced_at=CASE WHEN $5::int IS NULL THEN balance_synced_at ELSE now() END, last_synced_at=now()
        WHERE id=$1 RETURNING *`, [existing.rows[0].id, params[3], params[4], params[5], params[6]]);
    return row;
  }
  const { rows: [row] } = await db.query(
    `INSERT INTO pioneer_links (user_id, provider, external_card_id, card_masked, is_sandbox, status, holder_name, member_since,
                                last_balance, balance_synced_at, linked_at, last_synced_at)
     VALUES ($1,$2,$3,$4,false,'active',$5,$6,$7,CASE WHEN $7::int IS NULL THEN NULL ELSE now() END,$8,now()) RETURNING *`, params);
  return row;
}

/** Marks the local mirror as unlinked (history row is kept). */
export const markUnlinked = (db, linkId) =>
  db.query(`UPDATE pioneer_links SET status='unlinked', unlinked_at=now(), upstream_session=NULL, upstream_session_expires_at=NULL WHERE id=$1`, [linkId]);

// Very short read cache (Magical stays the source of truth; never used for financial decisions).
const CACHE_MS = 5_000;
const cache = new Map();
export async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = await fn();
  cache.set(key, { value, until: Date.now() + CACHE_MS });
  if (cache.size > 2000) for (const [k, v] of cache) if (v.until <= Date.now()) cache.delete(k);
  return value;
}
export const forgetCustomer = (userId) => { for (const k of cache.keys()) if (k.includes(`:${userId}`)) cache.delete(k); };
