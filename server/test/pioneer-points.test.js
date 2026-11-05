// Pioneer points end-to-end: a real store server process ↔ a mocked Magical Integration API (points:credit and
// points:debit granted). No real Magical account, key or points are ever used. Test users, offers and operations
// created here are removed afterwards; nothing else in the database is touched.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createMagicalMock, MOCK_KEY } from './helpers/magicalMock.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(here, '..');
const ORIGIN = (process.env.APP_ORIGIN ?? 'http://localhost:5173').split(',')[0];
const TAG = `pts${Date.now().toString(36)}`;
const ALL_SCOPES = ['cards:verify', 'cards:link', 'cards:read', 'rewards:read', 'points:credit', 'points:debit'];
const mock = createMagicalMock({ scopes: ALL_SCOPES });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
const users = [];
const offers = {};
let child;
let logs = '';
let BASE;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
function client() {
  const jar = new Map();
  return async (method, p, body) => {
    const res = await fetch(BASE + p, {
      method, body: body ? JSON.stringify(body) : undefined,
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Locale': 'en', Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
    });
    for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)); }
    return { status: res.status, data: await res.json().catch(() => null), raw: res };
  };
}
async function register(c, label) {
  const r = await c('POST', '/auth/register', { name: `Points ${label}`, email: `${label}-${TAG}@christmas-market.test`, password: 'snowy-password-123' });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  users.push(r.data.user.id);
  return r.data.user.id;
}
const balanceOf = (card) => mock.cards[card].balance;
const ledgerFor = (ref) => mock.ledger.filter((t) => t.reference === ref);
const keysSentFor = (ref) => new Set(mock.state.requests.filter((r) => r.url.includes('/points/') && r.body.includes(`"${ref}"`)).map((r) => r.headers['idempotency-key']));
/** The credit operation for a user's reward from a hidden object, once the background send has finished. */
async function settledCredit(userId, key, { timeout = 9000 } = {}) {
  const until = Date.now() + timeout;
  for (;;) {
    const { rows: [op] } = await db.query(
      `SELECT op.* FROM pioneer_point_operations op JOIN reward_grants g ON g.id = op.grant_id
        WHERE g.user_id=$1 AND g.source='hidden' AND g.source_ref=$2`, [userId, key]);
    if (op && op.status !== 'pending' && op.status !== 'processing') return op;
    if (Date.now() > until) return op ?? null;
    await sleep(150);
  }
}
const opForRedemption = async (id) => (await db.query('SELECT * FROM pioneer_point_operations WHERE redemption_id=$1', [id])).rows[0];

before(async () => {
  const mockUrl = await mock.start();
  const port = await freePort();
  BASE = `http://127.0.0.1:${port}/api/v1`;
  const env = { ...process.env, PORT: String(port), PIONEER_MODE: 'auto', MAGICAL_PIONEER_TIMEOUT_MS: '1500', LOG_LEVEL: 'debug',
    MAGICAL_PIONEER_API_URL: mockUrl, MAGICAL_PIONEER_API_KEY: MOCK_KEY, MAGICAL_API_BASE_URL: mockUrl, MAGICAL_API_KEY: MOCK_KEY };
  child = spawn(process.execPath, ['--env-file-if-exists=.env', 'src/index.js'], { cwd: serverDir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => { logs += d; });
  child.stderr.on('data', (d) => { logs += d; });
  for (let i = 0; i < 60 && !/Magical Pioneer API (key OK|check failed)/.test(logs); i++) await sleep(250);

  const offer = async (name, kind, cost, extra = {}) => {
    const { rows: [o] } = await db.query(
      `INSERT INTO pioneer_offers (title, kind, points_cost, discount_percent, stock, is_active) VALUES ($1,$2,$3,$4,$5,true) RETURNING id`,
      [`${name} ${TAG}`, kind, cost, extra.discount ?? null, extra.stock ?? null]);
    offers[name] = o.id;
  };
  await offer('gift100', 'redeem_gift', 100, { stock: 10 });
  await offer('coupon50', 'discount', 50, { discount: 15 });
  await offer('big5000', 'redeem_gift', 5000);
  await offer('lastOne', 'redeem_gift', 10, { stock: 1 });
});

after(async () => {
  child?.kill();
  await mock.stop();
  await db.query('DROP TRIGGER IF EXISTS pts_test_fail_finalize ON pioneer_point_operations').catch(() => {});
  await db.query('DROP FUNCTION IF EXISTS pts_test_fail_finalize()').catch(() => {});
  if (users.length) {
    await db.query('DELETE FROM pioneer_point_operations WHERE user_id = ANY($1::uuid[])', [users]);
    await db.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [users]); // links, rewards, redemptions, coupons cascade
  }
  await db.query('DELETE FROM pioneer_offers WHERE id = ANY($1::uuid[])', [Object.values(offers)]);
  await db.end();
});

const a = client(); // linked to 48151623 (balance 220)
const b = client();
const admin = client();
let userA;

test('startup: key checked with GET /me, points scopes detected, features on', async () => {
  assert.match(logs, /Magical Pioneer API key OK \(client "christmas-store"/);
  assert.doesNotMatch(logs, /has not granted points/);
  const s = await client()('GET', '/pioneer/status');
  assert.equal(s.data.pointsEarnable, true);
  assert.equal(s.data.pointsRedeemable, true);
});

test('linking: verification through Magical, wrong code refused, duplicates refused', async () => {
  userA = await register(a, 'alpha');
  const bad = await a('POST', '/pioneer/link', { cardNumber: '48151623', verificationCode: '000' });
  assert.equal(bad.status, 400);
  assert.equal(bad.data.error.code, 'invalid_card');
  const ok = await a('POST', '/pioneer/link', { cardNumber: '48151623', verificationCode: '904' });
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(ok.data.balance, 220);
  assert.equal(JSON.parse(mock.state.requests.filter((r) => r.url.endsWith('/links')).at(-1).body).customerId, userA);
  const again = await a('POST', '/pioneer/link', { cardNumber: '42424242', verificationCode: '111' });
  assert.equal(again.status, 409, 'one card per account');
  assert.equal(again.data.error.code, 'already_linked');
  await register(b, 'bravo');
  const taken = await b('POST', '/pioneer/link', { cardNumber: '48151623', verificationCode: '904' });
  assert.equal(taken.status, 409, 'one account per card');
  assert.equal(taken.data.error.code, 'card_taken');
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM pioneer_links WHERE user_id=$1 AND status='active'`, [userA]);
  assert.equal(rows[0].n, 1);
});

test('game reward → Magical credit with a stable reference and Idempotency-Key; balance from Magical', async () => {
  const before = balanceOf('48151623');
  const found = await a('POST', '/hidden/silver-key/find');
  assert.equal(found.status, 200, JSON.stringify(found.data));
  const points = found.data.reward.points;
  assert.ok(points > 0);
  const op = await settledCredit(userA, 'silver-key');
  assert.equal(op.status, 'succeeded', op.last_error_code);
  assert.equal(op.reference, `cm-grant-${found.data.reward.id}`);
  assert.equal(op.idempotency_key, `christmas-store:credit:cm-grant-${found.data.reward.id}`);
  const sent = ledgerFor(op.reference);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].points, points, 'the amount comes from the server rule, not the browser');
  assert.equal(sent[0].idempotencyKey, op.idempotency_key);
  assert.equal(op.magical_transaction_id, sent[0].id);
  assert.equal(balanceOf('48151623'), before + points);
  const s = await a('GET', '/pioneer/summary?fresh=1');
  assert.equal(s.data.balance.points, before + points, 'the displayed balance is Magical\'s');
  assert.equal(s.data.activity.find((x) => x.kind === 'credit').status, 'done');
  const { rows: [g] } = await db.query('SELECT pioneer_sync_status FROM reward_grants WHERE id=$1', [found.data.reward.id]);
  assert.equal(g.pioneer_sync_status, 'synced');
});

test('duplicate game reward: finding the same object again credits nothing; a confirmed credit cannot be resent', async () => {
  const count = mock.ledger.length;
  const again = await a('POST', '/hidden/silver-key/find');
  assert.equal(again.data.alreadyFound, true);
  await sleep(500);
  assert.equal(mock.ledger.length, count);
  const op = await settledCredit(userA, 'silver-key');
  const login = await admin('POST', '/auth/login', { email: 'elf@christmas-market.test', password: 'north-pole-office-2026' });
  assert.equal(login.status, 200, 'demo admin (npm run seed:demo) is needed for the admin checks');
  const retry = await admin('POST', `/admin/pioneer-links/operations/${op.id}/retry`);
  assert.equal(retry.status, 409);
  await assert.rejects(db.query(`UPDATE pioneer_point_operations SET points = points + 1 WHERE id=$1`, [op.id]), /cannot be changed/);
  await assert.rejects(db.query(`UPDATE pioneer_point_operations SET status='failed' WHERE id=$1`, [op.id]), /cannot be changed/);
});

test('reward without a linked card: no credit is sent (stays store Stardust)', async () => {
  const count = mock.ledger.length;
  const found = await b('POST', '/hidden/silver-key/find');
  assert.equal(found.status, 200);
  await sleep(400);
  assert.equal(mock.ledger.length, count);
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM pioneer_point_operations WHERE user_id=$1`, [users[1]]);
  assert.equal(rows[0].n, 0);
  assert.equal(found.data.reward.pioneerSyncStatus, 'no_card');
});

test('failed credit: Magical refuses (partner limit) → reported as not credited, not retried', async () => {
  mock.state.pointsFail = { status: 422, code: 'partner_limit_exceeded' };
  try {
    const before = balanceOf('48151623');
    await a('POST', '/hidden/moon-feather/find');
    const op = await settledCredit(userA, 'moon-feather');
    assert.equal(op.status, 'failed');
    assert.equal(op.last_error_code, 'partner_limit_exceeded');
    assert.equal(balanceOf('48151623'), before);
    const s = await a('GET', '/pioneer/summary');
    const row = s.data.activity.find((x) => x.status === 'failed');
    assert.equal(row.errorCode, 'partner_limit_exceeded');
    const { rows: [g] } = await db.query('SELECT pioneer_sync_status FROM reward_grants WHERE id=$1', [op.grant_id]);
    assert.equal(g.pioneer_sync_status, 'failed');
  } finally { mock.state.pointsFail = null; }
});

test('credit timeout → unknown outcome; retry with the SAME key settles it without a second credit', async () => {
  const before = balanceOf('48151623');
  mock.state.pointsSlowMs = 2600; // > client timeout (1.5 s): Magical executes, the store never hears back
  let op;
  try {
    await a('POST', '/hidden/lost-mitten/find');
    op = await settledCredit(userA, 'lost-mitten', { timeout: 12000 });
    assert.equal(op.status, 'needs_reconciliation');
    assert.ok(['timeout', 'unreachable'].includes(op.last_error_code), op.last_error_code);
  } finally { mock.state.pointsSlowMs = 0; }
  await sleep(3000); // let the slow requests finish on the Magical side
  assert.equal(ledgerFor(op.reference).length, 1, 'Magical executed it exactly once');
  const retry = await admin('POST', `/admin/pioneer-links/operations/${op.id}/retry`);
  assert.equal(retry.status, 200, JSON.stringify(retry.data));
  assert.equal(retry.data.operation.status, 'succeeded');
  const { rows: [done] } = await db.query('SELECT * FROM pioneer_point_operations WHERE id=$1', [op.id]);
  assert.equal(done.replayed, true, 'Magical replayed the original answer');
  assert.equal(ledgerFor(op.reference).length, 1, 'still exactly one credit');
  assert.equal(balanceOf('48151623'), before + done.points);
  assert.deepEqual([...keysSentFor(op.reference)], [op.idempotency_key], 'every attempt used the same Idempotency-Key');
});

test('successful gift debit: confirmed only after Magical; balance, stock and history updated', async () => {
  mock.cards['48151623'].balance += 1000; // the customer earned points elsewhere in Magical (enough for the redemption tests)
  const before = balanceOf('48151623');
  const requestId = randomUUID();
  const r = await a('POST', `/pioneer/offers/${offers.gift100}/redeem`, { requestId });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.redemption.status, 'completed');
  assert.equal(r.data.redemption.fulfilment, 'awaiting_handover');
  assert.equal(r.data.redemption.balanceAfter, before - 100);
  assert.equal(balanceOf('48151623'), before - 100);
  const op = await opForRedemption(r.data.redemption.id);
  assert.equal(op.status, 'succeeded');
  assert.equal(op.idempotency_key, `christmas-store:debit:cm-gift-${r.data.redemption.id}`);
  assert.equal(ledgerFor(op.reference)[0].type, 'partner_redemption');
  const { rows: [o] } = await db.query('SELECT stock FROM pioneer_offers WHERE id=$1', [offers.gift100]);
  assert.equal(o.stock, 9);
  const c = await a('POST', `/pioneer/offers/${offers.coupon50}/redeem`, { requestId: randomUUID() });
  assert.equal(c.status, 201);
  assert.match(c.data.redemption.couponCode, /^[A-Z0-9-]+$/, 'a discount gift becomes a personal coupon');
  const s = await a('GET', '/pioneer/summary?fresh=1');
  assert.equal(s.data.balance.points, before - 150);
  assert.ok(s.data.activity.some((x) => x.kind === 'debit' && x.status === 'done'));
  assert.ok(s.data.transactions.items.some((t) => t.type === 'partner_redemption'), 'Magical history shows the store debit');
});

test('duplicate redemption: the same confirmation (double click / refresh) never debits twice', async () => {
  const before = balanceOf('48151623');
  const requestId = randomUUID();
  const [x, y] = await Promise.all([
    a('POST', `/pioneer/offers/${offers.gift100}/redeem`, { requestId }),
    a('POST', `/pioneer/offers/${offers.gift100}/redeem`, { requestId }),
  ]);
  const z = await a('POST', `/pioneer/offers/${offers.gift100}/redeem`, { requestId });
  const ids = new Set([x, y, z].filter((r) => r.data.redemption).map((r) => r.data.redemption.id));
  assert.equal(ids.size, 1, 'one redemption');
  assert.equal(z.status, 200);
  assert.equal(z.data.repeated, true);
  assert.equal(balanceOf('48151623'), before - 100, 'charged once');
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM pioneer_redemptions WHERE user_id=$1 AND client_token=$2`, [userA, requestId]);
  assert.equal(rows[0].n, 1);
});

test('concurrent redemptions: only one debit at a time per customer', async () => {
  const before = balanceOf('48151623');
  const debits = mock.ledger.filter((t) => t.type === 'partner_redemption').length;
  mock.state.slowMs = 700;
  let results;
  try {
    results = await Promise.all(Array.from({ length: 5 }, () => a('POST', `/pioneer/offers/${offers.gift100}/redeem`, { requestId: randomUUID() })));
  } finally { mock.state.slowMs = 0; }
  const ok = results.filter((r) => r.status === 201);
  assert.equal(ok.length, 1, results.map((r) => `${r.status}:${r.data?.error?.code ?? ''}`).join(' '));
  assert.ok(results.filter((r) => r.status !== 201).every((r) => r.status === 409 && r.data.error.code === 'redemption_in_progress'));
  assert.equal(mock.ledger.filter((t) => t.type === 'partner_redemption').length, debits + 1);
  assert.equal(balanceOf('48151623'), before - 100);
});

test('insufficient balance: refused before and by Magical; nothing deducted, stock kept', async () => {
  const before = balanceOf('48151623');
  const big = await a('POST', `/pioneer/offers/${offers.big5000}/redeem`, { requestId: randomUUID() });
  assert.equal(big.status, 409);
  assert.equal(big.data.error.code, 'insufficient_points');
  // Magical's locked check is final: even if the store's check passed, Magical's refusal wins.
  mock.state.pointsFail = { status: 409, code: 'insufficient_points', extra: { fields: { balance: 1, points: 100 } } };
  try {
    const { rows: [o1] } = await db.query('SELECT stock FROM pioneer_offers WHERE id=$1', [offers.gift100]);
    const r = await a('POST', `/pioneer/offers/${offers.gift100}/redeem`, { requestId: randomUUID() });
    assert.equal(r.status, 409);
    assert.equal(r.data.error.code, 'insufficient_points');
    assert.match(r.data.error.message, /Nothing was deducted/);
    const { rows: [o2] } = await db.query('SELECT stock FROM pioneer_offers WHERE id=$1', [offers.gift100]);
    assert.equal(o2.stock, o1.stock, 'reserved stock is released');
    const { rows: [rd] } = await db.query(`SELECT status FROM pioneer_redemptions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [userA]);
    assert.equal(rd.status, 'failed');
  } finally { mock.state.pointsFail = null; }
  assert.equal(balanceOf('48151623'), before);
});

test('debit timeout: not confirmed (202), never charged twice, settled by retry with the same key', async () => {
  const before = balanceOf('48151623');
  mock.state.pointsSlowMs = 2600;
  let r;
  try {
    r = await a('POST', `/pioneer/offers/${offers.gift100}/redeem`, { requestId: randomUUID() });
  } finally { mock.state.pointsSlowMs = 0; }
  assert.equal(r.status, 202, JSON.stringify(r.data));
  assert.equal(r.data.redemption.status, 'needs_reconciliation');
  const blocked = await a('POST', `/pioneer/offers/${offers.gift100}/redeem`, { requestId: randomUUID() });
  assert.equal(blocked.status, 409, 'no new redemption while one is unconfirmed');
  const unlink = await a('DELETE', '/pioneer/link', { confirm: true });
  assert.equal(unlink.status, 409, 'the card stays linked until the debit is settled');
  await sleep(3000);
  const op = await opForRedemption(r.data.redemption.id);
  assert.equal(ledgerFor(op.reference).length, 1);
  const retry = await admin('POST', `/admin/pioneer-links/operations/${op.id}/retry`);
  assert.equal(retry.data.operation.status, 'succeeded');
  const { rows: [rd] } = await db.query('SELECT status FROM pioneer_redemptions WHERE id=$1', [r.data.redemption.id]);
  assert.equal(rd.status, 'completed');
  assert.equal(balanceOf('48151623'), before - 100, 'charged exactly once');
  assert.deepEqual([...keysSentFor(op.reference)], [op.idempotency_key]);
});

test('recovery: Magical debited but saving the result failed → reconciliation records it, no second charge', async () => {
  const before = balanceOf('48151623');
  await db.query(`CREATE OR REPLACE FUNCTION pts_test_fail_finalize() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.status = 'succeeded' AND NEW.user_id = '${userA}' THEN RAISE EXCEPTION 'simulated local failure'; END IF; RETURN NEW; END $$`);
  await db.query('CREATE TRIGGER pts_test_fail_finalize BEFORE UPDATE ON pioneer_point_operations FOR EACH ROW EXECUTE FUNCTION pts_test_fail_finalize()');
  let r;
  try {
    r = await a('POST', `/pioneer/offers/${offers.gift100}/redeem`, { requestId: randomUUID() });
  } finally {
    await db.query('DROP TRIGGER IF EXISTS pts_test_fail_finalize ON pioneer_point_operations');
    await db.query('DROP FUNCTION IF EXISTS pts_test_fail_finalize()');
  }
  assert.equal(r.status, 202, 'not confirmed to the customer while the result is unsaved');
  assert.equal(balanceOf('48151623'), before - 100, 'Magical did debit');
  const op = await opForRedemption(r.data.redemption.id);
  assert.equal(op.status, 'processing');
  await db.query(`UPDATE pioneer_point_operations SET lease_until = now() - interval '1 second' WHERE id=$1`, [op.id]); // the worker's lease runs out
  const retry = await admin('POST', `/admin/pioneer-links/operations/${op.id}/retry`);
  assert.equal(retry.data.operation.status, 'succeeded');
  const { rows: [done] } = await db.query('SELECT replayed, magical_transaction_id FROM pioneer_point_operations WHERE id=$1', [op.id]);
  assert.equal(done.replayed, true);
  assert.equal(done.magical_transaction_id, ledgerFor(op.reference)[0].id);
  assert.equal(ledgerFor(op.reference).length, 1);
  assert.equal(balanceOf('48151623'), before - 100, 'charged exactly once');
  const { rows: [rd] } = await db.query('SELECT status FROM pioneer_redemptions WHERE id=$1', [r.data.redemption.id]);
  assert.equal(rd.status, 'completed');
});

test('Magical unavailable: no current balance shown, no redemption, credit kept for reconciliation', async () => {
  const ledger = mock.ledger.length;
  mock.state.down = true;
  let op;
  try {
    await sleep(5200); // let the 5 s read cache expire
    const s = await a('GET', '/pioneer/summary');
    assert.equal(s.data.live, false);
    assert.equal(s.data.balance, null);
    assert.ok(s.data.lastConfirmed, 'the last confirmed value is labelled as such');
    const r = await a('POST', `/pioneer/offers/${offers.gift100}/redeem`, { requestId: randomUUID() });
    assert.equal(r.status, 503);
    assert.equal(r.data.error.code, 'pioneer_upstream');
    await a('POST', '/hidden/tiny-reindeer/find');
    op = await settledCredit(userA, 'tiny-reindeer');
    assert.equal(op.status, 'needs_reconciliation');
  } finally { mock.state.down = false; }
  assert.equal(mock.ledger.length, ledger);
  const retry = await admin('POST', `/admin/pioneer-links/operations/${op.id}/retry`);
  assert.equal(retry.data.operation.status, 'succeeded');
  assert.equal(ledgerFor(op.reference).length, 1);
});

test('last item: two customers cannot both redeem the final unit', async () => {
  const c = client();
  const cid = await register(c, 'charlie');
  const link = await c('POST', '/pioneer/link', { cardNumber: '42424242', verificationCode: '111' });
  assert.equal(link.status, 201);
  const [x, y] = await Promise.all([
    a('POST', `/pioneer/offers/${offers.lastOne}/redeem`, { requestId: randomUUID() }),
    c('POST', `/pioneer/offers/${offers.lastOne}/redeem`, { requestId: randomUUID() }),
  ]);
  assert.deepEqual([x.status, y.status].sort(), [201, 409]);
  const { rows: [o] } = await db.query('SELECT stock FROM pioneer_offers WHERE id=$1', [offers.lastOne]);
  assert.equal(o.stock, 0);
  assert.ok(cid);
});

test('the API key never reaches the browser, responses, logs or the frontend build', async () => {
  const pages = [await a('GET', '/pioneer/status'), await a('GET', '/pioneer/summary'), await admin('GET', '/admin/pioneer-links'), await admin('GET', '/admin/pioneer-links/operations?status=all')];
  for (const p of pages) assert.ok(!JSON.stringify(p.data).includes(MOCK_KEY));
  assert.ok(!logs.includes(MOCK_KEY), 'not in server logs');
  assert.ok(mock.state.requests.every((r) => !r.headers.origin), 'Magical is only called server-to-server');
  assert.ok(mock.state.requests.every((r) => !r.url.includes(MOCK_KEY) && !r.body.includes(MOCK_KEY)), 'the key travels only in the Authorization header');
  const dist = path.join(serverDir, '..', 'client', 'dist');
  if (fs.existsSync(dist)) {
    const realKey = (fs.readFileSync(path.join(serverDir, '.env'), 'utf8').match(/^MAGICAL(?:_PIONEER)?_API_KEY=(.+)$/m)?.[1] ?? '').trim();
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    for (const f of walk(dist).filter((x) => /\.(js|html|css|json|map)$/.test(x))) {
      const text = fs.readFileSync(f, 'utf8');
      assert.ok(!/mgpc_[A-Za-z0-9]/.test(text), `no Magical key in ${f}`);
      assert.ok(!text.includes('MAGICAL_PIONEER_API_KEY') && !text.includes('MAGICAL_API_KEY'), `no key variable in ${f}`);
      if (realKey.length >= 20) assert.ok(!text.includes(realKey), `configured key not in ${f}`);
    }
  }
});
