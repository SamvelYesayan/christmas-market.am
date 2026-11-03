import { HttpError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { isProd } from '../config.js';
import { tr } from '../i18n/index.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: tr(req.locale, err.message), details: err.details } });
  }
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: { code: 'too_large', message: tr(req.locale, 'Request too large.') } });
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: { code: 'too_large', message: tr(req.locale, 'File too large (max 5 MB).') } });
  if (err?.code === '23505') return res.status(409).json({ error: { code: 'duplicate', message: tr(req.locale, 'That already exists.') } });
  if (err?.code === '23503') return res.status(409).json({ error: { code: 'in_use', message: tr(req.locale, 'This item is referenced elsewhere.') } });
  (req.log ?? logger).error({ err }, 'unhandled error');
  res.status(500).json({ error: { code: 'server_error', message: isProd ? tr(req.locale, 'Something went wrong in the workshop.') : err.message } });
}
