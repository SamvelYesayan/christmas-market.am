// Admin: Christmas Calendar — 31 days of gifts, daily claims and Grand Prize eligibility.
// Claims are shown read-only: nothing here can create, edit or move a customer's claim.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { useAt } from './i18n.js';

const KINDS = [['gift', 'Gift (text, optional coupon)'], ['coupon', 'Discount coupon'], ['points', 'Stardust points'], ['product', 'Featured product'], ['story', 'Story'], ['minigame', 'Mini-game'], ['challenge', 'Challenge']];
const COUPON_TYPES = [['percent', 'Percent off'], ['fixed', 'Amount off (֏)'], ['free_shipping', 'Free delivery']];
const STATUS = { on_track: 'On track', lost: 'Lost eligibility', qualified: 'Qualified (all 30 days)', entered: 'Entered the Grand Prize' };
const OUTCOME = { gift: 'Gift received', check_in: 'Day marked (no gift set up)', sold_out: 'Day marked (gifts ran out)', grand_entry: 'Grand Prize entry' };
const when = (v) => (v ? new Date(v).toLocaleString(document.documentElement.lang === 'hy' ? 'hy-AM' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const num = (v) => (v === '' || v == null ? undefined : Number(v));

/** Reward settings for one gift; writes into payload. */
function RewardFields({ kind, payload, onChange }) {
  const at = useAt();
  const p = payload ?? {};
  const set = (k, v) => onChange({ ...p, [k]: v });
  const coupon = (c, setC) => (
    <div className="row cal-coupon">
      <label className="field"><span>{at('Coupon type')}</span>
        <select className="input" value={c?.type ?? ''} onChange={(e) => setC(e.target.value ? { valid_days: 7, min_subtotal: 0, value: 10, ...c, type: e.target.value } : null)}>
          <option value="">{at('No coupon')}</option>{COUPON_TYPES.map(([v, l]) => <option key={v} value={v}>{at(l)}</option>)}
        </select></label>
      {c?.type && c.type !== 'free_shipping' && <label className="field"><span>{at(c.type === 'percent' ? 'Percent' : 'Amount (֏)')}</span><input className="input" type="number" min="1" value={c.value ?? ''} onChange={(e) => setC({ ...c, value: num(e.target.value) })} /></label>}
      {c?.type && <label className="field"><span>{at('Minimum order (֏)')}</span><input className="input" type="number" min="0" value={c.min_subtotal ?? 0} onChange={(e) => setC({ ...c, min_subtotal: num(e.target.value) ?? 0 })} /></label>}
      {c?.type && <label className="field"><span>{at('Valid for (days)')}</span><input className="input" type="number" min="1" max="365" value={c.valid_days ?? 7} onChange={(e) => setC({ ...c, valid_days: num(e.target.value) ?? 7 })} /></label>}
    </div>
  );
  if (kind === 'coupon') return coupon(p.type ? p : null, (c) => onChange(c ?? {}));
  if (kind === 'points') return <label className="field"><span>{at('Stardust points')}</span><input className="input" type="number" min="1" max="1000" value={p.points ?? ''} onChange={(e) => set('points', num(e.target.value))} /></label>;
  if (kind === 'product') return <label className="field"><span>{at('Product address (slug)')}</span><input className="input" value={p.product_slug ?? ''} placeholder="glass-pomegranate" onChange={(e) => set('product_slug', e.target.value.trim())} /></label>;
  if (kind === 'minigame') return <label className="field"><span>{at('Game')}</span><select className="input" value={p.game ?? 'catch'} onChange={(e) => set('game', e.target.value)}>{['catch', 'tree', 'quiz', 'wheel', 'mystery', 'hidden'].map((g) => <option key={g}>{g}</option>)}</select></label>;
  if (kind === 'story') return <label className="field"><span>{at('Story')}</span><textarea className="input" rows={3} value={p.story ?? ''} onChange={(e) => set('story', e.target.value)} /></label>;
  return (
    <>
      <label className="field"><span>{at('Message shown with the gift')}</span><textarea className="input" rows={2} value={p.text ?? ''} onChange={(e) => set('text', e.target.value)} /></label>
      {kind === 'gift' && coupon(p.coupon, (c) => onChange({ ...p, coupon: c ?? undefined }))}
    </>
  );
}

function ImageField({ value, onChange }) {
  const at = useAt();
  const { toast } = useApp();
  const upload = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    try { const r = await api.upload('/admin/calendar/images', fd); onChange(r.url); } catch (e) { toast(e.message, { tone: 'error' }); }
  };
  return (
    <div className="field"><span>{at('Picture')}</span>
      <div className="row">
        {value && <img className="cal-admin-thumb" src={value} alt="" />}
        <label className="btn btn-ghost btn-sm upload-btn">{at('Upload')}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(e) => upload(e.target.files?.[0])} /></label>
        <input className="input" placeholder="https://…" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />
        {value && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>{at('Remove')}</button>}
      </div>
    </div>
  );
}

/** Armenian + English text for a gift (base columns hold English, i18n.hy overlays Armenian). */
function TextFields({ v, set, fields }) {
  const at = useAt();
  return (
    <div className="cal-lang-grid">
      {fields.map(([k, label, rows]) => ['hy', 'en'].map((lang) => {
        const val = lang === 'en' ? v[k] ?? '' : v.i18n?.hy?.[k] ?? '';
        const onCh = (e) => (lang === 'en' ? set({ ...v, [k]: e.target.value }) : set({ ...v, i18n: { ...v.i18n, hy: { ...v.i18n?.hy, [k]: e.target.value } } }));
        return (
          <label key={k + lang} className="field"><span>{at(label)} · {lang === 'hy' ? 'Հայերեն' : 'English'}</span>
            {rows ? <textarea className="input" rows={rows} value={val} onChange={onCh} /> : <input className="input" value={val} onChange={onCh} />}
          </label>
        );
      }))}
    </div>
  );
}

const blankDay = (day) => ({ title: '', teaser: '', description: '', image_url: null, kind: 'gift', payload: {}, art: day === 31 ? 'star' : 'gift', is_available: true, max_claims: null, options: [], i18n: { hy: {} } });

function DayEditor({ year, slot, onSaved, onCancel }) {
  const at = useAt();
  const { toast } = useApp();
  const d = slot.door;
  const [v, setV] = useState(() => (d ? {
    title: d.title, teaser: d.teaser ?? '', description: d.description ?? '', image_url: d.image_url, kind: d.kind, payload: d.payload ?? {}, art: d.art,
    is_available: d.is_available, max_claims: d.max_claims, options: d.options ?? [], i18n: { ...d.i18n, hy: { ...d.i18n?.hy } },
  } : blankDay(slot.day)));
  const [busy, setBusy] = useState(false);
  const opt = (i, o) => setV({ ...v, options: v.options.map((x, k) => (k === i ? o : x)) });
  const save = async (e) => {
    e.preventDefault();
    const clean = (s) => (typeof s === 'string' && s.trim() ? s.trim() : null);
    const hy = Object.fromEntries(Object.entries(v.i18n?.hy ?? {}).filter(([, x]) => clean(x)));
    const title = clean(v.title) ?? hy.title;
    if (!title) return toast(at('Give the gift a title.'), { tone: 'error' });
    const body = {
      title, teaser: clean(v.teaser), description: clean(v.description), image_url: v.image_url || null, kind: v.kind, payload: v.payload ?? {}, art: v.art || 'gift',
      is_available: v.is_available, max_claims: v.max_claims || null, i18n: { ...v.i18n, hy },
      options: v.options.map((o) => ({ key: o.key, title: clean(o.title) ?? clean(o.i18n?.hy?.title) ?? o.key, description: clean(o.description), image_url: o.image_url || null, kind: o.kind, payload: o.payload ?? {},
        i18n: { hy: Object.fromEntries(Object.entries(o.i18n?.hy ?? {}).filter(([, x]) => clean(x))) } })),
    };
    setBusy(true);
    try { await api.put(`/admin/calendar/${year}/${slot.day}`, body); toast(at('Saved.')); onSaved(); } catch (err) { toast(err.message, { tone: 'error' }); } finally { setBusy(false); }
  };
  return (
    <form className="admin-card cal-editor" onSubmit={save}>
      <div className="row between"><h2>{slot.day === 31 ? at('31 December · Grand Prize') : `${at('Day')} ${slot.day}`}</h2>
        {slot.claims > 0 && <span className="tag">{slot.claims} {at('claims')}</span>}</div>
      {slot.claims > 0 && <p className="muted small">{at('Customers have already claimed this day. Changes affect what is shown from now on; claims already made stay exactly as they are.')}</p>}
      <TextFields v={v} set={setV} fields={[['title', 'Title'], ['teaser', 'Short hint'], ['description', 'Description', 3]]} />
      <ImageField value={v.image_url} onChange={(url) => setV({ ...v, image_url: url })} />
      <div className="row">
        <label className="field"><span>{at('Gift type')}</span><select className="input" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value, payload: {} })}>{KINDS.map(([k, l]) => <option key={k} value={k}>{at(l)}</option>)}</select></label>
        {slot.day !== 31 && <label className="field"><span>{at('Limit (number of gifts, empty = no limit)')}</span><input className="input" type="number" min="1" value={v.max_claims ?? ''} onChange={(e) => setV({ ...v, max_claims: num(e.target.value) ?? null })} /></label>}
        <label className="field cal-check-field"><input type="checkbox" checked={v.is_available} onChange={(e) => setV({ ...v, is_available: e.target.checked })} /><span>{at('Gift is available')}</span></label>
      </div>
      {!v.options.length && <RewardFields kind={v.kind} payload={v.payload} onChange={(payload) => setV({ ...v, payload })} />}

      {slot.day !== 31 && (
        <section className="cal-options-admin">
          <div className="row between"><h3>{at('Gift options')}</h3>
            <button type="button" className="btn btn-ghost btn-sm" disabled={v.options.length >= 6}
              onClick={() => setV({ ...v, options: [...v.options, { key: `option-${Math.random().toString(36).slice(2, 8)}`, title: '', kind: 'gift', payload: {}, i18n: { hy: {} } }] })}>{at('+ Add option')}</button></div>
          <p className="muted small">{at('Leave empty for a single gift. With options, the customer chooses one of them.')}</p>
          {v.options.map((o, i) => (
            <div key={o.key} className="admin-card cal-option-admin">
              <div className="row between"><b>{at('Option')} {i + 1}</b><button type="button" className="btn btn-ghost btn-sm danger" onClick={() => setV({ ...v, options: v.options.filter((_, k) => k !== i) })}>{at('Remove')}</button></div>
              <TextFields v={o} set={(x) => opt(i, x)} fields={[['title', 'Title'], ['description', 'Description', 2]]} />
              <ImageField value={o.image_url} onChange={(url) => opt(i, { ...o, image_url: url })} />
              <label className="field"><span>{at('Gift type')}</span><select className="input" value={o.kind} onChange={(e) => opt(i, { ...o, kind: e.target.value, payload: {} })}>{KINDS.map(([k, l]) => <option key={k} value={k}>{at(l)}</option>)}</select></label>
              <RewardFields kind={o.kind} payload={o.payload} onChange={(payload) => opt(i, { ...o, payload })} />
            </div>
          ))}
        </section>
      )}
      <div className="row"><button className="btn btn-sm" disabled={busy}>{at('Save day')}</button><button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>{at('Cancel')}</button></div>
    </form>
  );
}

function DaysTab({ year, data, reload }) {
  const at = useAt();
  const { toast } = useApp();
  const [editing, setEditing] = useState(null);
  const toggle = async (slot) => {
    try { await api.post(`/admin/calendar/${year}/${slot.day}/availability`, { is_available: !slot.door.is_available }); reload(); } catch (e) { toast(e.message, { tone: 'error' }); }
  };
  const slot = editing && data.days.find((s) => s.day === editing);
  return (
    <>
      <div className="kpis">
        <div className="kpi"><span>{at('Participants')}</span><b>{data.participants}</b></div>
        <div className="kpi"><span>{at('On track')}</span><b>{data.grand.on_track}</b></div>
        <div className="kpi"><span>{at('Qualified (all 30 days)')}</span><b>{data.grand.qualified}</b></div>
        <div className="kpi"><span>{at('Entered the Grand Prize')}</span><b>{data.grand.entered}</b></div>
        <div className="kpi"><span>{at('Lost eligibility')}</span><b>{data.grand.lost}</b></div>
      </div>
      {slot ? <DayEditor key={`${year}-${slot.day}`} year={year} slot={slot} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} /> : (
        <ol className="cal-admin-grid">
          {data.days.map((s) => (
            <li key={s.day} className={`admin-card cal-admin-day ${s.isGrand ? 'is-grand' : ''} ${data.todayDay === s.day ? 'is-today' : ''} ${!s.door ? 'is-empty' : s.door.is_available ? '' : 'is-off'}`}>
              <div className="row between"><b className="cal-admin-num">{s.day}</b>{data.todayDay === s.day && <span className="tag">{at('Today')}</span>}</div>
              <p className="cal-admin-title">{s.door ? (s.door.i18n?.hy?.title || s.door.title) : at('Not set up yet')}</p>
              <small className="muted">{s.door ? `${at(KINDS.find(([k]) => k === s.door.kind)?.[1] ?? s.door.kind)}${s.door.options?.length ? ` · ${s.door.options.length} ${at('options')}` : ''}` : ' '}</small>
              <small>{s.claims} {at('claims')}{s.door?.max_claims ? ` · ${s.gifts}/${s.door.max_claims}` : ''}</small>
              <div className="row">
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(s.day)}>{s.door ? at('Edit') : at('Set up')}</button>
                {s.door && <button className={`chip ${s.door.is_available ? 'on' : ''}`} onClick={() => toggle(s)} aria-pressed={s.door.is_available}>{s.door.is_available ? at('Available') : at('Off')}</button>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function ClaimsTab({ year }) {
  const at = useAt();
  const [day, setDay] = useState('');
  const [page, setPage] = useState(1);
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/admin/calendar/${year}/claims${qs({ day, page })}`).then(setD); }, [year, day, page]);
  const pages = d ? Math.max(1, Math.ceil(d.total / d.pageSize)) : 1;
  return (
    <>
      <div className="row">
        <select className="input" value={day} onChange={(e) => { setDay(e.target.value); setPage(1); }} aria-label={at('Day')}>
          <option value="">{at('All days')}</option>{Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{at('Day')} {i + 1}</option>)}
        </select>
        {d && <span className="muted">{d.total} {at('claims')}</span>}
      </div>
      {!d ? <p className="muted">{at('Loading…')}</p> : !d.items.length ? <p className="muted">{at('No claims yet.')}</p> : (
        <div className="table-wrap"><table className="admin-table">
          <thead><tr><th>{at('Day')}</th><th>{at('Customer')}</th><th>{at('Claimed at')}</th><th>{at('Option')}</th><th>{at('Result')}</th><th>{at('Counts')}</th></tr></thead>
          <tbody>{d.items.map((c) => (
            <tr key={`${c.user_id}-${c.day}`}>
              <td><b>{c.day}</b></td>
              <td><Link to={`/admin/customers/${c.user_id}`}><b>{c.name}</b></Link><br /><small className="muted">{c.email}</small></td>
              <td>{when(c.opened_at)}</td><td>{c.option_key ?? '—'}</td><td>{at(OUTCOME[c.outcome] ?? 'Opened (old calendar)')}</td>
              <td title={c.valid ? '' : at('Opened on a different day, so it does not count')}>{c.valid ? '✓' : '✕'}</td>
            </tr>))}</tbody>
        </table></div>
      )}
      {pages > 1 && <div className="row wish-pager"><button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button><span className="muted">{page} / {pages}</span><button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>→</button></div>}
    </>
  );
}

function CustomersTab({ year }) {
  const at = useAt();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [d, setD] = useState(null);
  const load = () => api.get(`/admin/calendar/${year}/customers${qs({ q, status, page })}`).then(setD);
  useEffect(() => { load(); }, [year, status, page]); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = d ? Math.max(1, Math.ceil(d.total / d.pageSize)) : 1;
  return (
    <>
      <div className="row">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }}><input className="input" placeholder={at('Search name or email')} value={q} onChange={(e) => setQ(e.target.value)} /></form>
        <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label={at('Grand Prize')}>
          <option value="">{at('Everyone')}</option>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{at(l)}</option>)}
        </select>
      </div>
      {!d ? <p className="muted">{at('Loading…')}</p> : !d.items.length ? <p className="muted">{at('No customers found.')}</p> : (
        <div className="table-wrap"><table className="admin-table">
          <thead><tr><th>{at('Customer')}</th><th>{at('Completed')}</th><th>{at('Completed days')}</th><th>{at('Missed days')}</th><th>{at('Grand Prize')}</th></tr></thead>
          <tbody>{d.items.map((u) => (
            <tr key={u.id}>
              <td><Link to={`/admin/customers/${u.id}`}><b>{u.name}</b></Link><br /><small className="muted">{u.email}</small></td>
              <td><b>{u.completed}</b> / 31</td>
              <td className="cal-days-cell">{u.completedDays.length ? u.completedDays.join(', ') : '—'}</td>
              <td className="cal-days-cell">{u.missedDays.length ? u.missedDays.join(', ') : '—'}</td>
              <td><span className={`cal-elig st-${u.eligibility}`}>{at(STATUS[u.eligibility])}</span></td>
            </tr>))}</tbody>
        </table></div>
      )}
      {pages > 1 && <div className="row wish-pager"><button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button><span className="muted">{page} / {pages}</span><button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>→</button></div>}
    </>
  );
}

export default function AdminCalendar() {
  const at = useAt();
  const { toast } = useApp();
  const [year, setYear] = useState(null);
  const [tab, setTab] = useState('days');
  const [data, setData] = useState(null);
  const load = (y = year) => api.get(`/admin/calendar${qs({ year: y })}`).then((r) => { setData(r); setYear(r.year); }).catch((e) => toast(e.message, { tone: 'error' }));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <p className="muted">{at('Loading…')}</p>;
  return (
    <div className="admin-section">
      <header className="admin-head"><h1>{at('Christmas Calendar')}</h1>
        <div className="row">
          <select className="input" value={year} onChange={(e) => load(Number(e.target.value))} aria-label={at('Year')}>
            {[data.year - 1, data.year, data.year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <Link className="btn btn-ghost btn-sm" to="/advent" target="_blank">{at('View calendar')} ↗</Link>
        </div>
      </header>
      <p className="muted">{at('31 days: one gift a day from 1 to 30 December, and the Grand Prize on 31 December for customers who claimed all 30 days. Days are counted in Yerevan time. Customer claims cannot be changed here.')}</p>
      <div className="row wish-tabs" role="tablist">
        {[['days', 'Days & gifts'], ['claims', 'Daily claims'], ['customers', 'Customers & eligibility']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{at(l)}</button>
        ))}
      </div>
      {tab === 'days' && <DaysTab year={year} data={data} reload={() => load()} />}
      {tab === 'claims' && <ClaimsTab key={year} year={year} />}
      {tab === 'customers' && <CustomersTab key={year} year={year} />}
    </div>
  );
}
