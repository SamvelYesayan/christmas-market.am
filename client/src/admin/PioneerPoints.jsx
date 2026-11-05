// Admin: Pioneer points the store asked Magical to credit (game rewards) or debit (gift redemptions).
// Staff can ask the store to check an unconfirmed operation again (same idempotency key) and mark physical gifts
// as handed over. Nothing here can set an operation to succeeded or change points — Magical decides that.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { useAt } from './i18n.js';

const STATUS = { pending: 'Waiting to send', processing: 'Sending', needs_reconciliation: 'Unconfirmed — checking again', succeeded: 'Confirmed by Magical', failed: 'Refused by Magical' };
const when = (v) => (v ? new Date(v).toLocaleString() : '—');

export default function PioneerPoints({ health }) {
  const at = useAt();
  const { toast } = useApp();
  const [filter, setFilter] = useState('open');
  const [ops, setOps] = useState(null);
  const [gifts, setGifts] = useState(null);
  const load = () => {
    api.get(`/admin/pioneer-links/operations${qs({ status: filter })}`).then(setOps).catch((e) => toast(e.message, { tone: 'error' }));
    api.get('/admin/pioneer-links/redemptions').then((r) => setGifts(r.items)).catch(() => {});
  };
  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (fn, msg) => { try { await fn(); if (msg) toast(msg); load(); } catch (e) { toast(e.message, { tone: 'error' }); } };
  const awaiting = (gifts ?? []).filter((g) => g.fulfilment === 'awaiting_handover');
  return (
    <>
      <section className="admin-card wide" style={{ marginTop: '1.5rem' }}>
        <div className="row between"><h3>{at('Pioneer points')}</h3>
          <div className="row">
            {[['open', 'Needs attention'], ['succeeded', 'Confirmed'], ['failed', 'Refused'], ['all', 'All']].map(([k, l]) => (
              <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{at(l)}</button>
            ))}
          </div>
        </div>
        <ul className="plain">
          <li><span>{at('Points on this server')}</span><b className={health?.points?.allowed ? 'ok' : 'danger'}>{at({
            production: 'Allowed (production)', local_magical: 'Allowed (local Magical)', non_production_remote: 'Blocked: development server with a remote Magical',
            switched_off: 'Blocked: switched off (MAGICAL_POINTS=off)', not_configured: 'Blocked: not configured',
          }[health?.points?.reason] ?? '—')}</b></li>
          <li><span>{at('Game rewards → card (points:credit)')}</span><b className={health?.canCredit ? 'ok' : 'danger'}>{health?.canCredit ? at('Granted by Magical') : at('Not granted yet')}</b></li>
          <li><span>{at('Gift redemptions (points:debit)')}</span><b className={health?.canDebit ? 'ok' : 'danger'}>{health?.canDebit ? at('Granted by Magical') : at('Not granted yet')}</b></li>
          {ops && <li><span>{at('Waiting · unconfirmed · confirmed · refused')}</span><b>{ops.counts.waiting} · {ops.counts.unknown} · {ops.counts.succeeded} · {ops.counts.failed}</b></li>}
        </ul>
        <p className="muted small">{at('Magical holds the only balance. Unconfirmed operations are checked again automatically every minute with the same idempotency key, so they can never be applied twice.')}</p>
        {!ops ? <p className="muted">{at('Loading…')}</p> : ops.items.length === 0 ? <p className="muted">{at('Nothing here.')}</p> : (
          <div className="table-wrap"><table className="admin-table compact">
            <thead><tr><th>{at('Date')}</th><th>{at('Customer')}</th><th>{at('Type')}</th><th>{at('Points')}</th><th>{at('Status')}</th><th>{at('Magical transaction')}</th><th /></tr></thead>
            <tbody>{ops.items.map((o) => (
              <tr key={o.id}>
                <td>{when(o.created_at)}</td>
                <td>{o.user_id ? <Link to={`/admin/customers/${o.user_id}`}>{o.name}</Link> : '—'}<br /><small className="muted">{o.email}</small></td>
                <td>{at(o.kind === 'credit' ? 'Game reward' : 'Gift redemption')}<br /><small className="muted">{o.title}</small></td>
                <td>{o.kind === 'credit' ? '+' : '−'}{o.points}</td>
                <td>{at(STATUS[o.status] ?? o.status)}{o.last_error_code ? <><br /><small className="muted">{o.last_error_code}</small></> : null}<br /><small className="muted">{at('attempts')}: {o.attempts}</small></td>
                <td dir="ltr">{o.magical_transaction_id ?? '—'}{o.balance_after != null ? <small className="muted"> · {at('balance after')} {o.balance_after}</small> : null}</td>
                <td>{['pending', 'processing', 'needs_reconciliation'].includes(o.status) && (
                  <button className="btn btn-ghost btn-sm" onClick={() => act(() => api.post(`/admin/pioneer-links/operations/${o.id}/retry`), at('Checked with Magical.'))}>{at('Check again')}</button>)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </section>
      <section className="admin-card wide" style={{ marginTop: '1.5rem' }}>
        <h3>{at('Gifts to hand over')}</h3>
        {!gifts ? <p className="muted">{at('Loading…')}</p> : awaiting.length === 0 ? <p className="muted">{at('No gifts are waiting to be handed over.')}</p> : (
          <table className="admin-table compact"><tbody>{awaiting.map((g) => (
            <tr key={g.id}>
              <td>{when(g.completed_at)}</td><td><Link to={`/admin/customers/${g.user_id}`}>{g.name}</Link><br /><small className="muted">{g.email}</small></td>
              <td>{g.title}</td><td>−{g.points}</td>
              <td><button className="btn btn-sm" onClick={() => act(() => api.post(`/admin/pioneer-links/redemptions/${g.id}/handed-over`), at('Marked as handed over.'))}>{at('Mark handed over')}</button></td>
            </tr>))}</tbody></table>
        )}
      </section>
    </>
  );
}
