// Generic, whitelisted CRUD for simple admin-managed tables. Field names in request bodies are the
// column names (snake_case). Only columns declared in the zod schema can ever be written.
import { Router } from 'express';
import { z } from 'zod';
import { pool, query } from '../../db.js';
import { ah, notFound } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { audit } from './audit.js';

export function crudRouter(table, { schema: baseSchema, pk = 'id', pkType = 'uuid', orderBy = `${pk} DESC`, jsonCols: baseJson = [], search = [], i18n = true }) {
  const r = Router();
  // Translatable tables accept an `i18n` overlay: { hy: { field: '…' }, en: { … } }
  const schema = i18n ? baseSchema.extend({ i18n: z.record(z.record(z.any())).optional() }) : baseSchema;
  const jsonCols = i18n ? [...baseJson, 'i18n'] : baseJson;
  const cols = Object.keys(schema.shape);
  const pkSchema = z.object({ id: pkType === 'uuid' ? z.string().uuid() : pkType === 'int' ? z.coerce.number().int() : z.string().max(80) });
  const val = (c, v) => (jsonCols.includes(c) && v != null ? JSON.stringify(v) : v);

  r.get('/', ah(async (req, res) => {
    const params = [];
    let where = '';
    if (req.query.q && search.length) {
      params.push(`%${String(req.query.q).slice(0, 80)}%`);
      where = `WHERE ${search.map((c) => `${c}::text ILIKE $1`).join(' OR ')}`;
    }
    const { rows } = await pool.query(`SELECT * FROM ${table} ${where} ORDER BY ${orderBy} LIMIT 500`, params);
    res.json({ items: rows });
  }));

  r.get('/:id', validate({ params: pkSchema }), ah(async (req, res) => {
    const { rows: [row] } = await query(`SELECT * FROM ${table} WHERE ${pk} = $1`, [req.params.id]);
    if (!row) throw notFound();
    res.json({ item: row });
  }));

  r.post('/', validate({ body: schema }), ah(async (req, res) => {
    const keys = cols.filter((c) => req.body[c] !== undefined);
    const { rows: [row] } = await query(
      `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
      keys.map((k) => val(k, req.body[k])));
    await audit(req, 'create', table, row[pk], req.body);
    res.status(201).json({ item: row });
  }));

  r.put('/:id', validate({ params: pkSchema, body: schema.partial() }), ah(async (req, res) => {
    const keys = cols.filter((c) => req.body[c] !== undefined && c !== pk);
    if (!keys.length) return res.json({ ok: true });
    const { rows: [row] } = await query(
      `UPDATE ${table} SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE ${pk} = $1 RETURNING *`,
      [req.params.id, ...keys.map((k) => val(k, req.body[k]))]);
    if (!row) throw notFound();
    await audit(req, 'update', table, req.params.id, req.body);
    res.json({ item: row });
  }));

  r.delete('/:id', validate({ params: pkSchema }), ah(async (req, res) => {
    const { rowCount } = await query(`DELETE FROM ${table} WHERE ${pk} = $1`, [req.params.id]);
    if (!rowCount) throw notFound();
    await audit(req, 'delete', table, req.params.id);
    res.json({ ok: true });
  }));

  return r;
}
