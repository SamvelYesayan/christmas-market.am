// Unit tests for the Magical Pioneer Integration API client against an in-memory mock (no real key needed).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MagicalPioneerClient, MagicalApiError } from '../src/integrations/pioneer/magicalClient.js';
import { createMagicalMock, MOCK_KEY } from './helpers/magicalMock.js';

const mock = createMagicalMock();
let base;
let client;
const CARD = '48151623';
const CVV = '904';

before(async () => {
  base = await mock.start();
  client = new MagicalPioneerClient({ baseUrl: base, apiKey: MOCK_KEY, timeoutMs: 1000 });
});
after(() => mock.stop());

const rejectsWith = async (promise, code) => {
  const err = await promise.then(() => null, (e) => e);
  assert.ok(err instanceof MagicalApiError, `expected MagicalApiError, got ${err}`);
  assert.equal(err.code, code);
  return err;
};

test('GET /me validates a good key', async () => {
  const r = await client.me();
  assert.equal(r.client.name, 'christmas-store');
  assert.deepEqual(r.client.scopes.sort(), ['cards:link', 'cards:read', 'cards:verify', 'rewards:read']);
  const last = mock.state.requests.at(-1);
  assert.equal(last.headers.authorization, `Bearer ${MOCK_KEY}`);
  assert.equal(last.headers.origin, undefined, 'server-to-server: no Origin header');
});

test('invalid API key → invalid_api_key, and the key never appears in the error', async () => {
  const bad = new MagicalPioneerClient({ baseUrl: base, apiKey: 'mgpc_wrong_key_0000000000000000000000000000', timeoutMs: 1000 });
  const err = await rejectsWith(bad.me(), 'invalid_api_key');
  assert.equal(err.status, 401);
  assert.ok(!JSON.stringify({ ...err, message: err.message }).includes('mgpc_wrong_key'));
  assert.ok(!JSON.stringify(bad).includes('mgpc_wrong_key'), 'key is not an enumerable property');
});

test('POST /cards/verify: valid and invalid credentials', async () => {
  const ok = await client.verifyCard(CARD, CVV);
  assert.equal(ok.valid, true);
  assert.equal(ok.card.last4, '1623');
  const no = await client.verifyCard(CARD, '000');
  assert.equal(no.valid, false);
  assert.equal(no.reason, 'invalid_credentials');
  const last = mock.state.requests.at(-1);
  assert.match(last.headers['content-type'], /^application\/json/);
});

test('POST /links: success, idempotent repeat, invalid credentials', async () => {
  const r = await client.link('cust-a', CARD, CVV);
  assert.equal(r.link.customerId, 'cust-a');
  assert.equal(r.link.balance, 220);
  assert.equal(r.link.card.number, '•••• 1623');
  const again = await client.link('cust-a', CARD, CVV);
  assert.equal(again.link.customerId, 'cust-a');
  const err = await rejectsWith(client.link('cust-x', '42424242', '000'), 'invalid_card_credentials');
  assert.equal(err.fields.attemptsBeforeLock, 2);
});

test('POST /links: card already linked, customer already linked, inactive card', async () => {
  await rejectsWith(client.link('cust-b', CARD, CVV), 'card_already_linked');
  await rejectsWith(client.link('cust-a', '42424242', '111'), 'customer_already_linked');
  const err = await rejectsWith(client.link('cust-c', '13131313', '222'), 'card_inactive');
  assert.equal(err.status, 403);
});

test('rate limiting and card lockouts carry Retry-After', async () => {
  const locked = await rejectsWith(client.link('cust-d', '77777777', '123'), 'too_many_attempts');
  assert.equal(locked.retryAfter, 30);
  await rejectsWith(client.link('cust-d', '66666666', '123'), 'card_locked');
  mock.state.rateLimited = true;
  try {
    const rl = await rejectsWith(client.card('cust-a'), 'rate_limited');
    assert.equal(rl.retryAfter, 60);
  } finally {
    mock.state.rateLimited = false;
  }
});

test('card info, transactions (paged), rewards, customer rewards and eligibility', async () => {
  const card = await client.card('cust-a');
  assert.equal(card.link.balance, 220);
  const tx = await client.transactions('cust-a', 1, 20);
  assert.equal(tx.items.length, 20);
  assert.equal(tx.total, 25);
  const tx2 = await client.transactions('cust-a', 2, 20);
  assert.equal(tx2.page, 2);
  assert.equal(tx2.items.length, 5);
  const catalog = await client.rewards();
  assert.equal(catalog.items.length, 2);
  const mine = await client.customerRewards('cust-a');
  assert.equal(mine.items.find((x) => x.id === 3).eligible, true);
  assert.deepEqual(mine.items.find((x) => x.id === 7).reasons, ['insufficient_points']);
  const el = await client.eligibility('cust-a', 7);
  assert.equal(el.shortfall, 4780);
  await rejectsWith(client.eligibility('cust-a', 999), 'reward_not_found');
  await rejectsWith(client.card('nobody'), 'link_not_found');
});

test('DELETE /customers/{id}/link unlinks', async () => {
  const r = await client.unlink('cust-a');
  assert.equal(r.unlinked, true);
  await rejectsWith(client.card('cust-a'), 'link_not_found');
  await rejectsWith(client.unlink('cust-a'), 'link_not_found');
});

test('timeout, server error and unreachable service are reported safely', async () => {
  mock.state.slowMs = 1500;
  try {
    await rejectsWith(client.me(), 'timeout');
  } finally {
    mock.state.slowMs = 0;
  }
  mock.state.down = true;
  try {
    const e = await rejectsWith(client.me(), 'server_error');
    assert.equal(e.status, 500);
  } finally {
    mock.state.down = false;
  }
  const nowhere = new MagicalPioneerClient({ baseUrl: 'http://127.0.0.1:9/api/integration/v1', apiKey: MOCK_KEY, timeoutMs: 1000 });
  await rejectsWith(nowhere.me(), 'unreachable');
});
