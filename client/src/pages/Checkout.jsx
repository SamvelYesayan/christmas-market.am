// Checkout as a sleigh journey: Who → Where → How → Review.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { money, storage } from '../lib.js';
import { Empty, Loader } from '../components/Common.jsx';
import { CouponBox, Totals } from './Cart.jsx';
import { useI18n } from '../i18n/index.jsx';

const STEPS = ['s1', 's2', 's3', 's4'];

function submitForm(action, fields) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  Object.entries(fields).forEach(([k, v]) => {
    const i = document.createElement('input');
    i.type = 'hidden';
    i.name = k;
    i.value = v;
    form.appendChild(i);
  });
  document.body.appendChild(form);
  form.submit();
}

export default function Checkout() {
  const { cart, user, refreshCart, toast, rewardCelebration } = useApp();
  const { t } = useI18n();
  const nav = useNavigate();
  const [options, setOptions] = useState(null);
  const [step, setStep] = useState(0);
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const saved = storage.get('mc.checkout', {});
  const [form, setForm] = useState({
    name: user?.name ?? saved.name ?? '',
    email: user?.email ?? saved.email ?? '',
    phone: user?.phone ?? saved.phone ?? '',
    zone: '',
    city: saved.city ?? (document.documentElement.lang === 'hy' ? 'Երևան' : 'Yerevan'),
    address: saved.address ?? '',
    date: '',
    notes: '',
    paymentMethod: '',
    giftMessage: '',
    acceptTerms: false,
    rememberDetails: !!saved.email,
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  useEffect(() => {
    document.title = `${t('checkout.title')} · ${t('brand.name')}`;
    api.get('/checkout/options').then((o) => {
      setOptions(o);
      setForm((f) => ({ ...f, zone: f.zone || o.zones[0]?.code, paymentMethod: f.paymentMethod || o.paymentMethods[0]?.code }));
    }, setError);
  }, []);
  useEffect(() => {
    if (form.zone) api.get(`/checkout/quote?zone=${form.zone}`).then(setQuote).catch(() => {});
  }, [form.zone, cart]);

  const zone = options?.zones.find((z) => z.code === form.zone);
  const method = options?.paymentMethods.find((m) => m.code === form.paymentMethod);
  const minDate = useMemo(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10), []);
  const valid = [
    form.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email) && /^\+?[0-9 ()-]{6,20}$/.test(form.phone),
    !!zone && (!zone.requiresAddress || (form.city.trim() && form.address.trim().length > 4)),
    !!method,
    form.acceptTerms,
  ];

  const place = async () => {
    setBusy(true);
    setError(null);
    if (form.rememberDetails) storage.set('mc.checkout', { name: form.name, email: form.email, phone: form.phone, city: form.city, address: form.address });
    else storage.remove('mc.checkout');
    try {
      const r = await api.post('/orders', {
        customer: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() },
        delivery: { zone: form.zone, city: zone.requiresAddress ? form.city.trim() : undefined, address: zone.requiresAddress ? form.address.trim() : undefined, date: form.date || undefined, notes: form.notes.trim() || undefined },
        paymentMethod: form.paymentMethod,
        giftMessage: form.giftMessage.trim() || undefined,
        acceptTerms: true,
      });
      refreshCart();
      storage.set(`mc.order.${r.order.number}`, r.accessKey);
      if (r.achievement) rewardCelebration(null, r.achievement);
      if (r.paymentError) toast(r.paymentError, { tone: 'error' });
      const p = r.payment;
      if (p?.type === 'redirect' && p.url) {
        if (p.url.startsWith(window.location.origin)) nav(p.url.slice(window.location.origin.length));
        else window.location.assign(p.url);
      } else if (p?.type === 'form') submitForm(p.action, p.fields);
      else nav(`/order/${r.order.number}?key=${r.accessKey}&new=1`);
    } catch (err) {
      setError(err);
      if (err.code === 'insufficient_stock' || err.code === 'unavailable_item') refreshCart();
    } finally {
      setBusy(false);
    }
  };

  if (!cart.items.length && !busy) return <div className="wrap"><Empty art={{ type: 'sleigh', c1: '#c8102e' }} title={t('checkout.nothing')}><Link className="btn" to="/shop">{t('common.visitMarket')}</Link></Empty></div>;
  if (!options) return error ? <div className="wrap"><div className="form-error">{error.message}</div></div> : <Loader />;

  return (
    <div className="wrap checkout">
      <header className="page-head"><span className="eyebrow">{t('checkout.title')}</span><h1>{t('checkout.h1a')} <em>{t('checkout.h1b')}</em></h1></header>
      <ol className="journey" aria-label={t('checkout.steps')}>
        {STEPS.map((s, i) => (
          <li key={s} className={i < step ? 'done' : i === step ? 'now' : ''}>
            <button onClick={() => i <= step && setStep(i)} disabled={i > step}><span className="journey-dot">{i < step ? '✓' : i + 1}</span>{t(`checkout.${s}`)}</button>
          </li>
        ))}
        <motion.span className="journey-sleigh" animate={{ left: `${(step / (STEPS.length - 1)) * 100}%` }} aria-hidden="true">🛷</motion.span>
      </ol>
      <div className="checkout-grid">
        <div className="panel pad">
          {error && <div className="form-error" role="alert">{error.message}</div>}
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              {step === 0 && (
                <>
                  <h2>{t('checkout.whoTitle')}</h2>
                  {!user && <p className="muted"><Link className="link" to="/login?next=/checkout">{t('common.signIn')}</Link>{t('checkout.signInNote')}</p>}
                  <div className="field"><label htmlFor="n">{t('checkout.fullName')}</label><input id="n" autoComplete="name" value={form.name} onChange={set('name')} required /></div>
                  <div className="grid-2">
                    <div className="field"><label htmlFor="e">{t('checkout.email')}</label><input id="e" type="email" autoComplete="email" value={form.email} onChange={set('email')} required /></div>
                    <div className="field"><label htmlFor="p">{t('checkout.phone')}</label><input id="p" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="+374 __ ______" required /></div>
                  </div>
                  <label className="check"><input type="checkbox" checked={form.rememberDetails} onChange={set('rememberDetails')} /> {t('checkout.remember')}</label>
                </>
              )}
              {step === 1 && (
                <>
                  <h2>{t('checkout.whereTitle')}</h2>
                  <div className="zones">
                    {options.zones.map((z) => (
                      <label key={z.code} className={`zone ${form.zone === z.code ? 'on' : ''}`}>
                        <input type="radio" name="zone" value={z.code} checked={form.zone === z.code} onChange={set('zone')} />
                        <b>{z.name}</b><span className="muted">{z.description}</span>
                        <span className="zone-meta">{z.price === 0 ? t('common.free') : money(z.price)} · {z.eta}{z.freeOver ? ` · ${t('checkout.freeOver', { amount: money(z.freeOver) })}` : ''}</span>
                      </label>
                    ))}
                  </div>
                  {zone?.requiresAddress && (
                    <div className="grid-2">
                      <div className="field"><label htmlFor="c">{t('checkout.city')}</label><input id="c" autoComplete="address-level2" value={form.city} onChange={set('city')} /></div>
                      <div className="field"><label htmlFor="a">{t('checkout.address')}</label><input id="a" autoComplete="street-address" value={form.address} onChange={set('address')} /></div>
                    </div>
                  )}
                  <div className="grid-2">
                    <div className="field"><label htmlFor="d">{t('checkout.date')}</label><input id="d" type="date" min={minDate} value={form.date} onChange={set('date')} /><span className="hint">{t('checkout.dateHint')}</span></div>
                    <div className="field"><label htmlFor="no">{t('checkout.notes')}</label><input id="no" value={form.notes} onChange={set('notes')} placeholder={t('checkout.notesPh')} /></div>
                  </div>
                  <div className="field"><label htmlFor="gm">{t('checkout.card')}</label><textarea id="gm" maxLength={300} value={form.giftMessage} onChange={set('giftMessage')} placeholder={t('checkout.cardPh')} /></div>
                </>
              )}
              {step === 2 && (
                <>
                  <h2>{t('checkout.howTitle')}</h2>
                  <div className="zones">
                    {options.paymentMethods.map((m) => (
                      <label key={m.code} className={`zone ${form.paymentMethod === m.code ? 'on' : ''} ${m.isTest ? 'zone-test' : ''}`}>
                        <input type="radio" name="pm" value={m.code} checked={form.paymentMethod === m.code} onChange={set('paymentMethod')} />
                        <b>{m.label} {m.isTest && <span className="badge badge-test">{t('common.test')}</span>}</b><span className="muted">{m.description}</span>
                      </label>
                    ))}
                  </div>
                  {options.upcomingPaymentMethods?.length > 0 && <p className="muted small-note">{t('checkout.soon', { list: options.upcomingPaymentMethods.join(', ') })}</p>}
                  <p className="muted small-note">{t('checkout.secure')}</p>
                </>
              )}
              {step === 3 && quote && (
                <>
                  <h2>{t('checkout.reviewTitle')}</h2>
                  {method?.isTest && <div className="ribbon-test">{t('checkout.testBanner')}</div>}
                  <dl className="review-dl">
                    <div><dt>{t('checkout.from')}</dt><dd>{form.name} · {form.email} · {form.phone}</dd></div>
                    <div><dt>{t('checkout.delivery')}</dt><dd>{zone.name}{zone.requiresAddress ? ` — ${form.city}, ${form.address}` : ''}{form.date ? ` · ${form.date}` : ''}</dd></div>
                    <div><dt>{t('checkout.payment')}</dt><dd>{method.label}</dd></div>
                    {form.giftMessage && <div><dt>{t('checkout.cardLabel')}</dt><dd className="italic">“{form.giftMessage}”</dd></div>}
                  </dl>
                  <label className="check"><input type="checkbox" checked={form.acceptTerms} onChange={set('acceptTerms')} /> {t('checkout.accept1')} <Link className="link" to="/info/terms" target="_blank">{t('checkout.terms')}</Link> {t('checkout.accept2')} <Link className="link" to="/info/privacy" target="_blank">{t('checkout.privacy')}</Link>.</label>
                </>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="row between checkout-nav">
            {step > 0 ? <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>← {t('common.back')}</button> : <Link className="link" to="/cart">{t('checkout.backSleigh')}</Link>}
            {step < 3 ? <button className="btn" disabled={!valid[step]} onClick={() => setStep(step + 1)}>{t('common.continue')}</button>
              : <button className="btn btn-red" disabled={!valid[3] || busy} onClick={place}>{busy ? t('checkout.sending') : method?.kind === 'offline' ? t('checkout.place', { amount: money(quote?.total ?? 0) }) : t('checkout.pay', { amount: money(quote?.total ?? 0) })}</button>}
          </div>
        </div>
        <aside className="panel pad checkout-summary">
          <h3>{t('checkout.inSleigh')}</h3>
          <ul className="mini-lines">{cart.items.map((it) => <li key={it.id}><span>{it.quantity}× {it.name}<small className="muted"> · {it.variantName}</small></span><b>{money(it.total)}</b></li>)}</ul>
          <CouponBox />
          {quote && <Totals quote={quote} showShipping />}
        </aside>
      </div>
    </div>
  );
}
