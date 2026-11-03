import { query } from '../../db.js';

const SENSITIVE = /password|secret|token|key/i;
const scrub = (obj) => obj && Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, SENSITIVE.test(k) ? '[redacted]' : v]));

export function audit(req, action, entity, entityId, details) {
  return query('INSERT INTO audit_log (actor_id, action, entity, entity_id, details) VALUES ($1,$2,$3,$4,$5)',
    [req.user?.id ?? null, action, entity, entityId != null ? String(entityId) : null, details ? scrub(details) : null]);
}
