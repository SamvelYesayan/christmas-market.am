// Christmas Wishes Wall — end-to-end against the running API (same setup as api.test.js).
// Every wish created here carries a unique tag and is deleted again at the end.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const BASE = `${process.env.API_URL ?? 'http://localhost:4000'}/api/v1`;
const ORIGIN = (process.env.APP_ORIGIN ?? 'http://localhost:5173').split(',')[0];
const TAG = `wt${Date.now().toString(36)}`;

function client() {
  const jar = new Map();
  return async (method, path, body) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Locale': 'en', Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)); }
    return { status: res.status, data: await res.json().catch(() => null) };
  };
}
const guest = client();
const admin = client();
const created = [];
const human = { elapsedMs: 12_000 };
const wish = (extra = {}) => ({ authorName: 'Test Elf', message: `May your home be warm and full of light ${TAG} ${Math.random().toString(36).slice(2, 7)}`, ...human, ...extra });

async function adminFind(text) {
  const r = await admin('GET', `/admin/wishes?q=${encodeURIComponent('Test Elf')}`);
  return r.data.items.find((w) => w.message.includes(text));
}
const publicIds = async () => {
  const ids = new Set();
  for (let page = 1; page <= 50; page++) {
    const r = await guest('GET', `/wishes/recent?page=${page}`);
    r.data.items.forEach((w) => ids.add(w.id));
    if (page * r.data.pageSize >= r.data.total) break;
  }
  return ids;
};

after(async () => {
  for (const id of created) await admin('DELETE', `/admin/wishes/${id}`);
});

test('admin wishes endpoints require an admin', async () => {
  assert.equal((await guest('GET', '/admin/wishes')).status, 401);
  const customer = client();
  await customer('POST', '/auth/register', { name: 'Wish Customer', email: `wish-${TAG}@christmas-market.test`, password: 'snowy-password-123' });
  assert.equal((await customer('GET', '/admin/wishes')).status, 403);
  const login = await admin('POST', '/auth/login', { email: 'elf@christmas-market.test', password: 'north-pole-office-2026' });
  assert.equal(login.status, 200);
  assert.equal((await admin('GET', '/admin/wishes')).status, 200);
});

test('a submitted wish is stored as pending and is not public', async () => {
  const body = wish({ recipientName: 'Grandma Anahit', category: 'family' });
  const r = await guest('POST', '/wishes', body);
  assert.equal(r.status, 201);
  assert.equal(r.data.status, 'pending');
  const w = await adminFind(body.message);
  assert.ok(w, 'visible to admins');
  created.push(w.id);
  assert.equal(w.status, 'pending');
  assert.equal(w.recipient_name, 'Grandma Anahit');
  assert.equal(w.category, 'family');
  assert.equal(w.approved_at, null);
  assert.ok(!(await publicIds()).has(w.id), 'pending wish is not public');
  const batch = await guest('GET', '/wishes?limit=40');
  assert.ok(!batch.data.items.some((x) => x.id === w.id));
});

test('validation: required fields, lengths, categories, links, unknown fields', async () => {
  const bad = [
    [{ ...wish(), authorName: ' ' }, 'name'],
    [{ ...wish(), message: 'too short' }, 'short'],
    [{ ...wish(), message: 'x'.repeat(401) }, 'long'],
    [{ ...wish(), authorName: 'A'.repeat(61) }, 'long name'],
    [{ ...wish(), recipientName: 'R'.repeat(61) }, 'long recipient'],
    [{ ...wish(), category: 'money' }, 'category'],
    [{ ...wish(), message: `Visit https://spam.example for prizes ${TAG}` }, 'link'],
    [{ ...wish(), message: `Happy new year!!!!!!!!!!!!!! ${TAG}` }, 'repeated'],
    [{ ...wish(), status: 'approved' }, 'cannot self-approve'],
  ];
  for (const [body, why] of bad) {
    const r = await guest('POST', '/wishes', body);
    assert.equal(r.status, 400, `${why}: ${JSON.stringify(r.data)}`);
  }
  const msg = await guest('POST', '/wishes', { ...wish(), message: `Visit www.spam.am now please ${TAG}` });
  assert.equal(msg.data.error.message, 'Please leave links and addresses out of your wish.');
});

test('spam traps: honeypot and instant submissions are accepted silently but never stored', async () => {
  const trap = wish();
  assert.equal((await guest('POST', '/wishes', { ...trap, website: 'http://bot.example' })).status, 201);
  const fast = wish();
  assert.equal((await guest('POST', '/wishes', { ...fast, elapsedMs: 300 })).status, 201);
  assert.equal(await adminFind(trap.message), undefined);
  assert.equal(await adminFind(fast.message), undefined);
  // The same wish twice within a day is kept once.
  const twice = wish();
  await guest('POST', '/wishes', twice);
  await guest('POST', '/wishes', twice);
  const r = await admin('GET', `/admin/wishes?q=${encodeURIComponent('Test Elf')}`);
  const copies = r.data.items.filter((w) => w.message === twice.message);
  assert.equal(copies.length, 1);
  created.push(copies[0].id);
});

test('approve → public; reject → hidden again; edit and delete', async () => {
  const body = wish({ category: 'peace' });
  await guest('POST', '/wishes', body);
  const w = await adminFind(body.message);
  created.push(w.id);

  const ok = await admin('POST', `/admin/wishes/${w.id}/status`, { status: 'approved' });
  assert.equal(ok.data.item.status, 'approved');
  assert.ok(ok.data.item.approved_at);
  assert.ok((await publicIds()).has(w.id), 'approved wish is public');
  const recent = await guest('GET', '/wishes/recent?page=1');
  const pub = recent.data.items.find((x) => x.id === w.id);
  if (pub) assert.deepEqual(Object.keys(pub).sort(), ['approvedAt', 'author', 'category', 'id', 'message', 'recipient'], 'public fields only');

  const edited = await admin('PATCH', `/admin/wishes/${w.id}`, { message: `Peace to every home this winter ${TAG}`, recipient_name: 'Everyone' });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.item.recipient_name, 'Everyone');

  const rej = await admin('POST', `/admin/wishes/${w.id}/status`, { status: 'rejected' });
  assert.equal(rej.data.item.status, 'rejected');
  assert.equal(rej.data.item.approved_at, null);
  assert.ok(!(await publicIds()).has(w.id), 'rejected wish is not public');

  const filtered = await admin('GET', '/admin/wishes?status=rejected&category=peace');
  assert.ok(filtered.data.items.every((x) => x.status === 'rejected' && x.category === 'peace'));
  assert.ok(filtered.data.items.some((x) => x.id === w.id));
  assert.equal(typeof filtered.data.counts.pending, 'number');

  assert.equal((await admin('DELETE', `/admin/wishes/${w.id}`)).status, 200);
  assert.equal((await admin('DELETE', `/admin/wishes/${w.id}`)).status, 404);
  created.splice(created.indexOf(w.id), 1);
});

test('public batch: random approved wishes, excludes recently shown ones, bounded size', async () => {
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const body = wish();
    await guest('POST', '/wishes', body);
    const w = await adminFind(body.message);
    created.push(w.id);
    await admin('POST', `/admin/wishes/${w.id}/status`, { status: 'approved' });
    ids.push(w.id);
  }
  const all = await guest('GET', '/wishes?limit=40');
  assert.ok(all.data.items.length <= 40);
  assert.ok(all.data.total >= 3);
  const excl = await guest('GET', `/wishes?limit=40&exclude=${ids[0]}`);
  if (excl.data.total > 40) assert.ok(!excl.data.items.some((x) => x.id === ids[0]));
  assert.equal((await guest('GET', '/wishes?limit=500')).status, 400, 'batch size is capped');
});
