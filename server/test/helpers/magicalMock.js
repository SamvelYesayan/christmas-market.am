// In-memory mock of the Magical Pioneer Card Integration API v1 (contract: magical-full/docs/PIONEER_CARD_API.md).
// Used by the automated tests so they never need a real Magical API key.
import http from 'node:http';

export const MOCK_KEY = 'mgpc_test_mock_key_0123456789abcdefghijklmnopqrstu';

const named = { firstName: 'Աննա', lastName: 'Գրիգորյան', displayName: 'Աննա Գրիգորյան' };
const unnamed = { firstName: null, lastName: null, displayName: 'Pioneer Member' };

export function createMagicalMock({ key = MOCK_KEY, scopes = ['cards:verify', 'cards:link', 'cards:read', 'rewards:read'] } = {}) {
  const cards = {
    '48151623': { cvv: '904', status: 'active', balance: 220, ...named },
    '42424242': { cvv: '111', status: 'active', balance: 40, ...unnamed },
    '13131313': { cvv: '222', status: 'inactive', balance: 0, ...named },
  };
  const LOCKED_TEMP = '77777777';
  const LOCKED_HARD = '66666666';
  const links = new Map(); // customerId -> { cardNumber, linkedAt }
  const rewards = [
    { id: 3, kind: 'course_discount', title: 'Web Programming', description: '10% off the next course', icon: 'code', pointsCost: 100, discountPercent: 10, discountAmount: null, availableFrom: null, availableUntil: null, availabilityNote: '', perCardLimit: 1, upcoming: false, soldOut: false },
    { id: 7, kind: 'reward', title: 'Laptop', description: '', icon: 'gift', pointsCost: 5000, discountPercent: null, discountAmount: null, availableFrom: null, availableUntil: null, availabilityNote: '', perCardLimit: null, upcoming: false, soldOut: false },
  ];
  const state = { requests: [], down: false, slowMs: 0, rateLimited: false, revokeKey: false };

  const cardOut = (no) => {
    const c = cards[no];
    return { number: `•••• ${no.slice(4)}`, last4: no.slice(4), firstName: c.firstName, lastName: c.lastName, displayName: c.displayName, status: c.status, memberSince: '2026-10-31T09:12:44.120Z' };
  };
  const linkOut = (customerId) => {
    const l = links.get(customerId);
    return { customerId, linkedAt: l.linkedAt, card: cardOut(l.cardNumber), balance: cards[l.cardNumber].balance };
  };
  const txFor = (no) => Array.from({ length: 25 }, (_, i) => ({
    id: String(100 - i), type: i === 24 ? 'initial_bonus' : 'admin_credit', label: i === 24 ? 'Մեկնարկային բոնուս' : 'Ադմինիստրատիվ հավելում',
    description: i === 24 ? 'Pioneer Card-ի մեկնարկային բոնուս' : 'Test credit', amount: i === 24 ? 200 : 1, balanceAfter: cards[no].balance - i, createdAt: new Date(Date.UTC(2026, 10, 4, 10, 0, 0) - i * 60000).toISOString(),
  }));
  const eligibility = (no, r) => {
    const c = cards[no];
    const reasons = [];
    if (c.status !== 'active') reasons.push('card_inactive');
    if (c.balance < r.pointsCost) reasons.push('insufficient_points');
    return { redeemedByCard: 0, limitReached: false, affordable: c.balance >= r.pointsCost, shortfall: Math.max(0, r.pointsCost - c.balance), eligible: reasons.length === 0, reasons };
  };

  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const ch of req) chunks.push(ch);
    const raw = Buffer.concat(chunks).toString('utf8');
    state.requests.push({ method: req.method, url: req.url, headers: { ...req.headers }, body: raw });
    const send = (status, body, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(body)); };
    const fail = (status, code, extra = {}, headers = {}) => send(status, { error: { code, message: code, ...extra } }, headers);

    if (state.slowMs) await new Promise((r) => setTimeout(r, state.slowMs));
    if (state.down) return fail(500, 'server_error');
    if (req.headers.origin) return fail(403, 'browser_requests_not_allowed');
    if (state.revokeKey || req.headers.authorization !== `Bearer ${key}`) return fail(401, 'invalid_api_key');
    if (state.rateLimited) return fail(429, 'rate_limited', {}, { 'Retry-After': '60' });
    let body = {};
    if (raw) {
      if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) return fail(415, 'unsupported_media_type');
      try { body = JSON.parse(raw); } catch { return fail(400, 'bad_json'); }
    }
    const url = new URL(req.url, 'http://mock');
    const path = url.pathname.replace(/^\/api\/integration\/v1/, '');
    const need = (scope) => (scopes.includes(scope) ? null : fail(403, 'insufficient_scope'));
    const cardNo = String(body.cardNumber ?? '').replace(/[\s-]/g, '');
    const checkCredentials = () => {
      if (!/^\d{8}$/.test(cardNo) || !/^\d{3}$/.test(String(body.cvv ?? ''))) { fail(422, 'validation_failed', { fields: { cardNumber: 'Must be the 8-digit card number.' } }); return false; }
      if (cardNo === LOCKED_TEMP) { fail(429, 'too_many_attempts', {}, { 'Retry-After': '30' }); return false; }
      if (cardNo === LOCKED_HARD) { fail(429, 'card_locked'); return false; }
      return true;
    };

    if (req.method === 'GET' && path === '/me') return send(200, { client: { name: 'christmas-store', scopes } });

    if (req.method === 'POST' && path === '/cards/verify') {
      if (need('cards:verify')) return;
      if (!checkCredentials()) return;
      const c = cards[cardNo];
      if (!c || c.cvv !== body.cvv) return send(200, { valid: false, reason: 'invalid_credentials', attemptsBeforeLock: 2 });
      return send(200, { valid: true, card: { ...cardOut(cardNo), linked: [...links.values()].some((l) => l.cardNumber === cardNo) } });
    }

    if (req.method === 'POST' && path === '/links') {
      if (need('cards:link')) return;
      const customerId = String(body.customerId ?? '');
      if (!/^[A-Za-z0-9._:@-]{1,128}$/.test(customerId)) return fail(422, 'validation_failed', { fields: { customerId: 'invalid' } });
      if (!checkCredentials()) return;
      const c = cards[cardNo];
      if (!c || c.cvv !== body.cvv) return fail(422, 'invalid_card_credentials', { fields: { attemptsBeforeLock: 2 } });
      if (c.status !== 'active') return fail(403, 'card_inactive');
      const mine = links.get(customerId);
      if (mine && mine.cardNumber === cardNo) return send(200, { link: linkOut(customerId) });
      if ([...links.entries()].some(([cid, l]) => l.cardNumber === cardNo && cid !== customerId)) return fail(409, 'card_already_linked');
      if (mine) return fail(409, 'customer_already_linked');
      links.set(customerId, { cardNumber: cardNo, linkedAt: new Date().toISOString() });
      return send(201, { link: linkOut(customerId) });
    }

    if (req.method === 'GET' && path === '/rewards') { if (need('rewards:read')) return; return send(200, { items: rewards }); }

    const m = path.match(/^\/customers\/([^/]+)(\/.*)$/);
    if (m) {
      const customerId = decodeURIComponent(m[1]);
      const rest = m[2];
      const l = links.get(customerId);
      if (req.method === 'DELETE' && rest === '/link') {
        if (need('cards:link')) return;
        if (!l) return fail(404, 'link_not_found');
        links.delete(customerId);
        return send(200, { unlinked: true, customerId });
      }
      if (!l) return fail(404, 'link_not_found');
      if (req.method === 'GET' && rest === '/card') { if (need('cards:read')) return; return send(200, { link: linkOut(customerId) }); }
      if (req.method === 'GET' && rest === '/transactions') {
        if (need('cards:read')) return;
        const all = txFor(l.cardNumber);
        const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));
        const page = Math.min(Math.max(1, Number(url.searchParams.get('page')) || 1), Math.ceil(all.length / pageSize));
        return send(200, { balance: cards[l.cardNumber].balance, items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length, page, pageSize });
      }
      if (req.method === 'GET' && rest === '/rewards') {
        if (need('rewards:read')) return;
        return send(200, { balance: cards[l.cardNumber].balance, cardStatus: cards[l.cardNumber].status, items: rewards.map((r) => ({ ...r, ...eligibility(l.cardNumber, r) })) });
      }
      const e = rest.match(/^\/rewards\/(\d+)\/eligibility$/);
      if (req.method === 'GET' && e) {
        if (need('rewards:read')) return;
        const r = rewards.find((x) => x.id === Number(e[1]));
        if (!r) return fail(404, 'reward_not_found');
        const el = eligibility(l.cardNumber, r);
        return send(200, { rewardId: r.id, title: r.title, pointsCost: r.pointsCost, balance: cards[l.cardNumber].balance, eligible: el.eligible, affordable: el.affordable, shortfall: el.shortfall, reasons: el.reasons });
      }
    }
    return fail(404, 'not_found');
  });

  return {
    state, links, cards, key,
    async start() {
      await new Promise((r) => server.listen(0, '127.0.0.1', r));
      return `http://127.0.0.1:${server.address().port}/api/integration/v1`;
    },
    stop: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); }),
  };
}
