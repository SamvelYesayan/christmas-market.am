// Adapter for the real Magical Pioneer Card system (magical-full, server/pioneer.js).
// It uses ONLY the cardholder endpoints that system already exposes:
//   POST /api/pioneer/login   {cardNumber, cvv}  → 200 + HttpOnly cookie `mg_pioneer` (Max-Age = session TTL)
//                                                 → 401 invalid_credentials · 403 card_inactive · 422 validation_failed
//                                                 → 429 too_many_attempts / card_locked (Retry-After)
//   GET  /api/pioneer/me | /transactions | /rewards | /announcements   (cookie session; 401 when it expired)
//   POST /api/pioneer/logout  (cookie session + X-CSRF-Token)
// The Pioneer database stays the source of truth for the card, its owner name and its points.
// There is no endpoint for crediting or debiting points from outside, so this adapter does not do either.

const COOKIE = 'mg_pioneer';

export class MagicalPioneerClient {
  mode = 'magical';
  configured = true;
  supportsCredit = false; // no partner endpoint exists in the Pioneer system
  supportsRedeem = false; // store offers cannot spend Pioneer points; Pioneer rewards are claimed in the Pioneer portal

  constructor(config, PioneerError) {
    this.base = config.PIONEER_API_BASE_URL.replace(/\/$/, '');
    this.timeout = config.PIONEER_API_TIMEOUT_MS;
    this.portalUrl = config.PIONEER_PORTAL_URL || `${this.base}/pioneer-card`;
    this.Err = PioneerError;
  }

  async #call(method, path, { token, body, csrf } = {}) {
    let res;
    try {
      res = await fetch(this.base + path, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Cookie: `${COOKIE}=${token}` } : {}),
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeout),
      });
    } catch (err) {
      throw new this.Err('upstream_error', `Pioneer service unreachable (${err.name}).`);
    }
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  #fail(res, data) {
    const code = data?.error?.code;
    if (res.status === 401 && code === 'unauthenticated') throw new this.Err('session_expired', 'Pioneer session expired.');
    if (res.status === 401 || res.status === 422) {
      const e = new this.Err('invalid_card', 'Card number or verification code is incorrect.');
      const left = data?.error?.fields?.attemptsBeforeLock;
      if (Number.isInteger(left)) e.attemptsLeft = left;
      throw e;
    }
    if (res.status === 403 && code === 'card_inactive') throw new this.Err('card_inactive', 'This Pioneer Card is not active.');
    if (res.status === 429) {
      // card_locked / too_many_attempts concern one card; rate_limited is the Pioneer system's per-IP limit,
      // which every store customer shares (all verifications come from the store server).
      const e = new this.Err(code === 'card_locked' ? 'card_locked' : code === 'too_many_attempts' ? 'too_many_attempts' : 'service_busy', 'Too many attempts.');
      e.retryAfter = Number(res.headers.get('retry-after')) || null;
      throw e;
    }
    throw new this.Err('upstream_error', `Pioneer service error (${res.status}).`);
  }

  /** Verifies card number + CVV with the Pioneer system. Returns its cardholder session (never the CVV). */
  async login(cardNumber, cvv) {
    const { res, data } = await this.#call('POST', '/api/pioneer/login', { body: { cardNumber, cvv } });
    if (!res.ok) this.#fail(res, data);
    const cookie = (res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? '']).find((c) => c.startsWith(`${COOKIE}=`));
    const token = cookie?.slice(COOKIE.length + 1).split(';')[0];
    if (!token) throw new this.Err('upstream_error', 'Pioneer service did not open a session.');
    const maxAge = Number(/max-age=(\d+)/i.exec(cookie)?.[1] ?? 3600);
    return { token, expiresAt: new Date(Date.now() + Math.max(60, maxAge - 60) * 1000) };
  }

  async #get(token, path) {
    const { res, data } = await this.#call('GET', path, { token });
    if (!res.ok) this.#fail(res, data);
    return data;
  }

  /** Card owner, number and the authoritative balance. */
  async me(token) {
    const d = await this.#get(token, '/api/pioneer/me');
    const number = String(d?.card?.number ?? '');
    if (!/^\d{8}$/.test(number)) throw new this.Err('upstream_error', 'Unexpected Pioneer response.');
    return {
      number,
      holderName: d.card.hasName ? d.card.displayName : null,
      memberSince: d.card.memberSince ?? null,
      balance: Number(d.balance),
      csrf: d.csrfToken ?? null,
    };
  }

  async transactions(token, pageSize = 10) {
    const d = await this.#get(token, `/api/pioneer/transactions?pageSize=${pageSize}`);
    return (d.items ?? []).map((t) => ({ id: t.id, type: t.type, points: t.amount, balanceAfter: t.balanceAfter, description: t.description, date: t.createdAt }));
  }

  async rewards(token) {
    const d = await this.#get(token, '/api/pioneer/rewards');
    return (d.items ?? []).map((r) => ({
      id: r.id, title: r.title, description: r.description, pointsCost: r.pointsCost, discountPercent: r.discountPercent ?? null,
      discountAmount: r.discountAmount ?? null, available: !!r.available, upcoming: !!r.upcoming, soldOut: !!r.soldOut, availableUntil: r.availableUntil ?? null,
    }));
  }

  async announcements(token) {
    const d = await this.#get(token, '/api/pioneer/announcements');
    return (d.items ?? []).slice(0, 5).map((a) => ({ id: a.id, title: a.title, body: a.body, date: a.createdAt }));
  }

  /** Ends the cardholder session in the Pioneer system (best effort). */
  async logout(token) {
    try {
      const { csrf } = await this.me(token);
      await this.#call('POST', '/api/pioneer/logout', { token, csrf });
    } catch { /* already expired or unreachable: nothing to end */ }
  }
}
