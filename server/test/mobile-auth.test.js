// Native app session path (X-Christmas-Client: mobile + Authorization: Bearer) against a running server.
//   API_URL=http://localhost:4000 npm test
// The website's cookie/Origin behaviour must stay exactly as before; these tests check both sides.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = `${process.env.API_URL ?? 'http://localhost:4000'}/api/v1`;
const ORIGIN = (process.env.APP_ORIGIN ?? 'http://localhost:5173').split(',')[0];
const MOBILE = { 'X-Christmas-Client': 'mobile' };

async function call(method, path, { body, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
}

const email = `mobile-elf-${Date.now()}@christmas-market.test`;
const password = 'snowy-mobile-password-2026';
let token;

test('website rule unchanged: a write without Origin and without the app header is refused', async () => {
  const r = await call('POST', '/auth/login', { body: { email, password } });
  assert.equal(r.status, 403);
});

test('the app header does not bypass the Origin check for a browser-style foreign Origin', async () => {
  const r = await call('POST', '/auth/login', { body: { email, password }, headers: { ...MOBILE, Origin: 'https://evil.example' } });
  assert.equal(r.status, 403);
});

test('mobile registration returns a session token in the body and sets no session cookie', async () => {
  const r = await call('POST', '/auth/register', { body: { name: 'Mobile Elf', email, password }, headers: MOBILE });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.email, email);
  assert.match(r.data.session.token, /^[A-Za-z0-9_-]{20,}$/);
  assert.ok(r.data.session.expiresAt);
  assert.ok(!(r.headers.getSetCookie?.() ?? []).some((c) => c.startsWith('mc_session=')), 'no cookie for the app');
  token = r.data.session.token;
});

test('the website login answer is unchanged (cookie, no token in the body)', async () => {
  const r = await call('POST', '/auth/login', { body: { email, password }, headers: { Origin: ORIGIN } });
  assert.equal(r.status, 200);
  assert.equal(r.data.session, undefined);
  assert.ok((r.headers.getSetCookie?.() ?? []).some((c) => c.startsWith('mc_session=')));
});

test('a bearer token identifies the user only together with the app header', async () => {
  const me = await call('GET', '/auth/me', { headers: { ...MOBILE, Authorization: `Bearer ${token}` } });
  assert.equal(me.data.user.email, email);
  const noHeader = await call('GET', '/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(noHeader.data.user, null);
  const bad = await call('GET', '/auth/me', { headers: { ...MOBILE, Authorization: 'Bearer not-a-real-session-token-xyz' } });
  assert.equal(bad.data.user, null);
});

test('guest cart works with X-Cart-Token and is merged on mobile sign-in', async () => {
  const list = await call('GET', '/products?limit=20');
  let variantId = null;
  for (const p of list.data.products.filter((x) => x.stock > 0)) {
    const d = await call('GET', `/products/${p.slug}`);
    const v = d.data.product.variants.find((x) => x.stock > 0);
    if (v) { variantId = v.id; break; }
  }
  assert.ok(variantId, 'an in-stock variant exists');
  const add = await call('POST', '/cart/items', { body: { variantId, quantity: 1 }, headers: MOBILE });
  assert.equal(add.status, 201);
  const cartToken = add.headers.get('x-cart-token');
  assert.match(cartToken ?? '', /^[A-Za-z0-9_-]{20,64}$/);
  assert.ok(!(add.headers.getSetCookie?.() ?? []).some((c) => c.startsWith('mc_cart=')), 'no cart cookie for the app');
  const cart = await call('GET', '/cart', { headers: { ...MOBILE, 'X-Cart-Token': cartToken } });
  assert.equal(cart.data.count, 1);

  const login = await call('POST', '/auth/login', { body: { email, password }, headers: { ...MOBILE, 'X-Cart-Token': cartToken } });
  assert.equal(login.status, 200);
  const auth = { ...MOBILE, Authorization: `Bearer ${login.data.session.token}` };
  const merged = await call('GET', '/cart', { headers: auth });
  assert.ok(merged.data.items.some((i) => i.variantId === variantId), 'guest item moved into the account cart');
  const guestAfter = await call('GET', '/cart', { headers: { ...MOBILE, 'X-Cart-Token': cartToken } });
  assert.equal(guestAfter.data.count, 0, 'the guest cart is spent');
  for (const i of merged.data.items) await call('DELETE', `/cart/items/${i.id}`, { headers: auth });
  token = login.data.session.token;
});

test('mobile logout revokes the bearer session', async () => {
  const auth = { ...MOBILE, Authorization: `Bearer ${token}` };
  const out = await call('POST', '/auth/logout', { headers: auth });
  assert.equal(out.status, 200);
  const me = await call('GET', '/auth/me', { headers: auth });
  assert.equal(me.data.user, null);
});
