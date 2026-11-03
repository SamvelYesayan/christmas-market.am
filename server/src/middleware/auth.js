import { one, query } from '../db.js';
import { config, isProd } from '../config.js';
import { randomToken, sha256 } from '../lib/crypto.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export const SESSION_COOKIE = 'mc_session';

export const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: isProd,
  path: '/',
  maxAge: config.SESSION_TTL_DAYS * 86400 * 1000,
});

export async function createSession(res, req, userId) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + config.SESSION_TTL_DAYS * 86400 * 1000);
  await query(
    'INSERT INTO sessions (user_id, token_hash, user_agent, ip, expires_at) VALUES ($1,$2,$3,$4,$5)',
    [userId, sha256(token), req.get('user-agent')?.slice(0, 300) ?? null, req.ip, expires],
  );
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

export async function destroySession(req, res) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions(), maxAge: undefined });
}

/** Attaches req.user when a valid session cookie is present. Never rejects. */
export async function loadUser(req, _res, next) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) {
      req.user = await one(
        `SELECT u.id, u.email, u.name, u.role, u.phone
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = $1 AND s.expires_at > now() AND u.is_active`,
        [sha256(token)],
      );
    }
    next();
  } catch (err) {
    next(err);
  }
}

export const requireAuth = (req, _res, next) => (req.user ? next() : next(unauthorized()));

export const requireRole = (role) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== role) return next(forbidden());
  next();
};
