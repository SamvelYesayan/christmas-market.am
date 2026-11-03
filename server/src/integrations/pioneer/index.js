import { config } from '../../config.js';
import { HttpPioneerClient } from './httpClient.js';
import { SandboxPioneerClient } from './sandboxClient.js';

export class PioneerError extends Error {
  /** code: not_configured | invalid_card | insufficient_points | upstream_error */
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

class DisabledPioneerClient {
  mode = 'disabled';
  configured = false;
  #fail() {
    throw new PioneerError('not_configured', 'The Magical Pioneer Card connection is not available yet.');
  }
  async verifyCard() { this.#fail(); }
  async getBalance() { this.#fail(); }
  async getHistory() { this.#fail(); }
  async creditPoints() { this.#fail(); }
  async redeemPoints() { this.#fail(); }
}

/**
 * PioneerClient contract (all methods async):
 *  verifyCard(cardCode, verificationCode) → { cardId, maskedNumber, tier, holderName? }
 *  getBalance(cardId)                     → { points, tier }
 *  getHistory(cardId)                     → [{ id, date, type, points, description }]
 *  creditPoints(cardId, points, reference, description) → { balance? }
 *  redeemPoints(cardId, points, reference, description) → { balance? }
 * `reference` is an idempotency key — the upstream API must treat repeats as no-ops.
 */
function build() {
  if (config.PIONEER_MODE === 'http') {
    if (!config.PIONEER_API_BASE_URL || !config.PIONEER_API_KEY) return new DisabledPioneerClient();
    return new HttpPioneerClient(config, PioneerError);
  }
  if (config.PIONEER_MODE === 'sandbox') return new SandboxPioneerClient(PioneerError);
  return new DisabledPioneerClient();
}

export const pioneer = build();
