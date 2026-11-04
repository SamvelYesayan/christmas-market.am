import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';
import { MagicalApiError, MagicalPioneerClient } from './magicalClient.js';

export { MagicalApiError };

/** Value stored in pioneer_links.provider for links made through the Magical Integration API. */
export const PROVIDER = 'magical_api';

class DisabledPioneerClient {
  mode = 'disabled';
  provider = PROVIDER; // existing links stay visible (and unchanged) while the integration is switched off
  configured = false;
  supportsCredit = false;
  supportsRedeem = false;
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
}

// The official Magical Pioneer Integration API is used when both MAGICAL_PIONEER_API_URL and
// MAGICAL_PIONEER_API_KEY are set (and PIONEER_MODE is not 'disabled'). Nothing is ever simulated.
function build() {
  if (config.PIONEER_MODE === 'disabled' || !config.MAGICAL_PIONEER_API_URL || !config.MAGICAL_PIONEER_API_KEY) {
    return new DisabledPioneerClient();
  }
  return new MagicalPioneerClient({
    baseUrl: config.MAGICAL_PIONEER_API_URL,
    apiKey: config.MAGICAL_PIONEER_API_KEY,
    timeoutMs: config.MAGICAL_PIONEER_TIMEOUT_MS,
  });
}

export const pioneer = build();

/** Result of the startup key check, shown to admins (never contains the key). */
export const pioneerHealth = { checkedAt: null, ok: null, code: null, client: null, scopes: [] };

const REQUIRED_SCOPES = ['cards:verify', 'cards:link', 'cards:read', 'rewards:read'];

/** Validates the API key with GET /me. Logs a clear, credential-free result; never throws. */
export async function checkPioneerConnection() {
  pioneerHealth.checkedAt = new Date().toISOString();
  if (!pioneer.configured) {
    const missing = ['MAGICAL_PIONEER_API_URL', 'MAGICAL_PIONEER_API_KEY'].filter((k) => !config[k]);
    Object.assign(pioneerHealth, { ok: false, code: 'not_configured', client: null, scopes: [] });
    logger.warn(config.PIONEER_MODE === 'disabled'
      ? 'Magical Pioneer integration disabled (PIONEER_MODE=disabled).'
      : `Magical Pioneer integration not configured — set ${missing.join(' and ')} in server/.env.`);
    return pioneerHealth;
  }
  try {
    const { client } = await pioneer.me();
    const missingScopes = REQUIRED_SCOPES.filter((s) => !client?.scopes?.includes(s));
    Object.assign(pioneerHealth, { ok: missingScopes.length === 0, code: missingScopes.length ? 'insufficient_scope' : null, client: client?.name ?? null, scopes: client?.scopes ?? [] });
    if (missingScopes.length) logger.error(`Magical Pioneer API key is valid (client "${client?.name}") but lacks scopes: ${missingScopes.join(', ')}.`);
    else logger.info(`Magical Pioneer API key OK (client "${client?.name}", ${config.MAGICAL_PIONEER_API_URL}).`);
  } catch (err) {
    Object.assign(pioneerHealth, { ok: false, code: err.code ?? 'error', client: null, scopes: [] });
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
