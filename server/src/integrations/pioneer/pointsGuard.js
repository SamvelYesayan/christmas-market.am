// Safety guard for Pioneer points (POST /points/credit and /points/debit change REAL balances).
//
//   • production (NODE_ENV=production): allowed, unless MAGICAL_POINTS=off (kill switch).
//   • any other environment: allowed ONLY when the Magical API is on this machine (localhost / 127.0.0.1 / ::1),
//     i.e. the local mock (npm run magical:mock) or a local Magical. There is deliberately no override: a development
//     or test server can never move points on magical.am, even with a production key and granted scopes.
//
// Card linking and read-only calls are not affected by this guard.

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLoopbackUrl(url) {
  try { return LOOPBACK.has(new URL(url).hostname.toLowerCase()); } catch { return false; }
}

/** → { allowed, reason } — reason is a short code for logs and the admin page. */
export function pointsPolicy({ nodeEnv, baseUrl, pointsSwitch = 'auto' }) {
  if (pointsSwitch === 'off') return { allowed: false, reason: 'switched_off' };
  if (!baseUrl) return { allowed: false, reason: 'not_configured' };
  if (nodeEnv === 'production') return { allowed: true, reason: 'production' };
  if (isLoopbackUrl(baseUrl)) return { allowed: true, reason: 'local_magical' };
  return { allowed: false, reason: 'non_production_remote' };
}
