/**
 * @jest-environment node
 */
// LIVE integration: the app's real API layer (client + endpoints) against a running local backend.
// Opt-in — skipped unless LIVE_API_URL is set:
//   LIVE_API_URL=http://localhost:4000 npx jest __tests__/live.integration.test.ts
// Uses the demo customer from `npm run db:seed:demo` (override with LIVE_EMAIL / LIVE_PASSWORD).
// It never calls Magical point endpoints and never redeems, links or claims anything.
import { createApiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import http from 'node:http';

// jest-expo replaces global fetch with a stub, so talk HTTP directly (minimal Response-like object).
function nodeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: init.method ?? 'GET', headers: init.headers as Record<string, string> }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const status = res.statusCode ?? 0;
        resolve({ ok: status >= 200 && status < 300, status, headers: { get: (k: string) => (res.headers[k.toLowerCase()] as string | undefined) ?? null }, json: async () => JSON.parse(text) } as unknown as Response);
      });
    });
    req.on('error', reject);
    init.signal?.addEventListener('abort', () => req.destroy(new Error('aborted')));
    if (init.body) req.write(init.body as string);
    req.end();
  });
}

const LIVE = process.env.LIVE_API_URL;
const d = LIVE ? describe : describe.skip;

d('live backend', () => {
  let token: string | null = null;
  let cartToken: string | null = null;
  const client = createApiClient({
    baseUrl: () => `${LIVE}/api/v1`,
    getToken: () => token,
    getCartToken: () => cartToken,
    onCartToken: (t) => { cartToken = t; },
    getLocale: () => 'hy',
    fetchImpl: nodeFetch as unknown as typeof fetch,
    timeoutMs: 15000,
  });
  const api = endpoints(client);

  it('home, catalog and product detail (Armenian content)', async () => {
    const home = await api.content.home();
    expect(Array.isArray(home.featured)).toBe(true);
    const cats = await api.catalog.categories();
    expect(cats.categories.length).toBeGreaterThan(0);
    const list = await api.catalog.products({ limit: 5 });
    expect(list.products.length).toBeGreaterThan(0);
    const p = await api.catalog.product(list.products[0].slug);
    expect(p.product.variants.length).toBeGreaterThan(0);
  });

  it('guest cart via X-Cart-Token', async () => {
    const list = await api.catalog.products({ limit: 20 });
    const inStock = list.products.find((x) => x.stock > 0)!;
    const v = (await api.catalog.product(inStock.slug)).product.variants.find((x) => x.stock > 0)!;
    const cart = await api.cart.add(v.id, 1);
    expect(cartToken).toMatch(/^[A-Za-z0-9_-]{20,64}$/);
    expect(cart.count).toBe(1);
    const again = await api.cart.get();
    expect(again.items[0].variantId).toBe(v.id);
    await api.cart.remove(again.items[0].id);
  });

  it('public games, calendar, academy, wishes, pioneer status/offers, checkout options', async () => {
    const [games, cal, houses, sorting, wishes, recent, status, offers, options, wheel, hidden, challenges] = await Promise.all([
      api.games.list(), api.calendar.get(), api.academy.houses(), api.academy.sorting(), api.wishes.batch([], 5), api.wishes.recent(1),
      api.pioneer.status(), api.pioneer.offers(), api.checkout.options(), api.games.wheel(), api.games.hidden(), api.games.challenges(),
    ]);
    expect(games.games.length).toBeGreaterThan(0);
    expect(cal.days).toHaveLength(31);
    expect(houses.houses).toHaveLength(4);
    expect(sorting.questions.length).toBe(7);
    expect(typeof wishes.total).toBe('number');
    expect(recent.page).toBe(1);
    expect(typeof status.available).toBe('boolean');
    expect(Array.isArray(offers.offers)).toBe(true);
    expect(options.zones.length).toBeGreaterThan(0);
    expect(Array.isArray(wheel.segments)).toBe(true);
    expect(Array.isArray(hidden.objects)).toBe(true);
    expect(Array.isArray(challenges.challenges)).toBe(true);
  });

  it('signs in as the demo customer with a bearer session and reads the account', async () => {
    const res = await api.auth.login(process.env.LIVE_EMAIL ?? 'demo@christmas-market.test', process.env.LIVE_PASSWORD ?? 'snowflake-demo-2026');
    expect(res.session?.token).toBeTruthy();
    token = res.session!.token;
    cartToken = null;
    const me = await api.auth.me();
    expect(me.user?.email).toBeTruthy();
    const dash = await api.me.dashboard();
    expect(dash.advent.total).toBe(31);
    const wl = await api.wishlist.list();
    expect(Array.isArray(wl.products)).toBe(true);
    const orders = await api.orders.mine();
    expect(Array.isArray(orders.orders)).toBe(true);
    await api.auth.logout();
    const after = await api.auth.me();
    expect(after.user).toBeNull();
  });
});
