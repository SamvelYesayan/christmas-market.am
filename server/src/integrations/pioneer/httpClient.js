// Adapter for the real Magical Pioneer Card API. Endpoint paths are configurable via env;
// response field mapping lives in each method so it can be aligned with the real API in one place.
export class HttpPioneerClient {
  mode = 'http';
  configured = true;

  constructor(config, PioneerError) {
    this.base = config.PIONEER_API_BASE_URL.replace(/\/$/, '');
    this.key = config.PIONEER_API_KEY;
    this.timeout = config.PIONEER_API_TIMEOUT_MS;
    this.paths = {
      verify: config.PIONEER_PATH_VERIFY,
      balance: config.PIONEER_PATH_BALANCE,
      history: config.PIONEER_PATH_HISTORY,
      credit: config.PIONEER_PATH_CREDIT,
      redeem: config.PIONEER_PATH_REDEEM,
    };
    this.Err = PioneerError;
  }

  async #request(method, pathTpl, { cardId, body, idempotencyKey } = {}) {
    const path = pathTpl.replace('{cardId}', encodeURIComponent(cardId ?? ''));
    let res;
    try {
      res = await fetch(this.base + path, {
        method,
        headers: {
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.timeout),
      });
    } catch (err) {
      throw new this.Err('upstream_error', `Pioneer service unreachable (${err.name}).`);
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 404 || res.status === 422 || data?.error === 'invalid_card') {
      throw new this.Err('invalid_card', 'Card code or verification code is incorrect.');
    }
    if (res.status === 409 && data?.error === 'insufficient_points') {
      throw new this.Err('insufficient_points', 'Not enough Pioneer points.');
    }
    if (!res.ok) throw new this.Err('upstream_error', `Pioneer service error (${res.status}).`);
    return data;
  }

  async verifyCard(cardCode, verificationCode) {
    const d = await this.#request('POST', this.paths.verify, { body: { cardCode, verificationCode } });
    if (!d?.cardId && !d?.id) throw new this.Err('invalid_card', 'Card could not be verified.');
    return {
      cardId: String(d.cardId ?? d.id),
      maskedNumber: d.maskedNumber ?? `•••• ${String(cardCode).slice(-4)}`,
      tier: d.tier ?? null,
      holderName: d.holderName ?? null,
    };
  }

  async getBalance(cardId) {
    const d = await this.#request('GET', this.paths.balance, { cardId });
    return { points: Number(d.points ?? d.balance ?? 0), tier: d.tier ?? null };
  }

  async getHistory(cardId) {
    const d = await this.#request('GET', this.paths.history, { cardId });
    const items = Array.isArray(d) ? d : d.items ?? d.transactions ?? [];
    return items.map((t) => ({
      id: String(t.id ?? t.reference),
      date: t.date ?? t.createdAt,
      type: t.type ?? (Number(t.points) >= 0 ? 'credit' : 'redeem'),
      points: Number(t.points ?? t.amount ?? 0),
      description: t.description ?? t.note ?? '',
    }));
  }

  async creditPoints(cardId, points, reference, description) {
    const d = await this.#request('POST', this.paths.credit, { cardId, body: { points, reference, description }, idempotencyKey: reference });
    return { balance: d.balance ?? null };
  }

  async redeemPoints(cardId, points, reference, description) {
    const d = await this.#request('POST', this.paths.redeem, { cardId, body: { points, reference, description }, idempotencyKey: reference });
    return { balance: d.balance ?? null };
  }
}
