// End-to-end API tests against a running server with demo data (npm run seed:demo).
//   API_URL=http://localhost:4000 npm test
// Requires PAYMENTS_TEST_MODE=true, PIONEER_MODE=sandbox and ADVENT_DATE_OVERRIDE in December.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = `${process.env.API_URL ?? 'http://localhost:4000'}/api/v1`;
const ORIGIN = (process.env.APP_ORIGIN ?? 'http://localhost:5173').split(',')[0];

function client() {
  const jar = new Map();
  const call = async function call(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const [k, ...v] = kv.split('=');
      jar.set(k, v.join('='));
    }
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    return { status: res.status, data };
  };
  call.cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  return call;
}

const email = `elf-${Date.now()}@christmas-market.test`;
const user = client();
const guest = client();
let variantId;

test('rejects mutating requests from foreign origins', async () => {
  const res = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{}' });
  assert.equal(res.status, 403);
});

test('catalog lists products and details', async () => {
  const list = await guest('GET', '/products?category=ornaments');
  assert.equal(list.status, 200);
  assert.ok(list.data.products.length > 0);
  const detail = await guest('GET', `/products/glass-pomegranate`);
  assert.equal(detail.status, 200);
  assert.ok(detail.data.product.variants.length >= 1);
  variantId = detail.data.product.variants[0].id;
});

test('registers a user with personalization', async () => {
  const r = await user('POST', '/auth/register', {
    name: 'Test Elf', email, password: 'snowy-password-123', personalizationConsent: true,
    profile: { displayName: 'Tessa', atmosphere: 'enchanted', preferences: { favorite: 'magic' } },
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.user.profile.displayName, 'Tessa');
  const dup = await client()('POST', '/auth/register', { name: 'x', email, password: 'snowy-password-123' });
  assert.equal(dup.status, 409);
});

test('admin routes are protected', async () => {
  assert.equal((await guest('GET', '/admin/orders')).status, 401);
  assert.equal((await user('GET', '/admin/orders')).status, 403);
});

test('cart: add, coupon validation, quote', async () => {
  const add = await user('POST', '/cart/items', { variantId, quantity: 2 });
  assert.equal(add.status, 201, JSON.stringify(add.data));
  assert.equal(add.data.count, 2);
  const bad = await user('POST', '/cart/coupon', { code: 'NOPE-NOPE' });
  assert.equal(bad.status, 400);
  const tooMuch = await user('POST', '/cart/items', { variantId, quantity: 50 });
  assert.equal(tooMuch.status, 400);
});

test('checkout with cash on delivery creates a confirmed order and reserves stock', async () => {
  const before = (await guest('GET', '/products/glass-pomegranate')).data.product.variants[0].stock;
  const r = await user('POST', '/orders', {
    customer: { name: 'Test Elf', email, phone: '+374 91 000000' },
    delivery: { zone: 'yerevan', city: 'Yerevan', address: '1 Snow Street' },
    paymentMethod: 'cash_on_delivery', acceptTerms: true,
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.order.status, 'confirmed');
  assert.equal(r.data.order.paymentStatus, 'cod');
  assert.equal(r.data.order.subtotal, 13000);
  const after = (await guest('GET', '/products/glass-pomegranate')).data.product.variants[0].stock;
  assert.equal(after, before - 2);
  const cart = await user('GET', '/cart');
  assert.equal(cart.data.count, 0);
});

test('test payments are flagged and only succeed after explicit approval', async () => {
  await guest('POST', '/cart/items', { variantId, quantity: 1 });
  const r = await guest('POST', '/orders', {
    customer: { name: 'Guest Elf', email: 'guest@christmas-market.test', phone: '+374 91 111111' },
    delivery: { zone: 'pickup' }, paymentMethod: 'test', acceptTerms: true,
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.order.isTest, true);
  assert.equal(r.data.order.paymentStatus, 'pending');
  assert.equal(r.data.payment.isTest, true);
  const decide = await guest('POST', `/payments/test/${r.data.payment.paymentId}/decide`, { decision: 'approve' });
  assert.equal(decide.status, 200);
  assert.equal(decide.data.paymentStatus, 'paid');
  const tracked = await guest('GET', `/orders/${r.data.order.number}?email=guest@christmas-market.test`);
  assert.equal(tracked.data.order.status, 'confirmed');
  const hidden = await client()('GET', `/orders/${r.data.order.number}?email=someone@else.test`);
  assert.equal(hidden.status, 404);
});

test('advent: past doors open once, future doors are locked', async () => {
  const cal = await user('GET', '/advent');
  const unlocked = cal.data.unlockedThrough;
  assert.ok(unlocked >= 2, 'set ADVENT_DATE_OVERRIDE to a December date for this test');
  const open = await user('POST', '/advent/2/open');
  assert.equal(open.status, 200);
  assert.ok(open.data.content.reward?.couponCode);
  const again = await user('POST', '/advent/2/open');
  assert.equal(again.data.newReward, false);
  assert.equal(again.data.content.reward.couponCode, open.data.content.reward.couponCode);
  if (unlocked < 24) assert.equal((await user('POST', '/advent/24/open')).status, 403);
});

test('wheel: one spin per day, server picks the result', async () => {
  const s1 = await user('POST', '/games/wheel/spin');
  assert.equal(s1.status, 200);
  assert.ok(Number.isInteger(s1.data.segmentIndex));
  assert.equal((await user('POST', '/games/wheel/spin')).status, 409);
});

test('catch game: implausible scores are rejected', async () => {
  const start = await user('POST', '/games/catch/start');
  assert.equal(start.status, 201);
  const fin = await user('POST', '/games/catch/finish', { sessionId: start.data.sessionId, score: 99999 });
  assert.equal(fin.status, 200);
  assert.equal(fin.data.flagged, true);
  assert.equal(fin.data.reward, null);
});

test('quiz never leaks answers and scores server-side', async () => {
  const q = await user('POST', '/games/quiz/start');
  assert.equal(q.status, 201);
  assert.ok(!JSON.stringify(q.data).includes('answer_index'));
  const first = q.data.questions[0];
  const a = await user('POST', '/games/quiz/answer', { sessionId: q.data.sessionId, questionId: first.id, answer: 0 });
  assert.equal(typeof a.data.correct, 'boolean');
  const skip = await user('POST', '/games/quiz/answer', { sessionId: q.data.sessionId, questionId: first.id, answer: 0 });
  assert.equal(skip.status, 400);
});

test('pioneer sandbox: invalid card rejected, valid card linked, balance from adapter', async () => {
  const bad = await user('POST', '/pioneer/link', { cardCode: '1234 5678 9012', verificationCode: '0000' });
  assert.equal(bad.status, 400);
  const ok = await user('POST', '/pioneer/link', { cardCode: `9999${String(Date.now()).slice(-8)}`, verificationCode: '1225' });
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(ok.data.sandbox, true);
  const sum = await user('GET', '/pioneer/summary');
  assert.equal(sum.data.linked, true);
  assert.equal(typeof sum.data.balance, 'number');
});

test('academy sorting assigns a house once', async () => {
  const s = await user('POST', '/academy/sort', { answers: [2, 2, 2, 2, 2, 2, 2] });
  assert.equal(s.status, 200);
  assert.equal(s.data.house.slug, 'starloom');
  const again = await user('POST', '/academy/sort', { answers: [0, 0, 0, 0, 0, 0, 0] });
  assert.equal(again.data.house.slug, 'starloom');
  assert.equal(again.data.alreadySorted, true);
});

test('dashboard aggregates rewards and achievements', async () => {
  const d = await user('GET', '/me/dashboard');
  assert.equal(d.status, 200);
  assert.ok(d.data.rewards.length >= 2);
  assert.ok(d.data.achievements.some((a) => a.key === 'sorted' && a.earnedAt));
});

const admin = client();
test('admin: sign in, edit product, create coupon, update order, upload image', async () => {
  const login = await admin('POST', '/auth/login', { email: 'elf@christmas-market.test', password: 'north-pole-office-2026' });
  assert.equal(login.status, 200, 'run npm run seed:demo to create the demo admin');
  const list = await admin('GET', '/admin/products?q=pomegranate');
  const id = list.data.items[0].id;
  const full = (await admin('GET', `/admin/products/${id}`)).data.item;
  const put = await admin('PUT', `/admin/products/${id}`, { subtitle: 'Mouth-blown, hand-painted in Yerevan', variants: full.variants.map((v) => ({ id: v.id, sku: v.sku, name: v.name, options: v.options, price_delta: v.price_delta, stock: v.stock })) });
  assert.equal(put.status, 200, JSON.stringify(put.data));
  const code = `TEST${Date.now() % 100000}`;
  const c = await admin('POST', '/admin/coupons', { code, type: 'percent', value: 20, min_subtotal: 0, per_user_limit: 1, pioneer_only: false, is_active: true });
  assert.equal(c.status, 201, JSON.stringify(c.data));
  const shopper = client();
  await shopper('POST', '/cart/items', { variantId, quantity: 1 });
  const applied = await shopper('POST', '/cart/coupon', { code });
  assert.equal(applied.status, 200);
  assert.equal(applied.data.discount, 1300);
  const orders = await admin('GET', '/admin/orders?test=false');
  const num = orders.data.items[0].number;
  const upd = await admin('PATCH', `/admin/orders/${num}`, { status: 'processing', note: 'Wrapping', trackingCode: 'HY123' });
  assert.equal(upd.status, 200, JSON.stringify(upd.data));
  assert.equal(upd.data.order.status, 'processing');
  // 1×1 PNG upload
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const fd = new FormData();
  fd.append('images', new Blob([png], { type: 'image/png' }), 'dot.png');
  const up = await fetch(`${BASE}/admin/products/${id}/images`, { method: 'POST', headers: { Origin: ORIGIN, Cookie: admin.cookieHeader() }, body: fd });
  assert.equal(up.status, 201);
  const { images } = await up.json();
  assert.equal((await admin('DELETE', `/admin/products/${id}/images/${images[0].id}`)).status, 200);
  const fake = new FormData();
  fake.append('images', new Blob([Buffer.from('not an image')], { type: 'image/png' }), 'x.png');
  const bad = await fetch(`${BASE}/admin/products/${id}/images`, { method: 'POST', headers: { Origin: ORIGIN, Cookie: admin.cookieHeader() }, body: fake });
  assert.equal(bad.status, 400);
});

test('i18n: Armenian by default, English on request, translated errors', async () => {
  const hy = await fetch(`${BASE}/products/glass-pomegranate`).then((r) => r.json());
  assert.equal(hy.product.name, 'Ապակե նուռ');
  const en = await fetch(`${BASE}/products/glass-pomegranate`, { headers: { 'X-Locale': 'en' } }).then((r) => r.json());
  assert.equal(en.product.name, 'Glass Pomegranate');
  const cats = await fetch(`${BASE}/categories`).then((r) => r.json());
  assert.ok(cats.categories.some((c) => c.name === 'Տոնածառեր'));
  const err = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN }, body: JSON.stringify({ email: 'nobody@x.am', password: 'wrong' }) }).then((r) => r.json());
  assert.match(err.error.message, /[Ա-֏]/);
  const opts = await fetch(`${BASE}/checkout/options`).then((r) => r.json());
  assert.match(opts.paymentMethods[0].label, /[Ա-֏]/);
});
