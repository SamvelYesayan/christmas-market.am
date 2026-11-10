// The one HTTP client for the Christmas Market API (/api/v1).
//  • base URL from config (env-based), JSON in/out, X-Locale so server content arrives translated
//  • identifies as the native app (X-Christmas-Client: mobile) and sends the session as a Bearer token
//  • per-request timeout + caller cancellation (AbortSignal)
//  • retries ONLY safe, idempotent reads (GET/HEAD) on network errors, timeouts and 502/503/504 — never writes
//  • every failure becomes an ApiError with a stable `code`

export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly retryAfter?: number;
  constructor(status: number, code: string, message: string, details?: unknown, retryAfter?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfter = retryAfter;
  }
  /** True when the request never got a server answer (offline, DNS, timeout). */
  get isNetwork() {
    return this.code === 'network' || this.code === 'timeout';
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Override retries for GET (default 2). Writes are never retried. */
  retries?: number;
}

export interface ClientDeps {
  baseUrl: () => string;
  getToken: () => string | null;
  getCartToken: () => string | null;
  onCartToken?: (token: string) => void;
  getLocale: () => string;
  getVisitorId?: () => string | null;
  /** Called when the server rejects our session token (expired / revoked). */
  onUnauthorized?: () => void;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Localized fallback messages for failures with no server message. */
  messages?: () => { network: string; timeout: string; generic: string };
}

const SAFE: HttpMethod[] = ['GET', 'HEAD'];
const RETRY_STATUS = new Set([502, 503, 504]);
const DEFAULT_MESSAGES = {
  network: 'Cannot reach the Christmas Market. Check your connection and try again.',
  timeout: 'The request took too long. Please try again.',
  generic: 'The elves dropped something. Please try again.',
};

export function buildQuery(q?: RequestOptions['query']): string {
  if (!q) return '';
  const parts = Object.entries(q)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export function createApiClient(deps: ClientDeps) {
  const doFetch = deps.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const msgs = () => deps.messages?.() ?? DEFAULT_MESSAGES;

  async function once<T>(method: HttpMethod, path: string, opts: RequestOptions): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, opts.timeoutMs ?? deps.timeoutMs ?? 15000);
    const onAbort = () => controller.abort();
    if (opts.signal) {
      if (opts.signal.aborted) controller.abort();
      else opts.signal.addEventListener('abort', onAbort);
    }
    const token = deps.getToken();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Locale': deps.getLocale(),
      'X-Christmas-Client': 'mobile',
    };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const cartToken = deps.getCartToken();
    if (cartToken) headers['X-Cart-Token'] = cartToken;
    const vid = deps.getVisitorId?.();
    if (vid) headers['X-Visitor-Id'] = vid;

    let res: Response;
    try {
      res = await doFetch(`${deps.baseUrl()}${path}${buildQuery(opts.query)}`, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
        credentials: 'omit',
      });
    } catch (err) {
      if (opts.signal?.aborted && !timedOut) {
        throw new ApiError(0, 'aborted', 'Request cancelled.');
      }
      if (timedOut) throw new ApiError(0, 'timeout', msgs().timeout);
      throw new ApiError(0, 'network', msgs().network, err instanceof Error ? err.message : undefined);
    } finally {
      clearTimeout(timeout);
      opts.signal?.removeEventListener('abort', onAbort);
    }

    const newCart = res.headers?.get?.('x-cart-token');
    if (newCart) deps.onCartToken?.(newCart);

    if (res.status === 204) return null as T;
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const e = (data as { error?: { code?: string; message?: string; details?: { retryAfter?: number } } } | null)?.error ?? {};
      const retryHeader = Number(res.headers?.get?.('retry-after'));
      const retryAfter = e.details?.retryAfter ?? (Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : undefined);
      if (res.status === 401 && token && path !== '/auth/login' && path !== '/auth/password') deps.onUnauthorized?.();
      throw new ApiError(res.status, e.code ?? 'error', e.message ?? msgs().generic, e.details, retryAfter);
    }
    return data as T;
  }

  async function request<T>(method: HttpMethod, path: string, opts: RequestOptions = {}): Promise<T> {
    const maxRetries = SAFE.includes(method) ? (opts.retries ?? 2) : 0;
    let attempt = 0;
    for (;;) {
      try {
        return await once<T>(method, path, opts);
      } catch (err) {
        const retryable = err instanceof ApiError && (err.code === 'network' || err.code === 'timeout' || RETRY_STATUS.has(err.status));
        if (!retryable || attempt >= maxRetries || opts.signal?.aborted) throw err;
        attempt += 1;
        await sleep(400 * 2 ** (attempt - 1));
      }
    }
  }

  return {
    request,
    get: <T>(path: string, opts?: Omit<RequestOptions, 'body'>) => request<T>('GET', path, opts),
    post: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('POST', path, { ...opts, body: body ?? {} }),
    put: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PUT', path, { ...opts, body: body ?? {} }),
    patch: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PATCH', path, { ...opts, body: body ?? {} }),
    del: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('DELETE', path, { ...opts, body }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
