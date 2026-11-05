// Client for the official Magical Pioneer Card Integration API v1 (server-to-server).
//   Base URL: MAGICAL_PIONEER_API_URL (e.g. https://magical.am/api/integration/v1)
//   Auth:     Authorization: Bearer <MAGICAL_PIONEER_API_KEY>   (scopes: cards:verify, cards:link, cards:read, rewards:read)
// Reference: magical-full/docs/PIONEER_CARD_API.md. Magical is the source of truth for links, balances,
// transactions and rewards. Points are credited/debited only through POST /points/credit|debit (scopes
// points:credit / points:debit, granted separately by a Magical administrator), always with an Idempotency-Key.
//
// Security: the API key is only ever placed in the Authorization header. It is never logged, returned or
// included in error messages. Card numbers and CVVs are only sent in request bodies and never kept.

export class MagicalApiError extends Error {
  /**
   * code: the Magical error code (invalid_card_credentials, card_already_linked, …) or one of the client's own:
   *   timeout | unreachable | bad_response | not_configured
   */
  constructor(code, { status = null, fields = null, retryAfter = null, message } = {}) {
    super(message ?? `Magical Pioneer API: ${code}`);
    this.name = 'MagicalApiError';
    this.code = code;
    this.status = status;
    this.fields = fields;
    this.retryAfter = retryAfter;
  }
}

const enc = encodeURIComponent;

export class MagicalPioneerClient {
  mode = 'magical_api';
  provider = 'magical_api';
  configured = true;

  constructor({ baseUrl, apiKey, timeoutMs = 10_000, fetchImpl = globalThis.fetch, allowPoints = false } = {}) {
    if (!baseUrl || !apiKey) throw new Error('MagicalPioneerClient needs baseUrl and apiKey');
    this.base = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
    // Points change real balances: off unless the caller explicitly allows them (see pointsGuard.js).
    Object.defineProperty(this, 'allowPoints', { value: allowPoints === true, enumerable: true, writable: false });
    // Keep the key off the instance's enumerable fields so it can't leak through JSON/inspection.
    Object.defineProperty(this, 'authHeader', { value: `Bearer ${apiKey}`, enumerable: false });
  }

  async #request(path, opts = {}) {
    return (await this.#send(path, opts)).data;
  }

  async #send(path, { method = 'GET', body, headers: extra = {} } = {}) {
    let res;
    try {
      res = await this.fetch(this.base + path, {
        method,
        headers: {
          Authorization: this.authHeader,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...extra,
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      throw new MagicalApiError(timedOut ? 'timeout' : 'unreachable');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const retry = Number(res.headers.get('retry-after'));
      throw new MagicalApiError(data?.error?.code ?? (res.status >= 500 ? 'server_error' : 'bad_response'), {
        status: res.status,
        fields: data?.error?.fields ?? null,
        retryAfter: Number.isFinite(retry) && retry > 0 ? retry : null,
      });
    }
    if (data === null || typeof data !== 'object') throw new MagicalApiError('bad_response', { status: res.status });
    return { data, status: res.status, replayed: res.headers.get('idempotent-replayed') === 'true' };
  }

  /** GET /me — validates the key. → { client: { name, scopes } } */
  me() { return this.#request('/me'); }

  /** POST /cards/verify → { valid: true, card } | { valid: false, reason, attemptsBeforeLock } */
  verifyCard(cardNumber, cvv) { return this.#request('/cards/verify', { method: 'POST', body: { cardNumber, cvv } }); }

  /** POST /links — links the card to the store customer. → { link: { customerId, linkedAt, card, balance } } */
  link(customerId, cardNumber, cvv) { return this.#request('/links', { method: 'POST', body: { customerId: String(customerId), cardNumber, cvv } }); }

  /** DELETE /customers/{id}/link → { unlinked: true, customerId } */
  unlink(customerId) { return this.#request(`/customers/${enc(customerId)}/link`, { method: 'DELETE' }); }

  /** GET /customers/{id}/card → { link: { customerId, linkedAt, card, balance } } */
  card(customerId) { return this.#request(`/customers/${enc(customerId)}/card`); }

  /** GET /customers/{id}/transactions → { balance, items, total, page, pageSize } */
  transactions(customerId, page = 1, pageSize = 20) {
    return this.#request(`/customers/${enc(customerId)}/transactions?page=${Number(page) || 1}&pageSize=${Number(pageSize) || 20}`);
  }

  /** GET /rewards → { items } */
  rewards() { return this.#request('/rewards'); }

  /** GET /customers/{id}/rewards → { balance, cardStatus, items (with eligibility) } */
  customerRewards(customerId) { return this.#request(`/customers/${enc(customerId)}/rewards`); }

  /** GET /customers/{id}/rewards/{rewardId}/eligibility */
  eligibility(customerId, rewardId) { return this.#request(`/customers/${enc(customerId)}/rewards/${enc(rewardId)}/eligibility`); }

  /**
   * POST /points/credit | /points/debit. One attempt; the caller retries with the SAME idempotency key.
   * body: { customerId, points, reference, reason, description? }
   * → { transaction: { id, type, points, amount, balanceAfter, customerId, reference, reason, description, createdAt }, replayed }
   */
  async #points(kind, idempotencyKey, body) {
    if (!this.allowPoints) throw new MagicalApiError('points_blocked'); // refused before any network request
    const { data, replayed } = await this.#send(`/points/${kind}`, { method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey } });
    if (!data.transaction || data.transaction.id == null) throw new MagicalApiError('bad_response');
    return { transaction: data.transaction, replayed };
  }
  creditPoints(idempotencyKey, body) { return this.#points('credit', idempotencyKey, body); }
  debitPoints(idempotencyKey, body) { return this.#points('debit', idempotencyKey, body); }
}
