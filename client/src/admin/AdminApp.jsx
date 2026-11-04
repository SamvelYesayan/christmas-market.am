// The Elves' Office — admin panel (lazy-loaded, separate bundle).
import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { api, qs } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { money } from '../lib.js';
import Crud from './Crud.jsx';
import ProductEditor from './ProductEditor.jsx';
import { PAY_STATUSES, STATUSES, payLabel, statusLabel } from '../pages/Order.jsx';
import { LangSwitch } from '../i18n/index.jsx';

const STATUS_LABEL = new Proxy({}, { get: (_, k) => statusLabel(k), ownKeys: () => STATUSES, getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
const PAY_LABEL = new Proxy({}, { get: (_, k) => payLabel(k), ownKeys: () => PAY_STATUSES, getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
import '../styles/admin.css';
import { useAt } from './i18n.js';

const yes = (v) => (v ? '✓' : '—');
const date = (v) => (v ? new Date(v).toLocaleDateString(document.documentElement.lang === 'hy' ? 'hy-AM' : 'en-GB') : '—');

/* ───────── Dashboard ───────── */
function BarChart({ data, valueKey, labelKey, format }) {
  const at = useAt();
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  const w = 720;
  const h = 200;
  const bw = w / data.length;
  return (
    <div className="chart">
      <div className="chart-readout">{hover != null ? <><b>{format(data[hover][valueKey])}</b> · {data[hover][labelKey]}{data[hover].orders != null ? ` · ${data[hover].orders} ${at('orders')}` : ''}</> : <span className="muted">{at('Hover a bar for details')}</span>}</div>
      <svg viewBox={`0 0 ${w} ${h + 20}`} role="img" aria-label={at('Revenue by day')}>
        {[0.25, 0.5, 0.75, 1].map((t) => <line key={t} x1="0" x2={w} y1={h - h * t} y2={h - h * t} stroke="currentColor" strokeOpacity="0.08" />)}
        <line x1="0" x2={w} y1={h} y2={h} stroke="currentColor" strokeOpacity="0.25" />
        {data.map((d, i) => {
          const bh = (d[valueKey] / max) * (h - 10);
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={i * bw} y="0" width={bw} height={h} fill="transparent" />
              {bh > 0 && <path d={`M${i * bw + 1} ${h} V${h - bh + 4} q0 -4 4 -4 H${(i + 1) * bw - 5} q4 0 4 4 V${h}z`} fill="var(--admin-accent)" opacity={hover == null || hover === i ? 1 : 0.45} />}
            </g>
          );
        })}
        <text x="0" y={h + 16} fontSize="11" fill="currentColor" opacity="0.6">{data[0]?.[labelKey]}</text>
        <text x={w} y={h + 16} fontSize="11" fill="currentColor" opacity="0.6" textAnchor="end">{data[data.length - 1]?.[labelKey]}</text>
      </svg>
    </div>
  );
}

function Dashboard() {
  const at = useAt();
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);
  useEffect(() => { setD(null); api.get(`/admin/analytics?days=${days}`).then(setD); }, [days]);
  if (!d) return <p className="muted">{at('Counting the gifts…')}</p>;
  const delta = (cur, prev) => (prev ? `${cur >= prev ? '▲' : '▼'} ${Math.abs(Math.round(((cur - prev) / prev) * 100))}% ${at('vs previous')}` : at('no previous data'));
  const funnel = [[at('Visits'), d.funnel.visits], [at('Product views'), d.funnel.productViews], [at('Add to sleigh'), d.funnel.addToCart], [at('Checkout started'), d.funnel.checkout], [at('Orders'), d.funnel.purchases]];
  const fmax = Math.max(1, ...funnel.map((f) => f[1]));
  return (
    <div className="admin-section">
      <header className="admin-head">
        <div><h1>{at('Dashboard')}</h1><p className="muted">{at('Revenue counts paid and cash-on-delivery orders, excluding test and cancelled orders.')}</p></div>
        <div className="row">{[7, 30, 90].map((n) => <button key={n} className={`chip ${days === n ? 'on' : ''}`} onClick={() => setDays(n)}>{n} {at('days')}</button>)}</div>
      </header>
      <div className="kpis">
        <div className="kpi"><span>{at('Revenue')}</span><b>{money(d.revenue)}</b><small>{delta(d.revenue, d.previous.revenue)}</small></div>
        <div className="kpi"><span>{at('Orders')}</span><b>{d.orders}</b><small>{delta(d.orders, d.previous.orders)}</small></div>
        <div className="kpi"><span>{at('Average order')}</span><b>{money(d.aov)}</b><small>{at('Discounts given:')} {money(d.discounts)}</small></div>
        <div className="kpi"><span>{at('Conversion')}</span><b>{d.funnel.conversionRate != null ? `${d.funnel.conversionRate}%` : '—'}</b><small>{at('orders ÷ consenting visitors')}</small></div>
        <div className="kpi"><span>{at('Customers')}</span><b>{d.customers.total}</b><small>{d.customers.new} {at('new')} · {d.customers.repeat_buyers} {at('repeat buyers')}</small></div>
        <div className="kpi"><span>{at('Pioneer')}</span><b>{d.pioneer.linked}</b><small>{at('linked cards')} · {d.pioneer.redemptions} {at('redemptions')}</small></div>
      </div>
      <div className="admin-grid">
        <section className="admin-card wide"><h3>{at('Revenue by day')}</h3><BarChart data={d.byDay} valueKey="revenue" labelKey="day" format={money} /></section>
        <section className="admin-card">
          <h3>{at('Funnel (unique visitors)')}</h3>
          {funnel.map(([l, v]) => <div key={l} className="hbar"><span>{l}</span><span className="hbar-track"><span style={{ width: `${(v / fmax) * 100}%` }} /></span><b>{v}</b></div>)}
          <p className="muted small">{at('Only visitors who accepted anonymous counting are included.')}</p>
        </section>
        <section className="admin-card">
          <h3>{at('Popular products')}</h3>
          <table className="admin-table compact"><thead><tr><th>{at('Product')}</th><th>{at('Units')}</th><th>{at('Revenue')}</th></tr></thead>
            <tbody>{d.popular.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.units}</td><td>{money(p.revenue)}</td></tr>)}{!d.popular.length && <tr><td colSpan="3" className="muted">{at('No sales in this period.')}</td></tr>}</tbody></table>
        </section>
        <section className="admin-card">
          <h3>{at('Orders by status')}</h3>
          <ul className="plain">{d.statuses.map((s) => <li key={s.status}><span>{STATUS_LABEL[s.status]}</span><b>{s.n}</b></li>)}</ul>
          <h3>{at('Frostspire houses')}</h3>
          <ul className="plain">{d.houses.map((h) => <li key={h.name}><span><i className="dot" style={{ background: h.color }} />{h.name}</span><b>{h.members}</b></li>)}</ul>
        </section>
        <section className="admin-card">
          <h3>{at('Low stock')}</h3>
          <ul className="plain">{d.lowStock.map((s) => <li key={s.sku}><span>{s.name} · {s.variant}</span><b className={s.stock === 0 ? 'danger' : ''}>{s.stock}</b></li>)}{!d.lowStock.length && <li className="muted">{at('All shelves are full.')}</li>}</ul>
          <p className="muted small">{at('Subscribers:')} {d.customers.subscribers} · {at('Stardust awarded:')} {d.pioneer.stardust_awarded}</p>
        </section>
      </div>
    </div>
  );
}

/* ───────── Products list ───────── */
function Products() {
  const at = useAt();
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [low, setLow] = useState(false);
  const load = () => api.get(`/admin/products${qs({ q, lowStock: low ? 'true' : '' })}`).then((r) => setItems(r.items));
  useEffect(() => { load(); }, [low]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="admin-section">
      <header className="admin-head">
        <h1>{at('Products')}</h1>
        <div className="row">
          <form onSubmit={(e) => { e.preventDefault(); load(); }}><input className="input" placeholder={at('Search products…')} value={q} onChange={(e) => setQ(e.target.value)} /></form>
          <button className={`chip ${low ? 'on' : ''}`} onClick={() => setLow(!low)}>{at('Low stock')}</button>
          <Link className="btn btn-sm" to="/admin/products/new">{at('+ New product')}</Link>
        </div>
      </header>
      {!items ? <p className="muted">{at('Loading…')}</p> : (
        <div className="table-wrap"><table className="admin-table">
          <thead><tr><th>{at('Name')}</th><th>{at('Category')}</th><th>{at('Price')}</th><th>{at('Sale')}</th><th>{at('Stock')}</th><th>{at('Sold')}</th><th>{at('Status')}</th><th /></tr></thead>
          <tbody>{items.map((p) => (
            <tr key={p.id}>
              <td><Link to={`/admin/products/${p.id}`}><b>{p.name}</b></Link>{p.is_demo && <span className="tag">{at('demo')}</span>}</td>
              <td>{p.category ?? '—'}</td><td>{money(p.price)}</td><td>{p.sale_price != null ? money(p.sale_price) : '—'}</td>
              <td className={p.stock < 10 ? 'danger' : ''}>{p.stock} <small className="muted">/ {p.variant_count} {at('var.')}</small></td><td>{p.sold_count}</td>
              <td>{p.is_active ? at('Active') : at('Hidden')}{p.is_featured ? ' · ★' : ''}{p.is_limited ? ' · Ltd' : ''}</td>
              <td><Link className="link" to={`/admin/products/${p.id}`}>{at('Edit')}</Link></td>
            </tr>))}</tbody>
        </table></div>
      )}
    </div>
  );
}

/* ───────── Orders ───────── */
function Orders() {
  const at = useAt();
  const [filters, setFilters] = useState({ q: '', status: '', payment: '', test: 'false', from: '', to: '' });
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const load = () => api.get(`/admin/orders${qs({ ...filters, page })}`).then(setData);
  useEffect(() => { load(); }, [filters.status, filters.payment, filters.test, page]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => { setPage(1); setFilters({ ...filters, [k]: e.target.value }); };
  return (
    <div className="admin-section">
      <header className="admin-head"><h1>{at('Orders')}</h1></header>
      <form className="admin-filters" onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }}>
        <input className="input" placeholder={at('Number, name, email, phone')} value={filters.q} onChange={set('q')} />
        <select className="input" value={filters.status} onChange={set('status')}><option value="">{at('All statuses')}</option>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className="input" value={filters.payment} onChange={set('payment')}><option value="">{at('All payments')}</option>{Object.entries(PAY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className="input" value={filters.test} onChange={set('test')}><option value="false">{at('Real orders')}</option><option value="true">{at('Test orders')}</option><option value="">{at('All')}</option></select>
        <input className="input" type="date" value={filters.from} onChange={set('from')} aria-label={at('From')} />
        <input className="input" type="date" value={filters.to} onChange={set('to')} aria-label={at('To')} />
        <button className="btn btn-sm">{at('Search')}</button>
      </form>
      {!data ? <p className="muted">{at('Loading…')}</p> : (
        <>
          <div className="table-wrap"><table className="admin-table">
            <thead><tr><th>{at('Order')}</th><th>{at('Date')}</th><th>{at('Customer')}</th><th>{at('Delivery')}</th><th>{at('Items')}</th><th>{at('Total')}</th><th>{at('Payment')}</th><th>{at('Status')}</th></tr></thead>
            <tbody>{data.items.map((o) => (
              <tr key={o.id}>
                <td><Link to={`/admin/orders/${o.number}`}><b>{o.number}</b></Link>{o.is_test && <span className="tag test">{at('TEST')}</span>}</td>
                <td>{new Date(o.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td>{o.customer.name}<br /><small className="muted">{o.customer.phone}</small></td>
                <td>{o.delivery.zoneName}</td><td>{o.items}</td><td>{money(o.total)}</td>
                <td><span className={`pill pay-${o.payment_status}`}>{PAY_LABEL[o.payment_status]}</span><br /><small className="muted">{o.payment_method}</small></td>
                <td><span className={`pill st-${o.status}`}>{STATUS_LABEL[o.status]}</span></td>
              </tr>))}
              {!data.items.length && <tr><td colSpan="8" className="muted">{at('No orders match.')}</td></tr>}
            </tbody>
          </table></div>
          {data.pages > 1 && <div className="row"><button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button><span>{at('Page_')} {page} / {data.pages}</span><button className="btn btn-ghost btn-sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>→</button></div>}
        </>
      )}
    </div>
  );
}

function OrderDetail() {
  const at = useAt();
  const { number } = useParams();
  const { toast } = useApp();
  const [o, setO] = useState(null);
  const [f, setF] = useState({ status: '', note: '', trackingCode: '', deliveryDate: '', markPaid: false });
  const load = () => api.get(`/admin/orders/${number}`).then((r) => { setO(r.order); setF({ status: r.order.status, note: '', trackingCode: r.order.trackingCode ?? '', deliveryDate: r.order.delivery.date ?? '', markPaid: false }); });
  useEffect(() => { load(); }, [number]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!o) return <p className="muted">{at('Loading…')}</p>;
  const save = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/admin/orders/${number}`, { status: f.status !== o.status ? f.status : undefined, note: f.note || undefined, trackingCode: f.trackingCode || null, deliveryDate: f.deliveryDate || null, markPaid: f.markPaid || undefined });
      toast(at('Order updated'), { icon: '✅' });
      load();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };
  return (
    <div className="admin-section">
      <Link className="link" to="/admin/orders">{at('← Orders')}</Link>
      <header className="admin-head"><h1>{o.number} {o.isTest && <span className="tag test">{at('TEST')}</span>}</h1><span className={`pill st-${o.status}`}>{STATUS_LABEL[o.status]}</span></header>
      <div className="admin-grid">
        <section className="admin-card wide">
          <h3>{at('Items')}</h3>
          <table className="admin-table compact"><thead><tr><th>{at('Item')}</th><th>{at('SKU')}</th><th>{at('Qty')}</th><th>{at('Unit')}</th><th>{at('Total')}</th></tr></thead>
            <tbody>{o.items.map((it, i) => <tr key={i}><td>{it.name} <small className="muted">{it.variantName}{it.personalization ? ` · “${it.personalization}”` : ''}</small></td><td>{it.sku}</td><td>{it.quantity}</td><td>{money(it.unitPrice)}</td><td>{money(it.total)}</td></tr>)}</tbody></table>
          <ul className="plain totals-list">
            <li><span>{at('Subtotal')}</span><b>{money(o.subtotal)}</b></li>
            {o.discount > 0 && <li><span>Coupon {o.couponCode}</span><b>−{money(o.discount)}</b></li>}
            {o.pioneerDiscount > 0 && <li><span>{at('Pioneer discount')}</span><b>−{money(o.pioneerDiscount)}</b></li>}
            <li><span>{at('Shipping')}</span><b>{money(o.shipping)}</b></li>
            <li><span>{at('Total')}</span><b>{money(o.total)}</b></li>
          </ul>
        </section>
        <section className="admin-card">
          <h3>{at('Customer')}</h3>
          <p>{o.customer.name}<br /><a className="link" href={`mailto:${o.customer.email}`}>{o.customer.email}</a><br /><a className="link" href={`tel:${o.customer.phone}`}>{o.customer.phone}</a></p>
          <h3>{at('Delivery')}</h3>
          <p>{o.delivery.zoneName}{o.delivery.address ? <><br />{o.delivery.city}, {o.delivery.address}</> : ''}{o.delivery.notes ? <><br /><i>{o.delivery.notes}</i></> : ''}</p>
          {o.giftMessage && <><h3>{at('Gift card')}</h3><p><i>“{o.giftMessage}”</i></p></>}
        </section>
        <section className="admin-card">
          <h3>{at('Payments')}</h3>
          <p>{PAY_LABEL[o.paymentStatus]} · {o.paymentMethod}</p>
          <ul className="plain">{o.payments.map((p, i) => <li key={i}><span>{p.provider}{p.isTest ? ' (test)' : ''} · {date(p.createdAt)}</span><b>{p.status}</b></li>)}</ul>
          <h3>{at('History')}</h3>
          <ul className="timeline">{o.history.map((h, i) => <li key={i}><b>{STATUS_LABEL[h.status] ?? h.status}</b> <small className="muted">{new Date(h.created_at).toLocaleString()}</small>{h.note && <div className="muted small">{h.note}</div>}</li>)}</ul>
        </section>
        <form className="admin-card" onSubmit={save}>
          <h3>{at('Update')}</h3>
          <div className="field"><label>{at('Status')}</label><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div className="field"><label>{at('Note for history')}</label><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
          <div className="field"><label>{at('Tracking code')}</label><input value={f.trackingCode} onChange={(e) => setF({ ...f, trackingCode: e.target.value })} /></div>
          <div className="field"><label>{at('Delivery date')}</label><input type="date" value={f.deliveryDate} onChange={(e) => setF({ ...f, deliveryDate: e.target.value })} /></div>
          {!['paid', 'cod'].includes(o.paymentStatus) && <label className="check"><input type="checkbox" checked={f.markPaid} onChange={(e) => setF({ ...f, markPaid: e.target.checked })} /> {at('Mark payment as received (e.g. bank transfer)')}</label>}
          <button className="btn btn-sm" style={{ marginTop: '1rem' }}>{at('Save changes')}</button>
          <p className="muted small">{at('Cancelling returns reserved stock automatically.')}</p>
        </form>
      </div>
    </div>
  );
}

/* ───────── Customers ───────── */
/** Asks for a reason (stored in the connection log), then disconnects a customer's card. Points are never touched. */
async function unlinkCard(userId, at, toast, done) {
  const reason = window.prompt(at('Why are you disconnecting this card? (stored in the connection log)'));
  if (reason == null) return;
  if (reason.trim().length < 3) { toast(at('Please enter a short reason.'), { tone: 'error' }); return; }
  try { await api.post(`/admin/customers/${userId}/pioneer/unlink`, { reason: reason.trim() }); done(); } catch (e) { toast(e.message, { tone: 'error' }); }
}

/* ───────── Pioneer Card connections (read-only) ───────── */
const EVENT_LABEL = { linked: 'Connected', relinked: 'Connected again', refreshed: 'Re-verified', unlinked: 'Disconnected by customer', admin_unlinked: 'Disconnected by staff', verify_failed: 'Wrong card or code', rejected_taken: 'Refused: card already connected' };
function PioneerLinks() {
  const at = useAt();
  const { toast } = useApp();
  const [d, setD] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('active');
  const load = () => api.get(`/admin/pioneer-links${qs({ q, status })}`).then(setD).catch((e) => toast(e.message, { tone: 'error' }));
  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <p className="muted">{at('Loading…')}</p>;
  return (
    <div className="admin-section">
      <header className="admin-head"><h1>{at('Card connections')}</h1>
        <div className="row">
          <form onSubmit={(e) => { e.preventDefault(); load(); }}><input className="input" placeholder={at('Customer, cardholder, last 4 digits')} value={q} onChange={(e) => setQ(e.target.value)} /></form>
          {['active', 'unlinked', ''].map((x) => <button key={x || 'all'} className={`chip ${status === x ? 'on' : ''}`} onClick={() => setStatus(x)}>{at(x === 'active' ? 'Connected' : x === 'unlinked' ? 'Disconnected' : 'All')}</button>)}
        </div>
      </header>
      <div className="admin-grid">
        <section className="admin-card">
          <h3>{at('Connection to the Pioneer system')}</h3>
          <ul className="plain">
            <li><span>{at('Status')}</span><b className={d.connection.available ? 'ok' : 'danger'}>{d.connection.available ? at('Connected') : at('Not configured')}</b></li>
            <li><span>{at('Pioneer system')}</span><b>{d.connection.baseUrl ?? '—'}</b></li>
            <li><span>{at('Connected cards')}</span><b>{d.stats.active}</b></li>
            <li><span>{at('Disconnected')}</span><b>{d.stats.disconnected}</b></li>
          </ul>
        </section>
        <section className="admin-card">
          <h3>{at('How points work')}</h3>
          <p className="muted small">{at('Card owners, points and rewards live in the Pioneer system. This store only reads them after the customer verifies the card with its 3-digit code, so balances cannot be edited here. Adjust points in the Pioneer admin, where every change is recorded.')}</p>
        </section>
      </div>
      <div className="table-wrap"><table className="admin-table">
        <thead><tr><th>{at('Customer')}</th><th>{at('Card')}</th><th>{at('Cardholder')}</th><th>{at('Status')}</th><th>{at('Connected on')}</th><th>{at('Last known points')}</th><th /></tr></thead>
        <tbody>{d.links.length === 0 ? <tr><td colSpan={7} className="muted">{at('No card connections yet.')}</td></tr> : d.links.map((l) => (
          <tr key={l.id}>
            <td><Link to={`/admin/customers/${l.user_id}`}><b>{l.customer}</b></Link><br /><small className="muted">{l.email}</small></td>
            <td dir="ltr">{l.card_masked}</td><td>{l.holder_name ?? '—'}</td>
            <td>{l.status === 'active' ? at('Connected') : at('Disconnected')}</td>
            <td>{date(l.linked_at)}</td>
            <td>{l.last_balance ?? '—'}{l.balance_synced_at ? <small className="muted"> · {date(l.balance_synced_at)}</small> : null}</td>
            <td>{l.status === 'active' && <button className="btn btn-ghost btn-sm" onClick={() => unlinkCard(l.user_id, at, toast, load)}>{at('Disconnect')}</button>}</td>
          </tr>))}</tbody>
      </table></div>
      <section className="admin-card wide" style={{ marginTop: '1.5rem' }}>
        <h3>{at('Recent activity')}</h3>
        {d.events.length === 0 ? <p className="muted">{at('No activity yet.')}</p> : (
          <table className="admin-table compact"><tbody>{d.events.map((e, i) => (
            <tr key={i}><td>{new Date(e.created_at).toLocaleString()}</td><td>{at(EVENT_LABEL[e.event] ?? e.event)}</td><td dir="ltr">{e.card_masked ?? ''}</td><td>{e.email ?? ''}</td><td className="muted">{e.actor ? `${at('by')} ${e.actor}` : ''}{e.detail ? ` · ${e.detail}` : ''}</td></tr>))}</tbody></table>
        )}
      </section>
    </div>
  );
}

function Customers() {
  const at = useAt();
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [pioneer, setPioneer] = useState(false);
  const load = () => api.get(`/admin/customers${qs({ q, pioneer: pioneer ? 'true' : '' })}`).then((r) => setItems(r.items));
  useEffect(() => { load(); }, [pioneer]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="admin-section">
      <header className="admin-head"><h1>{at('Customers')}</h1>
        <div className="row"><form onSubmit={(e) => { e.preventDefault(); load(); }}><input className="input" placeholder={at('Name, email, phone')} value={q} onChange={(e) => setQ(e.target.value)} /></form>
          <button className={`chip ${pioneer ? 'on' : ''}`} onClick={() => setPioneer(!pioneer)}>{at('Pioneer members')}</button></div>
      </header>
      {!items ? <p className="muted">{at('Loading…')}</p> : (
        <div className="table-wrap"><table className="admin-table">
          <thead><tr><th>{at('Name')}</th><th>{at('Email')}</th><th>{at('Joined')}</th><th>{at('Orders')}</th><th>{at('Spent')}</th><th>{at('House')}</th><th>{at('Pioneer')}</th><th>{at('Status')}</th></tr></thead>
          <tbody>{items.map((u) => (
            <tr key={u.id}>
              <td><Link to={`/admin/customers/${u.id}`}><b>{u.name}</b></Link>{u.role === 'admin' && <span className="tag">{at('admin')}</span>}{u.is_demo && <span className="tag">{at('demo')}</span>}</td>
              <td>{u.email}</td><td>{date(u.created_at)}</td><td>{u.orders}</td><td>{money(u.spent)}</td><td>{u.house ?? '—'}</td>
              <td dir="ltr">{u.pioneer_status === 'active' ? u.card_masked : '—'}</td>
              <td>{u.is_active ? at('Active') : at('Disabled')}</td>
            </tr>))}</tbody>
        </table></div>
      )}
    </div>
  );
}

function CustomerDetail() {
  const at = useAt();
  const { id } = useParams();
  const { toast, user: me } = useApp();
  const [u, setU] = useState(null);
  const load = () => api.get(`/admin/customers/${id}`).then((r) => setU(r.item));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!u) return <p className="muted">{at('Loading…')}</p>;
  const patch = async (body, msg) => {
    if (!window.confirm(msg)) return;
    try { await api.patch(`/admin/customers/${id}`, body); load(); } catch (e) { toast(e.message, { tone: 'error' }); }
  };
  return (
    <div className="admin-section">
      <Link className="link" to="/admin/customers">{at('← Customers')}</Link>
      <header className="admin-head"><h1>{u.name}</h1>
        {u.id !== me.id && <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={() => patch({ is_active: !u.is_active }, u.is_active ? at('Disable this account and sign it out everywhere?') : at('Re-enable this account?'))}>{u.is_active ? at('Disable account') : at('Enable account')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => patch({ role: u.role === 'admin' ? 'customer' : 'admin' }, u.role === 'admin' ? at('Remove admin rights?') : at('Grant full admin rights to this user?'))}>{u.role === 'admin' ? at('Remove admin') : at('Make admin')}</button>
        </div>}
      </header>
      <div className="admin-grid">
        <section className="admin-card">
          <h3>{at('Profile')}</h3>
          <ul className="plain"><li><span>{at('Email')}</span><b>{u.email}</b></li><li><span>{at('Phone')}</span><b>{u.phone ?? '—'}</b></li><li><span>{at('Joined')}</span><b>{date(u.created_at)}</b></li><li><span>{at('Last login')}</span><b>{date(u.last_login_at)}</b></li>
            <li><span>{at('House')}</span><b>{u.house ?? '—'}</b></li><li><span>{at('Atmosphere')}</span><b>{u.atmosphere ?? '—'}</b></li><li><span>{at('Newsletter')}</span><b>{yes(u.marketing_consent)}</b></li><li><span>{at('Personalisation')}</span><b>{yes(u.personalization_consent)}</b></li></ul>
        </section>
        <section className="admin-card">
          <h3>{at('Magical Pioneer Card')}</h3>
          {u.pioneer ? <><ul className="plain">
              <li><span>{at('Card')}</span><b dir="ltr">{u.pioneer.card_masked}</b></li>
              <li><span>{at('Cardholder')}</span><b>{u.pioneer.holder_name ?? '—'}</b></li>
              <li><span>{at('Status')}</span><b>{u.pioneer.status === 'active' ? at('Connected') : at('Disconnected')}</b></li>
              <li><span>{at('Connected on')}</span><b>{date(u.pioneer.linked_at)}</b></li>
              <li><span>{at('Last known points')}</span><b>{u.pioneer.last_balance ?? '—'}{u.pioneer.balance_synced_at ? ` · ${date(u.pioneer.balance_synced_at)}` : ''}</b></li></ul>
            <p className="muted small">{at('Points are read from the Pioneer system and can only be changed in the Pioneer admin.')}</p>
            {u.pioneer.status === 'active' && <button className="btn btn-ghost btn-sm" onClick={() => unlinkCard(id, at, toast, load)}>{at('Disconnect card')}</button>}</> : <p className="muted">{at('No card connected.')}</p>}
        </section>
        <section className="admin-card wide">
          <h3>{at('Orders')}</h3>
          <table className="admin-table compact"><thead><tr><th>{at('Order')}</th><th>{at('Date')}</th><th>{at('Status')}</th><th>{at('Payment')}</th><th>{at('Total')}</th></tr></thead>
            <tbody>{u.orders.map((o) => <tr key={o.number}><td><Link className="link" to={`/admin/orders/${o.number}`}>{o.number}</Link>{o.is_test && <span className="tag test">{at('TEST')}</span>}</td><td>{date(o.created_at)}</td><td>{STATUS_LABEL[o.status]}</td><td>{PAY_LABEL[o.payment_status]}</td><td>{money(o.total)}</td></tr>)}</tbody></table>
        </section>
        <section className="admin-card wide">
          <h3>{at('Rewards')}</h3>
          <ul className="plain">{u.rewards.map((r) => <li key={r.id}><span>{date(r.createdAt)} · {r.title}{r.couponCode ? ` · ${r.couponCode}` : ''}</span><b>{r.points ? `+${r.points} (${r.pioneerSyncStatus})` : r.kind}</b></li>)}</ul>
        </section>
      </div>
    </div>
  );
}

/* ───────── Entity configs for generic CRUD ───────── */
const KINDS_COUPON = ['percent', 'fixed', 'free_shipping'];
const CONFIGS = {
  coupons: { title: 'Discount codes', endpoint: 'coupons', description: 'Percent and fixed discounts are capped at the subtotal; free_shipping removes delivery cost.',
    fields: [{ name: 'code', label: 'Code' }, { name: 'description', label: 'Description', nullable: true }, { name: 'type', label: 'Type', type: 'select', options: KINDS_COUPON, default: 'percent' }, { name: 'value', label: 'Value (% or ֏)', type: 'number' }, { name: 'min_subtotal', label: 'Minimum subtotal ֏', type: 'number' }, { name: 'max_discount', label: 'Max discount ֏', type: 'number', nullable: true, default: '' }, { name: 'max_uses', label: 'Max total uses', type: 'number', nullable: true, default: '' }, { name: 'per_user_limit', label: 'Uses per customer', type: 'number', default: 1 }, { name: 'starts_at', label: 'Starts', type: 'datetime' }, { name: 'ends_at', label: 'Ends', type: 'datetime' }, { name: 'pioneer_only', label: 'Pioneer members only', type: 'bool', default: false }, { name: 'is_active', label: 'Active', type: 'bool' }],
    columns: [{ key: 'code', label: 'Code' }, { key: 'type', label: 'Type' }, { key: 'value', label: 'Value' }, { key: 'used_count', label: 'Used' }, { key: 'source', label: 'Source' }, { key: 'ends_at', label: 'Ends', render: (r) => date(r.ends_at) }, { key: 'is_active', label: 'Active', render: (r) => yes(r.is_active) }] },
  campaigns: { title: 'Campaigns & seasonal offers', endpoint: 'campaigns', description: 'Shown as wax-sealed letters on the homepage while active.',
    fields: [{ name: 'name', label: 'Internal name' }, { name: 'headline', label: 'Headline' }, { name: 'body', label: 'Body', type: 'textarea', nullable: true }, { name: 'coupon_code', label: 'Linked code', nullable: true }, { name: 'art', label: 'Art', default: 'gift' }, { name: 'color', label: 'Seal colour', type: 'color', default: '#c8102e' }, { name: 'starts_at', label: 'Starts', type: 'datetime' }, { name: 'ends_at', label: 'Ends', type: 'datetime' }, { name: 'pioneer_only', label: 'Pioneer members only', type: 'bool', default: false }, { name: 'is_active', label: 'Active', type: 'bool' }],
    columns: [{ key: 'name', label: 'Name' }, { key: 'headline', label: 'Headline' }, { key: 'pioneer_only', label: 'Pioneer', render: (r) => yes(r.pioneer_only) }, { key: 'ends_at', label: 'Ends', render: (r) => date(r.ends_at) }, { key: 'is_active', label: 'Active', render: (r) => yes(r.is_active) }] },
  banners: { title: 'Banners', endpoint: 'banners', description: 'Placement "home_ribbon" scrolls under the homepage hero.',
    fields: [{ name: 'placement', label: 'Placement', default: 'home_ribbon' }, { name: 'title', label: 'Title' }, { name: 'subtitle', label: 'Subtitle', nullable: true }, { name: 'cta_label', label: 'Button label', nullable: true }, { name: 'cta_link', label: 'Link (/path or https://)', nullable: true }, { name: 'image_url', label: 'Image URL', nullable: true }, { name: 'art', label: 'Art', nullable: true }, { name: 'sort', label: 'Order', type: 'number' }, { name: 'is_active', label: 'Active', type: 'bool' }],
    columns: [{ key: 'placement', label: 'Placement' }, { key: 'title', label: 'Title' }, { key: 'cta_link', label: 'Link' }, { key: 'is_active', label: 'Active', render: (r) => yes(r.is_active) }] },
  'pioneer-offers': { title: 'Member offers', endpoint: 'pioneer-offers', description: 'Shown to Pioneer members on the Pioneer Card page. Points cannot be spent in the store: the Pioneer system offers no way to deduct points, so Pioneer rewards are claimed in the Pioneer portal.',
    fields: [{ name: 'title', label: 'Title' }, { name: 'description', label: 'Description', type: 'textarea', nullable: true }, { name: 'kind', label: 'Kind', type: 'select', options: ['redeem_gift', 'discount', 'exclusive_product'], default: 'redeem_gift' }, { name: 'points_cost', label: 'Points cost', type: 'number', nullable: true }, { name: 'discount_percent', label: 'Discount %', type: 'number', nullable: true, default: '' }, { name: 'product_id', label: 'Product ID (uuid)', nullable: true }, { name: 'stock', label: 'Stock (empty = unlimited)', type: 'number', nullable: true, default: '' }, { name: 'starts_at', label: 'Starts', type: 'datetime' }, { name: 'ends_at', label: 'Ends', type: 'datetime' }, { name: 'is_active', label: 'Active', type: 'bool' }],
    columns: [{ key: 'title', label: 'Title' }, { key: 'kind', label: 'Kind' }, { key: 'points_cost', label: 'Points' }, { key: 'stock', label: 'Stock' }, { key: 'is_active', label: 'Active', render: (r) => yes(r.is_active) }] },
  advent: { title: 'Advent calendar', endpoint: 'advent', pk: 'id', description: 'payload by kind — coupon: {type,value,min_subtotal,valid_days} · points: {points} · product: {product_slug} · gift: {text, coupon:{…}} · minigame: {game} · story: {story} · challenge: {text}',
    fields: [{ name: 'year', label: 'Year', type: 'number', default: new Date().getFullYear() }, { name: 'day', label: 'Day (1–24)', type: 'number', default: 1 }, { name: 'title', label: 'Title' }, { name: 'teaser', label: 'Teaser (shown before opening)', nullable: true }, { name: 'kind', label: 'Kind', type: 'select', options: ['coupon', 'points', 'product', 'gift', 'minigame', 'challenge', 'story'], default: 'story' }, { name: 'art', label: 'Art', default: 'star' }, { name: 'payload', label: 'Payload (JSON)', type: 'json' }],
    columns: [{ key: 'year', label: 'Year' }, { key: 'day', label: 'Day' }, { key: 'title', label: 'Title' }, { key: 'kind', label: 'Kind' }, { key: 'payload', label: 'Payload', render: (r) => <code>{JSON.stringify(r.payload).slice(0, 60)}</code> }] },
  challenges: { title: 'Daily challenges', endpoint: 'challenges', description: 'Kinds are verified on the server. target: play_game {game} · wishlist_count {count} · quiz_score {min} · find_hidden {count}',
    fields: [{ name: 'date', label: 'Date', type: 'date' }, { name: 'title', label: 'Title' }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'kind', label: 'Kind', type: 'select', options: ['open_advent', 'play_game', 'wishlist_count', 'quiz_score', 'find_hidden', 'visit_academy'], default: 'open_advent' }, { name: 'target', label: 'Target (JSON)', type: 'json', rows: 2 }, { name: 'reward_points', label: 'Reward Stardust', type: 'number', default: 10 }, { name: 'reward_coupon', label: 'Reward coupon (JSON, optional)', type: 'json', nullable: true, rows: 3, default: '' }, { name: 'is_active', label: 'Active', type: 'bool' }],
    columns: [{ key: 'date', label: 'Date', render: (r) => date(r.date) }, { key: 'title', label: 'Title' }, { key: 'kind', label: 'Kind' }, { key: 'reward_points', label: 'Stardust' }, { key: 'is_active', label: 'Active', render: (r) => yes(r.is_active) }] },
  games: { title: 'Mini-games', endpoint: 'games', pk: 'key', canCreate: false, description: 'Enable, rename or reorder games. Scoring limits live in Reward rules.',
    fields: [{ name: 'key', label: 'Key', readOnlyOnEdit: true }, { name: 'title', label: 'Title' }, { name: 'description', label: 'Description', type: 'textarea', nullable: true }, { name: 'sort', label: 'Order', type: 'number' }, { name: 'config', label: 'Config (JSON)', type: 'json', rows: 3 }, { name: 'is_active', label: 'Active', type: 'bool' }],
    columns: [{ key: 'key', label: 'Key' }, { key: 'title', label: 'Title' }, { key: 'sort', label: 'Order' }, { key: 'is_active', label: 'Active', render: (r) => yes(r.is_active) }] },
  'reward-rules': { title: 'Reward rules', endpoint: 'reward-rules', pk: 'key', description: 'Server-side limits used to validate games and grant Stardust (e.g. plays_per_day, max_points_per_day, max_score_per_second).',
    fields: [{ name: 'key', label: 'Key', readOnlyOnEdit: true }, { name: 'config', label: 'Config (JSON)', type: 'json', rows: 10 }, { name: 'is_active', label: 'Active', type: 'bool' }],
    columns: [{ key: 'key', label: 'Key' }, { key: 'config', label: 'Config', render: (r) => <code>{JSON.stringify(r.config).slice(0, 90)}</code> }, { key: 'is_active', label: 'Active', render: (r) => yes(r.is_active) }] },
  quiz: { title: 'Quiz questions', endpoint: 'quiz',
    fields: [{ name: 'question', label: 'Question', wide: true }, { name: 'options', label: 'Options (JSON array)', type: 'json', rows: 4, default: '["", "", "", ""]' }, { name: 'answer_index', label: 'Correct option index (0-based)', type: 'number' }, { name: 'fun_fact', label: 'Fun fact', type: 'textarea', nullable: true }, { name: 'is_active', label: 'Active', type: 'bool' }],
    columns: [{ key: 'question', label: 'Question' }, { key: 'answer_index', label: 'Answer', render: (r) => r.options?.[r.answer_index] }, { key: 'is_active', label: 'Active', render: (r) => yes(r.is_active) }] },
  wheel: { title: 'Christmas wheel', endpoint: 'wheel', description: 'Weights are relative chances. payload: points {points} · coupon {type,value,min_subtotal,valid_days} · message {text}',
    fields: [{ name: 'label', label: 'Label' }, { name: 'kind', label: 'Kind', type: 'select', options: ['points', 'coupon', 'message'], default: 'points' }, { name: 'payload', label: 'Payload (JSON)', type: 'json', rows: 3 }, { name: 'weight', label: 'Weight', type: 'number', default: 10 }, { name: 'color', label: 'Colour', type: 'color' }, { name: 'is_active', label: 'Active', type: 'bool' }],
    columns: [{ key: 'label', label: 'Label' }, { key: 'kind', label: 'Kind' }, { key: 'weight', label: 'Weight' }, { key: 'is_active', label: 'Active', render: (r) => yes(r.is_active) }] },
  mystery: { title: 'Mystery box rewards', endpoint: 'mystery',
    fields: [{ name: 'label', label: 'Label' }, { name: 'kind', label: 'Kind', type: 'select', options: ['points', 'coupon', 'message'], default: 'points' }, { name: 'payload', label: 'Payload (JSON)', type: 'json', rows: 3 }, { name: 'weight', label: 'Weight', type: 'number', default: 10 }, { name: 'rarity', label: 'Rarity', type: 'select', options: ['common', 'uncommon', 'rare', 'legendary'], default: 'common' }, { name: 'is_active', label: 'Active', type: 'bool' }],
    columns: [{ key: 'label', label: 'Label' }, { key: 'kind', label: 'Kind' }, { key: 'rarity', label: 'Rarity' }, { key: 'weight', label: 'Weight' }, { key: 'is_active', label: 'Active', render: (r) => yes(r.is_active) }] },
  'hidden-objects': { title: 'Hidden wonders', endpoint: 'hidden-objects', pk: 'key', description: 'Objects are placed in page code by key; here you can rename, re-hint, re-value or disable them.',
    fields: [{ name: 'key', label: 'Key', readOnlyOnEdit: true }, { name: 'name', label: 'Name' }, { name: 'hint', label: 'Hint' }, { name: 'location', label: 'Page path' }, { name: 'points', label: 'Stardust', type: 'number' }, { name: 'is_active', label: 'Active', type: 'bool' }],
    columns: [{ key: 'key', label: 'Key' }, { key: 'name', label: 'Name' }, { key: 'location', label: 'Page' }, { key: 'points', label: 'Stardust' }, { key: 'is_active', label: 'Active', render: (r) => yes(r.is_active) }] },
  events: { title: 'Christmas events', endpoint: 'events',
    fields: [{ name: 'title', label: 'Title' }, { name: 'description', label: 'Description', type: 'textarea', nullable: true }, { name: 'location', label: 'Location', nullable: true }, { name: 'starts_at', label: 'Starts', type: 'datetime' }, { name: 'ends_at', label: 'Ends', type: 'datetime' }, { name: 'is_active', label: 'Active', type: 'bool' }],
    columns: [{ key: 'title', label: 'Title' }, { key: 'starts_at', label: 'Starts', render: (r) => new Date(r.starts_at).toLocaleString() }, { key: 'location', label: 'Location' }, { key: 'is_active', label: 'Active', render: (r) => yes(r.is_active) }] },
  categories: { title: 'Categories', endpoint: 'categories',
    fields: [{ name: 'slug', label: 'Slug' }, { name: 'name', label: 'Name' }, { name: 'tagline', label: 'Tagline', nullable: true }, { name: 'description', label: 'Description', type: 'textarea', nullable: true }, { name: 'art', label: 'Art type', default: 'gift' }, { name: 'color', label: 'Colour', type: 'color' }, { name: 'sort', label: 'Order', type: 'number' }, { name: 'is_active', label: 'Active', type: 'bool' }],
    columns: [{ key: 'name', label: 'Name' }, { key: 'slug', label: 'Slug' }, { key: 'sort', label: 'Order' }, { key: 'is_active', label: 'Active', render: (r) => yes(r.is_active) }] },
  'shipping-zones': { title: 'Delivery options', endpoint: 'shipping-zones',
    fields: [{ name: 'code', label: 'Code' }, { name: 'name', label: 'Name' }, { name: 'description', label: 'Description', nullable: true }, { name: 'price', label: 'Price ֏', type: 'number' }, { name: 'free_over', label: 'Free over ֏', type: 'number', nullable: true, default: '' }, { name: 'eta', label: 'ETA', nullable: true }, { name: 'sort', label: 'Order', type: 'number' }, { name: 'requires_address', label: 'Requires address', type: 'bool' }, { name: 'is_active', label: 'Active', type: 'bool' }],
    columns: [{ key: 'name', label: 'Name' }, { key: 'price', label: 'Price', render: (r) => money(r.price) }, { key: 'free_over', label: 'Free over', render: (r) => (r.free_over ? money(r.free_over) : '—') }, { key: 'is_active', label: 'Active', render: (r) => yes(r.is_active) }] },
  content: { title: 'Homepage content', endpoint: 'content', pk: 'key', description: 'Texts for the homepage story: home.hero, home.chapters, home.newsletter, site.footer.',
    fields: [{ name: 'key', label: 'Key', readOnlyOnEdit: true }, { name: 'data', label: 'Content (JSON)', type: 'json', rows: 16 }],
    columns: [{ key: 'key', label: 'Key' }, { key: 'data', label: 'Content', render: (r) => <code>{JSON.stringify(r.data).slice(0, 100)}…</code> }] },
  reviews: { title: 'Reviews', endpoint: 'reviews', description: 'New customer reviews wait here until approved.',
    fields: [{ name: 'author_name', label: 'Author' }, { name: 'city', label: 'City', nullable: true }, { name: 'rating', label: 'Rating', type: 'number', default: 5 }, { name: 'body', label: 'Text', type: 'textarea' }, { name: 'is_approved', label: 'Approved', type: 'bool', default: false }],
    columns: [{ key: 'author_name', label: 'Author' }, { key: 'rating', label: '★' }, { key: 'body', label: 'Text', render: (r) => r.body.slice(0, 80) }, { key: 'is_approved', label: 'Approved', render: (r) => (r.is_approved ? '✓' : <b className="danger">{at('pending')}</b>) }] },
  newsletter: { title: 'Newsletter subscribers', endpoint: 'newsletter', pk: 'email', canCreate: false,
    fields: [{ name: 'email', label: 'Email', readOnlyOnEdit: true }, { name: 'name', label: 'Name', nullable: true }],
    columns: [{ key: 'email', label: 'Email' }, { key: 'name', label: 'Name' }, { key: 'consent_at', label: 'Since', render: (r) => date(r.consent_at) }, { key: 'unsubscribed_at', label: 'Unsubscribed', render: (r) => date(r.unsubscribed_at) }] },
};

// Grouped by the job an admin is doing; the seasonal games are tucked into one collapsible group.
const NAV = [
  ['Sales', [['', 'Dashboard'], ['orders', 'Orders'], ['customers', 'Customers']]],
  ['Catalog', [['products', 'Products'], ['categories', 'Categories'], ['reviews', 'Reviews']]],
  ['Promotions', [['coupons', 'Discount codes'], ['campaigns', 'Campaigns'], ['banners', 'Banners']]],
  ['Pioneer Card', [['pioneer-links', 'Card connections'], ['pioneer-offers', 'Member offers']]],
  ['Website', [['content', 'Homepage texts'], ['events', 'Events'], ['newsletter', 'Newsletter']]],
  ['Store settings', [['shipping-zones', 'Delivery']]],
  ['Christmas fun', [['advent', 'Advent calendar'], ['challenges', 'Daily challenges'], ['games', 'Mini-games'], ['reward-rules', 'Reward rules'], ['quiz', 'Quiz'], ['wheel', 'Wheel'], ['mystery', 'Mystery box'], ['hidden-objects', 'Hidden wonders']], { collapsible: true }],
];

function CrudRoute() {
  const at = useAt();
  const { entity } = useParams();
  const cfg = CONFIGS[entity];
  if (!cfg) return <p>{at('Unknown section.')}</p>;
  if (['reward-rules', 'reviews', 'newsletter'].includes(entity)) return <Crud key={entity} {...cfg} i18n={false} />;
  return <Crud key={entity} {...cfg} />;
}

export default function AdminApp() {
  const at = useAt();
  const { user, authReady } = useApp();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { document.title = `${at('✦ Elves’ Office').replace('✦ ', '')} · Christmas Market`; }, [at]);
  if (!authReady) return <p className="muted" style={{ padding: 40 }}>{at('Loading…')}</p>;
  if (!user) return <Navigate to="/login?next=/admin" replace />;
  if (user.role !== 'admin') return <div className="admin-denied"><h1>{at('The Elves’ Office is staff-only')}</h1><Link className="link" to="/">{at('Back to the village')}</Link></div>;
  return (
    <div className={`admin ${open ? 'nav-open' : ''}`}>
      <aside className="admin-nav" onClick={() => setOpen(false)}>
        <Link to="/admin" className="admin-brand">{at('✦ Elves’ Office')}</Link>
        {NAV.map(([group, links, opts]) => {
          const items = links.map(([to, label]) => <NavLink key={to} end to={`/admin${to ? `/${to}` : ''}`}>{at(label)}</NavLink>);
          return opts?.collapsible ? (
            <details key={group} className="admin-nav-group" open={links.some(([to]) => location.pathname === `/admin/${to}`)}>
              <summary>{at(group)}</summary>{items}
            </details>
          ) : (
            <div key={group} className="admin-nav-group"><span>{at(group)}</span>{items}</div>
          );
        })}
        <LangSwitch />
        <Link to="/" className="admin-back">{at('← Back to the store')}</Link>
      </aside>
      <button className="admin-burger" onClick={() => setOpen(!open)} aria-label={at('Menu')}>☰</button>
      <main className="admin-main">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:id" element={<ProductEditor />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:number" element={<OrderDetail />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="pioneer-links" element={<PioneerLinks />} />
          <Route path=":entity" element={<CrudRoute />} />
        </Routes>
      </main>
    </div>
  );
}
