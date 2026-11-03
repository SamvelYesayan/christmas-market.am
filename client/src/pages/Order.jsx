// Order confirmation and tracking (by number + email for guests).
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, qs } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { money, storage } from '../lib.js';
import { ProductVisual } from '../art/Art.jsx';
import { Loader } from '../components/Common.jsx';
import { celebrate } from '../effects/celebrate.js';
import { translate, useI18n } from '../i18n/index.jsx';

const TRACK = ['pending_payment', 'confirmed', 'processing', 'shipped', 'delivered'];
export const STATUSES = [...TRACK, 'cancelled', 'refunded'];
export const PAY_STATUSES = ['unpaid', 'pending', 'paid', 'failed', 'refunded', 'cod'];
export const statusLabel = (s) => translate(`order.st_${s}`);
export const payLabel = (s) => translate(`order.pay_${s}`);

function TrackForm() {
  const { t } = useI18n();
  const [number, setNumber] = useState('');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const r = await api.get(`/orders/${encodeURIComponent(number.trim().toUpperCase())}${qs({ email: email.trim() })}`);
      setOrder(r.order);
    } catch (err) {
      setError(err);
    }
  };
  if (order) return <OrderView order={order} />;
  return (
    <div className="wrap narrow">
      <header className="page-head"><span className="eyebrow">{t('order.where')}</span><h1>{t('order.trackA')} <em>{t('order.trackB')}</em></h1></header>
      <form className="panel pad" onSubmit={submit}>
        {error && <div className="form-error">{error.message}</div>}
        <div className="grid-2">
          <div className="field"><label htmlFor="on">{t('order.number')}</label><input id="on" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="XM-2601001" required /></div>
          <div className="field"><label htmlFor="oe">{t('order.email')}</label><input id="oe" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        </div>
        <button className="btn">{t('order.find')}</button>
      </form>
    </div>
  );
}

function OrderView({ order, fresh }) {
  const { toast } = useApp();
  const { t, date } = useI18n();
  const [paying, setPaying] = useState(false);
  const cancelled = ['cancelled', 'refunded'].includes(order.status);
  const idx = TRACK.indexOf(order.status);
  const retry = async () => {
    setPaying(true);
    try {
      const key = storage.get(`mc.order.${order.number}`);
      const { payment } = await api.post(`/orders/${order.number}/pay`, { key, email: order.customer.email });
      if (payment.url) window.location.assign(payment.url);
    } catch (e) {
      toast(e.message, { tone: 'error' });
    } finally {
      setPaying(false);
    }
  };
  return (
    <div className="wrap order-page">
      {order.isTest && <div className="ribbon-test">{t('order.testBanner')}</div>}
      <header className="page-head">
        <span className="eyebrow">{t('order.label', { n: order.number })}</span>
        <h1>{fresh ? <>{t('order.onWayA')} <em>{t('order.onWayB')}</em></> : statusLabel(order.status)}</h1>
        <p>{fresh ? t('order.thanks', { name: order.customer.name.split(' ')[0], email: order.customer.email, phone: order.customer.phone }) : t('order.placed', { date: date(order.createdAt) })}</p>
      </header>
      {!cancelled ? (
        <ol className="track">
          {TRACK.filter((s) => s !== 'pending_payment' || order.status === 'pending_payment').map((s) => {
            const k = TRACK.indexOf(s);
            return <li key={s} className={k < idx ? 'done' : k === idx ? 'now' : ''}><span className="track-dot" />{statusLabel(s)}</li>;
          })}
        </ol>
      ) : <p className="form-error">{t('order.wasStatus', { status: statusLabel(order.status).toLowerCase() })}</p>}
      {order.status === 'pending_payment' && order.paymentStatus !== 'paid' && (
        <div className="panel pad pay-retry">
          <p><b>{payLabel(order.paymentStatus)}.</b> {t('order.reserved')}</p>
          <button className="btn" onClick={retry} disabled={paying}>{paying ? t('order.opening') : t('order.complete')}</button>
        </div>
      )}
      <div className="order-grid">
        <ul className="order-items panel pad">
          {order.items.map((it, i) => (
            <li key={i}>
              <span className="order-thumb"><ProductVisual product={{ art: it.art, image: it.image, name: it.name }} /></span>
              <span><b>{it.name}</b><small className="muted">{it.variantName} · {it.quantity} × {money(it.unitPrice)}{it.personalization ? ` · “${it.personalization}”` : ''}</small></span>
              <b>{money(it.total)}</b>
            </li>
          ))}
        </ul>
        <aside className="panel pad">
          <dl className="totals">
            <div><dt>{t('cart.gifts')}</dt><dd>{money(order.subtotal)}</dd></div>
            {order.discount > 0 && <div className="gold"><dt>{t('cart.code', { code: order.couponCode })}</dt><dd>−{money(order.discount)}</dd></div>}
            {order.pioneerDiscount > 0 && <div className="gold"><dt>{t('sleigh.pioneer')}</dt><dd>−{money(order.pioneerDiscount)}</dd></div>}
            <div><dt>{t('cart.delivery')}</dt><dd>{order.shipping ? money(order.shipping) : t('common.free')}</dd></div>
            <div className="totals-grand"><dt>{t('common.total')}</dt><dd>{money(order.total)}</dd></div>
          </dl>
          <p className="muted small-note">{payLabel(order.paymentStatus)}</p>
          <p className="small-note"><b>{order.delivery.zoneName}</b>{order.delivery.address ? ` — ${order.delivery.city}, ${order.delivery.address}` : ''}{order.delivery.date ? ` · ${order.delivery.date}` : ''}</p>
          {order.trackingCode && <p className="small-note">{t('order.tracking')} <b>{order.trackingCode}</b></p>}
        </aside>
      </div>
      <p className="center"><Link className="btn btn-ghost" to="/shop">{t('order.continue')}</Link></p>
    </div>
  );
}

export default function Order() {
  const { number } = useParams();
  const [params] = useSearchParams();
  const { t } = useI18n();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const fresh = params.get('new') === '1' || params.get('returned') === '1';
  useEffect(() => {
    if (!number) return;
    const key = params.get('key') ?? storage.get(`mc.order.${number}`);
    api.get(`/orders/${number}${qs({ key })}`).then((r) => {
      setOrder(r.order);
      if (fresh && r.order.paymentStatus !== 'failed') celebrate({ intensity: 1.5 });
    }, setError);
    document.title = `${t('order.label', { n: number })} · ${t('brand.name')}`;
  }, [number]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!number) return <TrackForm />;
  if (error) return <TrackForm />;
  if (!order) return <Loader label={t('order.finding')} />;
  return <OrderView order={order} fresh={fresh && order.status !== 'pending_payment'} />;
}
