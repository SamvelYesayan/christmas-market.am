import { ApiError, buildQuery, createApiClient, type ClientDeps } from '@/api/client';

type Call = { url: string; init: RequestInit };
type Responder = Response | Error | ((init: RequestInit) => Promise<Response>);

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
  } as unknown as Response;
}

function setup(responses: Responder[], over: Partial<ClientDeps> = {}) {
  const calls: Call[] = [];
  const queue = [...responses];
  const fetchImpl = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = queue.shift();
    if (!next) throw new Error('no more responses');
    if (next instanceof Error) throw next;
    if (typeof next === 'function') return next(init);
    return next;
  });
  const deps: ClientDeps = {
    baseUrl: () => 'http://api.test/api/v1',
    getToken: () => 'tok_abcdefghijklmnopqrstuvwxyz',
    getCartToken: () => null,
    getLocale: () => 'hy',
    fetchImpl: fetchImpl as unknown as typeof fetch,
    sleep: async () => {},
    ...over,
  };
  return { client: createApiClient(deps), calls, fetchImpl };
}

/** Resolves with the ApiError a request fails with (and fails the test if it succeeds). */
const fail = (p: Promise<unknown>) => p.then(() => { throw new Error('expected the request to fail'); }, (e: ApiError) => e);

describe('API client', () => {
  it('sends the mobile identity, bearer token, locale and JSON body', async () => {
    const { client, calls } = setup([json(200, { ok: true })], { getCartToken: () => 'cart_abcdefghijklmnopqrst', getVisitorId: () => 'visitor-1234' });
    await client.post('/cart/items', { variantId: 'v1', quantity: 1 });
    const h = calls[0].init.headers as Record<string, string>;
    expect(calls[0].url).toBe('http://api.test/api/v1/cart/items');
    expect(h['X-Christmas-Client']).toBe('mobile');
    expect(h.Authorization).toBe('Bearer tok_abcdefghijklmnopqrstuvwxyz');
    expect(h['X-Locale']).toBe('hy');
    expect(h['X-Cart-Token']).toBe('cart_abcdefghijklmnopqrst');
    expect(h['X-Visitor-Id']).toBe('visitor-1234');
    expect(h['Content-Type']).toBe('application/json');
    expect(calls[0].init.credentials).toBe('omit');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ variantId: 'v1', quantity: 1 });
  });

  it('omits Authorization when signed out', async () => {
    const { client, calls } = setup([json(200, {})], { getToken: () => null });
    await client.get('/cart');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('maps server errors to ApiError with code, message and details', async () => {
    const { client } = setup([json(400, { error: { code: 'invalid_card', message: 'The card number or security code is incorrect.', details: { attemptsLeft: 2 } } })]);
    const err = await fail(client.post('/pioneer/link', {}));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('invalid_card');
    expect(err.message).toMatch(/incorrect/);
    expect(err.details).toEqual({ attemptsLeft: 2 });
  });

  it('reads retryAfter from error details or the Retry-After header', async () => {
    const { client } = setup([json(429, { error: { code: 'too_many_attempts', message: 'x', details: { retryAfter: 30 } } }), json(503, { error: { code: 'db_unavailable', message: 'y' } }, { 'retry-after': '10' })]);
    expect((await fail(client.post('/a', {}))).retryAfter).toBe(30);
    expect((await fail(client.post('/b', {}))).retryAfter).toBe(10);
  });

  it('retries safe GET requests on network errors and 503, then succeeds', async () => {
    const { client, fetchImpl } = setup([new TypeError('Network request failed'), json(503, { error: { code: 'db_unavailable', message: 'x' } }), json(200, { ok: 1 })]);
    await expect(client.get('/products')).resolves.toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('gives up after the retry budget', async () => {
    const { client, fetchImpl } = setup([new TypeError('x'), new TypeError('x'), new TypeError('x'), json(200, {})]);
    await expect(client.get('/products')).rejects.toMatchObject({ code: 'network' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('never retries writes (POST) — a redemption or order is sent exactly once', async () => {
    const { client, fetchImpl } = setup([new TypeError('Network request failed'), json(200, {})]);
    const err = await fail(client.post('/pioneer/offers/x/redeem', { requestId: 'r' }));
    expect(err.code).toBe('network');
    expect(err.isNetwork).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not retry 4xx answers', async () => {
    const { client, fetchImpl } = setup([json(404, { error: { code: 'not_found', message: 'Not found.' } })]);
    await expect(client.get('/products/x')).rejects.toMatchObject({ status: 404 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('times out slow requests with a timeout error', async () => {
    jest.useFakeTimers();
    const never = (init: RequestInit) => new Promise<Response>((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    });
    const { client } = setup([never], { timeoutMs: 1000 });
    const p = fail(client.post('/orders', {}));
    jest.advanceTimersByTime(1100);
    const err = await p;
    expect(err.code).toBe('timeout');
    jest.useRealTimers();
  });

  it('supports caller cancellation without retrying', async () => {
    const controller = new AbortController();
    const hang = (init: RequestInit) => new Promise<Response>((_, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    const { client, fetchImpl } = setup([hang, json(200, {})]);
    const p = fail(client.get('/products', { signal: controller.signal }));
    controller.abort();
    const err = await p;
    expect(err.code).toBe('aborted');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reports an expired session (401 with a token) but not a failed login', async () => {
    const onUnauthorized = jest.fn();
    const { client } = setup([
      json(401, { error: { code: 'unauthorized', message: 'Please sign in to continue.' } }),
      json(401, { error: { code: 'unauthorized', message: 'That email and password do not match.' } }),
    ], { onUnauthorized });
    await client.get('/me/dashboard').catch(() => {});
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    await client.post('/auth/login', {}).catch(() => {});
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('stores a new guest cart token from the X-Cart-Token response header', async () => {
    const onCartToken = jest.fn();
    const { client } = setup([json(201, { items: [] }, { 'x-cart-token': 'cart_new_token_abcdefghijk' })], { onCartToken, getToken: () => null });
    await client.post('/cart/items', {});
    expect(onCartToken).toHaveBeenCalledWith('cart_new_token_abcdefghijk');
  });

  it('uses localized fallback messages when the server sends none', async () => {
    const { client } = setup([new TypeError('fail'), new TypeError('fail'), new TypeError('fail')], { messages: () => ({ network: 'OFFLINE', timeout: 'SLOW', generic: 'OOPS' }) });
    await expect(client.get('/x')).rejects.toMatchObject({ message: 'OFFLINE', code: 'network' });
  });

  it('handles 204 No Content', async () => {
    const { client } = setup([{ ok: true, status: 204, headers: { get: () => null }, json: async () => { throw new Error('no body'); } } as unknown as Response]);
    await expect(client.post('/analytics', {})).resolves.toBeNull();
  });

  it('builds query strings without empty values', () => {
    expect(buildQuery({ a: 1, b: undefined, c: '', d: 'x y' })).toBe('?a=1&d=x%20y');
    expect(buildQuery({})).toBe('');
  });
});
