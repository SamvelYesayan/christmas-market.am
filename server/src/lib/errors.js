export class HttpError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code ?? 'error';
    this.details = details;
  }
}

export const badRequest = (msg, code = 'bad_request', details) => new HttpError(400, msg, code, details);
export const unauthorized = (msg = 'Please sign in to continue.') => new HttpError(401, msg, 'unauthorized');
export const forbidden = (msg = 'You do not have access to this.') => new HttpError(403, msg, 'forbidden');
export const notFound = (msg = 'Not found.') => new HttpError(404, msg, 'not_found');
export const conflict = (msg, code = 'conflict') => new HttpError(409, msg, code);
export const unavailable = (msg, code = 'unavailable') => new HttpError(503, msg, code);

/** Wrap async route handlers so rejections reach the error middleware. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
