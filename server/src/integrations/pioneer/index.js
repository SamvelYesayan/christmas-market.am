import { config } from '../../config.js';
import { MagicalPioneerClient } from './magicalClient.js';

export class PioneerError extends Error {
  /** code: not_configured | invalid_card | card_inactive | too_many_attempts | card_locked | service_busy | session_expired | upstream_error */
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

class DisabledPioneerClient {
  mode = 'disabled';
  configured = false;
  supportsCredit = false;
  supportsRedeem = false;
  portalUrl = null;
  #fail() {
    throw new PioneerError('not_configured', 'The Magical Pioneer Card connection is not available yet.');
  }
  async login() { this.#fail(); }
  async me() { this.#fail(); }
  async transactions() { this.#fail(); }
  async rewards() { this.#fail(); }
  async announcements() { this.#fail(); }
  async logout() {}
}

// PIONEER_MODE=magical connects to the real Magical Pioneer Card system. Anything else (or missing
// settings) leaves the connection disabled — the store never simulates a card or a balance.
function build() {
  if (config.PIONEER_MODE === 'magical' && config.PIONEER_API_BASE_URL && config.PIONEER_SESSION_KEY) {
    return new MagicalPioneerClient(config, PioneerError);
  }
  return new DisabledPioneerClient();
}

export const pioneer = build();
