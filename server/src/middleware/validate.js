import { badRequest } from '../lib/errors.js';

/** validate({ body, query, params }) with zod schemas; replaces values with parsed output. */
export const validate = (schemas) => (req, _res, next) => {
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key] ?? {});
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      // Our own messages are full sentences ("Enter the 8-digit number…") and are shown as written (and translated);
      // zod's terse defaults keep the field name so the client knows which input to fix.
      const first = issues[0];
      const message = !first ? 'Invalid input' : /.$/.test(first.message) ? first.message : `${first.path || key}: ${first.message}`;
      return next(badRequest(message, 'validation_error', issues));
    }
    if (key === 'query') Object.defineProperty(req, 'query', { value: result.data, writable: true });
    else req[key] = result.data;
  }
  next();
};
