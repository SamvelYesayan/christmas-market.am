// Generic, config-driven CRUD screen for the simpler admin entities.
import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { useAt } from './i18n.js';

const toLocal = (v) => (v ? new Date(v).toISOString().slice(0, 16) : '');

function defaultsFor(fields) {
  return Object.fromEntries(fields.map((f) => [f.name, f.default ?? (f.type === 'bool' ? true : f.type === 'json' ? {} : f.type === 'number' ? 0 : '')]));
}

function FieldInput({ f, value, onChange }) {
  const at = useAt();
  const id = `fld-${f.name}`;
  if (f.type === 'bool') return <label className="check"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {at(f.label)}</label>;
  let input;
  if (f.type === 'select') input = <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>{f.options.map((o) => <option key={o} value={o}>{o}</option>)}</select>;
  else if (f.type === 'textarea') input = <textarea id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  else if (f.type === 'json') input = <textarea id={id} className="mono" rows={f.rows ?? 5} value={typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2)} onChange={(e) => onChange(e.target.value)} />;
  else if (f.type === 'datetime') input = <input id={id} type="datetime-local" value={toLocal(value)} onChange={(e) => onChange(e.target.value)} />;
  else if (f.type === 'date') input = <input id={id} type="date" value={value ? String(value).slice(0, 10) : ''} onChange={(e) => onChange(e.target.value)} />;
  else if (f.type === 'color') input = <input id={id} type="color" value={value || '#c8102e'} onChange={(e) => onChange(e.target.value)} />;
  else input = <input id={id} type={f.type === 'number' ? 'number' : 'text'} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  return <div className="field"><label htmlFor={id}>{at(f.label)}</label>{input}{f.hint && <span className="hint">{at(f.hint)}</span>}</div>;
}

export function serialize(fields, form) {
  const out = {};
  for (const f of fields) {
    let v = form[f.name];
    if (f.readOnlyOnEdit && form.__editing) continue;
    if (f.type === 'number') v = v === '' || v == null ? (f.nullable ? null : 0) : Number(v);
    else if (f.type === 'json') v = typeof v === 'string' ? (v.trim() ? JSON.parse(v) : f.nullable ? null : {}) : v;
    else if (f.type === 'datetime') v = v ? new Date(v).toISOString() : null;
    else if (f.type === 'date') v = v || (f.nullable ? null : undefined);
    else if (f.type === 'text' || f.type === 'textarea' || f.type === undefined) v = v === '' && f.nullable ? null : v;
    if (v !== undefined) out[f.name] = v;
  }
  return out;
}

export default function Crud({ title, endpoint, pk = 'id', fields: baseFields, columns, description, canCreate = true, i18n = true }) {
  const at = useAt();
  const { toast } = useApp();
  // Every translatable entity gets an Armenian overlay editor: {"hy": {"field": "…"}}
  const fields = i18n ? [...baseFields, { name: 'i18n', label: 'Armenian translation (JSON)', type: 'json', rows: 6, hint: 'Translations as {"hy": {"field": "…"}} — fields not translated fall back to English.' }] : baseFields;
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);

  const load = () => api.get(`/admin/${endpoint}${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((r) => setItems(r.items), (e) => setError(e));
  useEffect(() => { setItems(null); load(); }, [endpoint]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const body = serialize(fields, form);
      if (form.__editing) await api.put(`/admin/${endpoint}/${encodeURIComponent(form.__editing)}`, body);
      else await api.post(`/admin/${endpoint}`, body);
      toast(at('Saved'), { icon: '✅' });
      setForm(null);
      load();
    } catch (err) {
      setError(err instanceof SyntaxError ? new Error(`Invalid JSON: ${err.message}`) : err);
    }
  };
  const remove = async (row) => {
    if (!window.confirm(at('Delete this item permanently?'))) return;
    try {
      await api.del(`/admin/${endpoint}/${encodeURIComponent(row[pk])}`);
      load();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };

  return (
    <div className="admin-section">
      <header className="admin-head">
        <div><h1>{at(title)}</h1>{description && <p className="muted">{at(description)}</p>}</div>
        <div className="row">
          <form onSubmit={(e) => { e.preventDefault(); load(); }}><input className="input" placeholder={at('Search…')} value={q} onChange={(e) => setQ(e.target.value)} /></form>
          {canCreate && <button className="btn btn-sm" onClick={() => setForm(defaultsFor(fields))}>{at('+ New')}</button>}
        </div>
      </header>
      {error && !form && <div className="form-error">{error.message}</div>}
      {!items ? <p className="muted">{at('Loading…')}</p> : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr>{columns.map((c) => <th key={c.key}>{at(c.label)}</th>)}<th /></tr></thead>
            <tbody>
              {items.map((row) => (
                <tr key={row[pk]}>
                  {columns.map((c) => <td key={c.key}>{c.render ? c.render(row) : String(row[c.key] ?? '—')}</td>)}
                  <td className="actions">
                    <button className="link" onClick={() => setForm({ ...defaultsFor(fields), ...row, __editing: row[pk] })}>{at('Edit')}</button>
                    <button className="link danger" onClick={() => remove(row)}>{at('Delete')}</button>
                  </td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={columns.length + 1} className="muted">{at('Nothing here yet.')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {form && (
        <div className="admin-modal" onClick={() => setForm(null)}>
          <form className="admin-modal-card" onSubmit={save} onClick={(e) => e.stopPropagation()}>
            <h2>{form.__editing ? at('Edit') : at('New')} · {at(title)}</h2>
            {error && <div className="form-error">{error.message}</div>}
            <div className="admin-form-grid">
              {fields.map((f) => (f.readOnlyOnEdit && form.__editing ? null : (
                <div key={f.name} className={f.wide || f.type === 'json' || f.type === 'textarea' ? 'wide' : ''}>
                  <FieldInput f={f} value={form[f.name]} onChange={(v) => setForm({ ...form, [f.name]: v })} />
                </div>
              )))}
            </div>
            <div className="row"><button className="btn btn-sm">{at('Save')}</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(null)}>{at('Cancel')}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
