import { badRequest } from '../lib/errors.js';

/** validate({ body, query, params }) with zod schemas; replaces values with parsed output. */
export const validate = (schemas) => (req, _res, next) => {
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key] ?? {});
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return next(badRequest(issues[0] ? `${issues[0].path || key}: ${issues[0].message}` : 'Invalid input', 'validation_error', issues));
    }
    if (key === 'query') Object.defineProperty(req, 'query', { value: result.data, writable: true });
    else req[key] = result.data;
  }
  next();
};
