import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';
import { MagicalApiError, MagicalPioneerClient } from './magicalClient.js';
import { pointsPolicy } from './pointsGuard.js';

export { MagicalApiError };

/** Value stored in pioneer_links.provider for links made through the Magical Integration API. */
export const PROVIDER = 'magical_api';

class DisabledPioneerClient {
  mode = 'disabled';
  provider = PROVIDER; // existing links stay visible (and unchanged) while the integration is switched off
  configured = false;
  #fail() { throw new MagicalApiError('not_configured'); }
  async me() { this.#fail(); }
  async verifyCard() { this.#fail(); }
  async link() { this.#fail(); }
  async unlink() { this.#fail(); }
  async card() { this.#fail(); }
  async transactions() { this.#fail(); }
  async rewards() { this.#fail(); }
  async customerRewards() { this.#fail(); }
  async eligibility() { this.#fail(); }
  async creditPoints() { this.#fail(); }
  async debitPoints() { this.#fail(); }
}

// The official Magical Pioneer Integration API is used when both MAGICAL_PIONEER_API_URL and
// MAGICAL_PIONEER_API_KEY are set (and PIONEER_MODE is not 'disabled'). Nothing is ever simulated.
/** Whether this server may send point credits/debits at all (decided once, at startup, from NODE_ENV and the URL). */
export const pointsPolicyNow = pointsPolicy({ nodeEnv: config.NODE_ENV, baseUrl: config.MAGICAL_PIONEER_API_URL, pointsSwitch: config.MAGICAL_POINTS });
export const pointsAllowed = pointsPolicyNow.allowed;

function build() {
  if (config.PIONEER_MODE === 'disabled' || !config.MAGICAL_PIONEER_API_URL || !config.MAGICAL_PIONEER_API_KEY) {
    return new DisabledPioneerClient();
  }
  return new MagicalPioneerClient({
    baseUrl: config.MAGICAL_PIONEER_API_URL,
    apiKey: config.MAGICAL_PIONEER_API_KEY,
    timeoutMs: config.MAGICAL_PIONEER_TIMEOUT_MS,
    allowPoints: pointsAllowed,
  });
}

export const pioneer = build();

/** Result of the startup key check, shown to admins (never contains the key). */
export const pioneerHealth = { checkedAt: null, ok: null, code: null, client: null, scopes: [], canCredit: false, canDebit: false, points: pointsPolicyNow };

const REQUIRED_SCOPES = ['cards:verify', 'cards:link', 'cards:read', 'rewards:read'];
// Granted separately by a Magical administrator; without them the store keeps game rewards queued and offers no redemptions.
const POINT_SCOPES = ['points:credit', 'points:debit'];

/** Whether Magical has granted this store a points scope (known after the startup GET /me check). */
// Points scopes count only when this server is allowed to move points (production, or a local Magical).
export const hasScope = (scope) => pioneer.configured && pioneerHealth.scopes.includes(scope) && (!scope.startsWith('points:') || pointsAllowed);

/** Validates the API key with GET /me. Logs a clear, credential-free result; never throws. */
export async function checkPioneerConnection() {
  pioneerHealth.checkedAt = new Date().toISOString();
  if (!pioneer.configured) {
    const missing = ['MAGICAL_PIONEER_API_URL', 'MAGICAL_PIONEER_API_KEY'].filter((k) => !config[k]);
    Object.assign(pioneerHealth, { ok: false, code: 'not_configured', client: null, scopes: [], canCredit: false, canDebit: false });
    logger.warn(config.PIONEER_MODE === 'disabled'
      ? 'Magical Pioneer integration disabled (PIONEER_MODE=disabled).'
      : `Magical Pioneer integration not configured — set ${missing.join(' and ')} (or MAGICAL_API_BASE_URL / MAGICAL_API_KEY) in server/.env.`);
    return pioneerHealth;
  }
  try {
    const { client } = await pioneer.me();
    const missingScopes = REQUIRED_SCOPES.filter((s) => !client?.scopes?.includes(s));
    const scopes = Array.isArray(client?.scopes) ? client.scopes : [];
    Object.assign(pioneerHealth, { ok: missingScopes.length === 0, code: missingScopes.length ? 'insufficient_scope' : null, client: client?.name ?? null, scopes,
      canCredit: pointsAllowed && scopes.includes('points:credit'), canDebit: pointsAllowed && scopes.includes('points:debit') });
    const missingPoints = pointsAllowed ? POINT_SCOPES.filter((x) => !scopes.includes(x)) : [];
    if (!missingScopes.length && missingPoints.length) logger.warn(`Magical has not granted ${missingPoints.join(' and ')} to client "${client?.name}": ${missingPoints.includes('points:credit') ? 'game rewards stay queued' : ''}${missingPoints.length === 2 ? ' and ' : ''}${missingPoints.includes('points:debit') ? 'gift redemptions are switched off' : ''} until a Magical administrator grants them.`);
    if (missingScopes.length) logger.error(`Magical Pioneer API key is valid (client "${client?.name}") but lacks scopes: ${missingScopes.join(', ')}.`);
    else logger.info(`Magical Pioneer API key OK (client "${client?.name}", ${config.MAGICAL_PIONEER_API_URL}).`);
  } catch (err) {
    Object.assign(pioneerHealth, { ok: false, code: err.code ?? 'error', client: null, scopes: [], canCredit: false, canDebit: false });
    const why = {
      invalid_api_key: 'the API key is invalid or revoked',
      timeout: 'the request timed out',
      unreachable: 'the server could not be reached',
      https_required: 'Magical requires https',
    }[err.code] ?? `error ${err.code}${err.status ? ` (HTTP ${err.status})` : ''}`;
    logger.error(`Magical Pioneer API check failed: ${why}. Card features will report the service as unavailable until it works.`);
  }
  return pioneerHealth;
}
