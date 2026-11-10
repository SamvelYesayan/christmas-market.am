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

// ───────── Native mobile app (mobile/) ─────────
// The native app cannot rely on browser cookies, so it identifies itself with `X-Christmas-Client: mobile` and sends
// the same opaque session token as `Authorization: Bearer <token>` (stored only in the device's secure storage).
// The session itself is the same row in `sessions` as a browser session — same TTL, same revocation.
// Browsers never send this header on their own (a cross-site page cannot add it without a CORS preflight, which the
// origin allowlist refuses), so it does not weaken the cookie/CSRF protections of the website.
export const MOBILE_CLIENT_HEADER = 'x-christmas-client';
export const isMobileClient = (req) => req.get(MOBILE_CLIENT_HEADER) === 'mobile';
const TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;

/** Session token from the cookie (website) or, for the native app, from the Authorization header. */
export function sessionToken(req) {
  const cookie = req.cookies?.[SESSION_COOKIE];
  if (cookie) return cookie;
  if (!isMobileClient(req)) return null;
  const m = /^Bearer (.+)$/.exec(req.get('authorization') ?? '');
  return m && TOKEN_RE.test(m[1]) ? m[1] : null;
}

/** Creates a session. The website receives it as an httpOnly cookie; the native app receives the token to store. */
export async function createSession(res, req, userId) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + config.SESSION_TTL_DAYS * 86400 * 1000);
  await query(
    'INSERT INTO sessions (user_id, token_hash, user_agent, ip, expires_at) VALUES ($1,$2,$3,$4,$5)',
    [userId, sha256(token), req.get('user-agent')?.slice(0, 300) ?? null, req.ip, expires],
  );
  if (isMobileClient(req)) return { token, expiresAt: expires.toISOString() };
  res.cookie(SESSION_COOKIE, token, cookieOptions());
  return null;
}

export async function destroySession(req, res) {
  const token = sessionToken(req);
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions(), maxAge: undefined });
}

/** Attaches req.user when a valid session cookie (or mobile bearer token) is present. Never rejects. */
export async function loadUser(req, _res, next) {
  try {
    const token = sessionToken(req);
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
