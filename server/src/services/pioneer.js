// Pioneer Card links between store accounts and real Magical Pioneer Cards.
// Ownership lives in pioneer_links (one ACTIVE link per card and per account, enforced by unique indexes);
// points, owner name and rewards live in the Pioneer system and are only ever read from it.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { one, query } from '../db.js';
import { pioneer } from '../integrations/pioneer/index.js';

export const maskCard = (number) => (/^\d{8}$/.test(number ?? '') ? `•••• ${number.slice(4)}` : '••••');

const key = () => Buffer.from(config.PIONEER_SESSION_KEY, 'hex');

/** Encrypts a Pioneer cardholder session token, bound to the account and card it belongs to. */
export function sealSession(token, userId, cardNumber) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  c.setAAD(Buffer.from(`pioneer-session:${userId}:${cardNumber}`));
  const ct = Buffer.concat([c.update(token, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

/** Returns the session token, or null when missing, expired, tampered with or sealed with another key. */
export function openSession(link) {
  if (!link?.upstream_session || !link.upstream_session_expires_at || new Date(link.upstream_session_expires_at) <= new Date()) return null;
  try {
    const [v, iv, tag, ct] = link.upstream_session.split('.');
    if (v !== 'v1') return null;
    const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    d.setAAD(Buffer.from(`pioneer-session:${link.user_id}:${link.external_card_id}`));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** The account's active link for the configured Pioneer system (links from other/older providers are ignored). */
export const activeLink = (userId, db = { query }) =>
  db.query(`SELECT * FROM pioneer_links WHERE user_id=$1 AND provider=$2 AND status='active' LIMIT 1`, [userId, pioneer.mode]).then((r) => r.rows[0] ?? null);

export const logLinkEvent = (db, { userId, linkId = null, cardMasked = null, event, actorId = null, detail = null }) =>
  db.query(
    `INSERT INTO pioneer_link_events (user_id, link_id, provider, card_masked, event, actor_id, detail) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, linkId, pioneer.mode, cardMasked, event, actorId, detail],
  );

export const clearSession = (linkId) =>
  query('UPDATE pioneer_links SET upstream_session=NULL, upstream_session_expires_at=NULL WHERE id=$1', [linkId]);

export const findActiveLinkById = (id) => one(`SELECT * FROM pioneer_links WHERE id=$1 AND status='active'`, [id]);
