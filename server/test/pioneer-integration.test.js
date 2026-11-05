// End-to-end: a real store server process talking to a mocked Magical Integration API.
// Covers the customer flow, error mapping, unlinking, outages, and that CVVs / API keys / card numbers are
// never logged or stored. Uses the database from server/.env (creates its own test users; deletes nothing).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createMagicalMock, MOCK_KEY } from './helpers/magicalMock.js';

const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = (process.env.APP_ORIGIN ?? 'http://localhost:5173').split(',')[0];
const CARD = '48151623';
const CVV = '904';
const mock = createMagicalMock();
let child;
let logs = '';
let BASE;

const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

function client() {
  const jar = new Map();
  return async (method, p, body) => {
    const res = await fetch(BASE + p, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Locale': 'en', Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)); }
    return { status: res.status, data: await res.json().catch(() => null) };
  };
}
const register = async (c, label) => {
  const r = await c('POST', '/auth/register', { name: `Pioneer ${label}`, email: `pioneer-${label}-${Date.now()}@christmas-market.test`, password: 'snowy-password-123' });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.user.id;
};

before(async () => {
  const mockUrl = await mock.start();
  const port = await freePort();
  BASE = `http://127.0.0.1:${port}/api/v1`;
  child = spawn(process.execPath, ['--env-file-if-exists=.env', 'src/index.js'], {
    cwd: serverDir,
    env: { ...process.env, PORT: String(port), PIONEER_MODE: 'auto', MAGICAL_PIONEER_API_URL: mockUrl, MAGICAL_PIONEER_API_KEY: MOCK_KEY, MAGICAL_PIONEER_TIMEOUT_MS: '1500', LOG_LEVEL: 'debug' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => { logs += d; });
  child.stderr.on('data', (d) => { logs += d; });
  for (let i = 0; i < 60; i++) {
    if (/Magical Pioneer API (key OK|check failed)/.test(logs)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
});
after(async () => {
  child?.kill();
  await mock.stop();
});

test('startup validates the API key with GET /me (key not printed)', () => {
  assert.match(logs, /Magical Pioneer API key OK \(client "christmas-store"/);
  assert.ok(mock.state.requests.some((r) => r.url.endsWith('/me')));
});

let userA;
const a = client();
test('customer links a card: wrong code, then success with live balance', async () => {
  userA = await register(a, 'a');
  const status = await a('GET', '/pioneer/status');
  assert.equal(status.data.available, true);
  assert.equal(status.data.pointsRedeemable, false);

  const bad = await a('POST', '/pioneer/link', { cardNumber: CARD, verificationCode: '000' });
  assert.equal(bad.status, 400);
  assert.equal(bad.data.error.code, 'invalid_card');
  assert.equal(bad.data.error.details.attemptsLeft, 2);
  assert.equal(bad.data.error.message, 'The card number or security code is incorrect.');

  const forged = await a('POST', '/pioneer/link', { cardNumber: CARD, verificationCode: CVV, customerId: 'someone-else' });
  assert.equal(forged.status, 400, 'a browser-supplied customer id is refused');

  const ok = await a('POST', '/pioneer/link', { cardNumber: '4815 1623', verificationCode: CVV });
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(ok.data.card.masked, '•••• 1623');
  assert.equal(ok.data.balance, 220);
  const sent = mock.state.requests.filter((r) => r.url.endsWith('/links')).at(-1);
  assert.equal(JSON.parse(sent.body).customerId, userA, 'Magical receives the signed-in user id');
});

test('dashboard shows Magical card, balance, transactions and reward eligibility', async () => {
  const s = await a('GET', '/pioneer/summary');
  assert.equal(s.data.linked, true);
  assert.equal(s.data.live, true);
  assert.equal(s.data.balance.points, 220);
  assert.equal(s.data.card.holderName, 'Աննա Գրիգորյան');
  assert.equal(s.data.card.status, 'active');
  assert.equal(s.data.transactions.total, 25);
  assert.equal(s.data.transactions.items.length, 20);
  assert.equal(s.data.rewards.find((r) => r.id === 3).eligible, true);
  assert.deepEqual(s.data.rewards.find((r) => r.id === 7).reasons, ['insufficient_points']);
  const p2 = await a('GET', '/pioneer/transactions?page=2');
  assert.equal(p2.data.items.length, 5);
  const el = await a('GET', '/pioneer/rewards/7/eligibility');
  assert.equal(el.data.shortfall, 4780);
  const catalog = await a('GET', '/pioneer/rewards');
  assert.equal(catalog.data.items.length, 2);
  const me = await a('GET', '/auth/me');
  assert.equal(me.data.user.pioneer.cardMasked, '•••• 1623');
  const product = await a('GET', '/products/glass-pomegranate');
  const inStock = product.data.product.variants.find((v) => v.stock > 1) ?? product.data.product.variants[0]; // other tests use up stock
  assert.equal((await a('POST', '/cart/items', { variantId: inStock.id, quantity: 1 })).status, 201);
  const cart = await a('GET', '/cart');
  assert.equal(cart.data.hasPioneer, true, 'member discount applies');
  assert.ok(cart.data.pioneerDiscount > 0);
});

test('one card per account and one account per card; inactive card; lockouts', async () => {
  const again = await a('POST', '/pioneer/link', { cardNumber: '42424242', verificationCode: '111' });
  assert.equal(again.status, 409);
  assert.equal(again.data.error.code, 'already_linked');

  const b = client();
  await register(b, 'b');
  const taken = await b('POST', '/pioneer/link', { cardNumber: CARD, verificationCode: CVV });
  assert.equal(taken.status, 409);
  assert.equal(taken.data.error.code, 'card_taken');
  assert.equal(taken.data.error.message, 'This Pioneer Card is already connected to another account.');
  const inactive = await b('POST', '/pioneer/link', { cardNumber: '13131313', verificationCode: '222' });
  assert.equal(inactive.data.error.code, 'card_inactive');
  const many = await b('POST', '/pioneer/link', { cardNumber: '77777777', verificationCode: '123' });
  assert.equal(many.status, 429);
  assert.equal(many.data.error.code, 'too_many_attempts');
  const locked = await b('POST', '/pioneer/link', { cardNumber: '66666666', verificationCode: '123' });
  assert.equal(locked.data.error.code, 'card_locked');
  mock.state.rateLimited = true;
  try {
    const rl = await b('POST', '/pioneer/link', { cardNumber: '42424242', verificationCode: '111' });
    assert.equal(rl.status, 503);
    assert.equal(rl.data.error.code, 'pioneer_busy');
  } finally {
    mock.state.rateLimited = false;
  }
});

test('Magical outage or timeout: friendly error, last known balance marked not live', async () => {
  mock.state.down = true;
  try {
    const s = await (async () => { await new Promise((r) => setTimeout(r, 5200)); return a('GET', '/pioneer/summary'); })(); // let the 5 s cache expire
    assert.equal(s.status, 200);
    assert.equal(s.data.live, false);
    assert.equal(s.data.balance.points, 220);
    assert.equal(s.data.balance.live, false);
    assert.ok(!/server_error|stack/i.test(JSON.stringify(s.data)));
  } finally {
    mock.state.down = false;
  }
  mock.state.slowMs = 2500;
  try {
    const c = client();
    await register(c, 'slow');
    const r = await c('POST', '/pioneer/link', { cardNumber: '42424242', verificationCode: '111' });
    assert.equal(r.status, 503);
    assert.equal(r.data.error.code, 'pioneer_upstream');
  } finally {
    mock.state.slowMs = 0;
  }
});

test('revoked API key: customers get a neutral message, nothing about credentials', async () => {
  mock.state.revokeKey = true;
  try {
    const c = client();
    await register(c, 'revoked');
    const r = await c('POST', '/pioneer/link', { cardNumber: '42424242', verificationCode: '111' });
    assert.equal(r.status, 503);
    assert.equal(r.data.error.code, 'pioneer_config');
    assert.ok(!/api.?key|bearer|mgpc_/i.test(JSON.stringify(r.data)));
  } finally {
    mock.state.revokeKey = false;
  }
});

test('customer unlinks (confirmation required); Magical-side unlink is reconciled', async () => {
  assert.equal((await a('DELETE', '/pioneer/link', {})).status, 400);
  const un = await a('DELETE', '/pioneer/link', { confirm: true });
  assert.equal(un.status, 200);
  assert.equal(mock.links.has(userA), false, 'unlinked in Magical');
  assert.equal((await a('GET', '/pioneer/summary')).data.linked, false);
  assert.equal((await a('GET', '/cart')).data.hasPioneer, false);

  // Link again, then unlink on Magical's side only → the store notices and updates its record.
  assert.equal((await a('POST', '/pioneer/link', { cardNumber: CARD, verificationCode: CVV })).status, 201);
  mock.links.delete(userA);
  await new Promise((r) => setTimeout(r, 5200));
  const s = await a('GET', '/pioneer/summary');
  assert.equal(s.data.linked, false);
  assert.equal(s.data.unlinkedRemotely, true);
});

test('CVVs, API keys and full card numbers are never logged or stored', async () => {
  assert.ok(logs.length > 0);
  assert.ok(!logs.includes(MOCK_KEY), 'API key not in logs');
  assert.ok(!logs.includes(CARD) && !logs.includes('4815 1623'), 'full card number not in logs');
  assert.ok(!/"cvv"|verificationCode"?\s*[:=]\s*"?\d{3}/i.test(logs), 'no CVV in logs');

  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await db.query(
      `SELECT row_to_json(l)::text AS j FROM pioneer_links l WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'pioneer-%@christmas-market.test')
       UNION ALL SELECT row_to_json(e)::text FROM pioneer_link_events e WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'pioneer-%@christmas-market.test')`);
    assert.ok(rows.length > 0);
    for (const { j } of rows) {
      assert.ok(!j.includes(CARD), 'no full card number stored');
      assert.ok(!j.includes(MOCK_KEY), 'no API key stored');
      assert.ok(!/"(cvv|verification_code)"/.test(j), 'no CVV column/value stored');
    }
    const { rows: [l] } = await db.query(`SELECT upstream_session FROM pioneer_links WHERE user_id=$1 ORDER BY linked_at DESC LIMIT 1`, [userA]);
    assert.equal(l.upstream_session, null, 'no session tokens stored');
  } finally {
    await db.end();
  }
});
