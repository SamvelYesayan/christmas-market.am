// Thin fetch wrapper: same-origin cookies, JSON, typed errors.
// A failed request always rejects with an ApiError, so pages can show it instead of rendering nothing.
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let visitorId = null;
let locale = 'hy';
/** UI language sent to the API so server content and messages come back translated. */
export function setLocale(l) {
  locale = l;
}
/** Analytics visitor id is only attached once the visitor has accepted analytics. */
export function setVisitorId(id) {
  visitorId = id;
}

const FAILURE = {
  network: { hy: 'Չհաջողվեց կապվել սերվերի հետ։ Ստուգեք կապը և նորից փորձեք։', en: 'Could not reach the server. Check your connection and try again.' },
  badResponse: { hy: 'Սերվերից ստացվեց անսպասելի պատասխան։ Խնդրում ենք փորձել մի փոքր ուշ։', en: 'The server sent an unexpected response. Please try again in a moment.' },
};
const failure = (kind) => FAILURE[kind][locale] ?? FAILURE[kind].en;

async function request(method, path, body, { form } = {}) {
  const headers = { Accept: 'application/json', 'X-Locale': locale };
  if (body && !form) headers['Content-Type'] = 'application/json';
  if (visitorId) headers['X-Visitor-Id'] = visitorId;
  let res;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      credentials: 'same-origin',
      headers,
      body: form ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', failure('network'));
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiError(res.status, e.code ?? 'error', e.message ?? 'The elves dropped something. Please try again.', e.details);
  }
  // A proxy or static host answering 200 with an HTML page must not look like an empty success.
  if (data === null) throw new ApiError(res.status, 'bad_response', failure('badResponse'));
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b ?? {}),
  put: (p, b) => request('PUT', p, b ?? {}),
  patch: (p, b) => request('PATCH', p, b ?? {}),
  del: (p, b) => request('DELETE', p, b),
  upload: (p, formData) => request('POST', p, formData, { form: true }),
};

export const qs = (obj) => {
  const s = new URLSearchParams(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const str = s.toString();
  return str ? `?${str}` : '';
};
