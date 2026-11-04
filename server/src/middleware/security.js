import rateLimit from 'express-rate-limit';
import { config, isProd } from '../config.js';
import { forbidden } from '../lib/errors.js';
import { tr } from '../i18n/index.js';

export const allowedOrigins = config.APP_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);

/**
 * CSRF defence in depth (cookies are SameSite=Lax as well): every state-changing request
 * must come from an allowed Origin (or same-origin Referer). Payment provider callbacks are exempt
 * because they are verified by signature instead.
 */
export function originCheck(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path.startsWith('/payments/') && req.path.endsWith('/callback')) return next();
  const origin = req.get('origin') || (req.get('referer') ? new URL(req.get('referer')).origin : null);
  const self = `${req.protocol}://${req.get('host')}`;
  if (origin && (allowedOrigins.includes(origin) || origin === self)) return next();
  next(forbidden('Request origin not allowed.'));
}

const limiter = (windowMs, limit, message, extra = {}) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, ...extra, handler: (req, res, _next, opts) => res.status(opts.statusCode).json({ error: { code: 'rate_limited', message: tr(req.locale, message) } }) });

// Development allows more requests so automated UI sweeps don't trip it; production stays strict.
export const globalLimiter = limiter(60_000, isProd ? 300 : 3000, 'Too many requests — the elves need a short break.');
export const authLimiter = limiter(15 * 60_000, 20, 'Too many sign-in attempts. Please wait a few minutes.');
export const gameLimiter = limiter(60_000, 40, 'Slow down, snow champion.');
// Card verification attempts: per signed-in account (so people sharing an IP don't block each other)
// plus a looser per-IP cap. The Pioneer system additionally locks a card after repeated wrong codes.
const pioneerPerAccount = limiter(15 * 60_000, 8, 'Too many card attempts. Please wait before trying again.', { keyGenerator: (req) => `user:${req.user?.id ?? req.ip}` });
const pioneerPerIp = limiter(15 * 60_000, 30, 'Too many card attempts. Please wait before trying again.');
export const pioneerLimiter = [pioneerPerIp, pioneerPerAccount];
// Christmas wishes: a few per hour per visitor is plenty for a person, and keeps the moderation queue clean.
export const wishLimiter = limiter(60 * 60_000, isProd ? 5 : 60, 'You have sent several wishes already — thank you! Please try again a little later.');
export const writeLimiter = limiter(60_000, 30, 'Too many submissions. Please try again shortly.');
