// My Pioneer Card — connect a real Magical Pioneer Card and see its live points, rewards and history.
// Everything shown comes from the server, which reads it from the Pioneer system. The browser never decides
// whether a card is valid, who owns it or how many points it has.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { useAsync } from '../lib.js';
import { Loader } from './Common.jsx';
import { celebrate } from '../effects/celebrate.js';
import { useI18n } from '../i18n/index.jsx';

const fmtNumber = (v) => v.replace(/\D/g, '').slice(0, 8).replace(/^(\d{4})(\d)/, '$1 $2');
const pts = (n) => Number(n ?? 0).toLocaleString('en-US');

export function CardVisual({ masked, holder, empty = false, tilt = true }) {
  const { t } = useI18n();
  const ref = useRef(null);
  const onMove = (e) => {
    if (!tilt || !ref.current || e.pointerType === 'touch') return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.setProperty('--ry', `${x * 14}deg`);
    ref.current.style.setProperty('--rx', `${-y * 10}deg`);
    ref.current.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
  };
  const reset = () => ['--rx', '--ry'].forEach((p) => ref.current?.style.setProperty(p, '0deg'));
  return (
    <div className="vip-card-stage">
      <div ref={ref} className={`vip-card pc-card ${empty ? 'is-empty' : ''}`} onPointerMove={onMove} onPointerLeave={reset} role="img"
        aria-label={empty ? t('pc.brand') : `${t('pc.brand')} ${masked ?? ''} ${holder ?? ''}`}>
        <div className="vip-card-shine" />
        <span className="vip-card-chip" />
        <span className="vip-card-brand">Magical Pioneer</span>
        <span className="vip-card-num" dir="ltr">{empty ? '•••• ••••' : masked}</span>
        <span className="vip-card-name">{empty ? t('pc.brand') : holder || t('pc.member')}</span>
        <svg className="vip-card-star" viewBox="0 0 40 40" aria-hidden="true"><polygon points="20,2 24.5,14 37,14.5 27,22.5 30.5,35 20,27.8 9.5,35 13,22.5 3,14.5 15.5,14" /></svg>
      </div>
    </div>
  );
}

function errorText(err, t) {
  const left = err?.details?.attemptsLeft;
  return [err?.message, Number.isInteger(left) && left > 0 ? t('pc.attemptsLeft', { n: left }) : null].filter(Boolean).join(' ');
}

function ConnectForm({ onDone, onCancel }) {
  const { toast, rewardCelebration } = useApp();
  const { t } = useI18n();
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const first = useRef(null);
  useEffect(() => { first.current?.focus(); }, []);
  const digits = number.replace(/\D/g, '');
  const numberBad = digits.length !== 8;
  const codeBad = !/^\d{3}$/.test(code);
  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (numberBad || codeBad) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.post('/pioneer/link', { cardNumber: digits, verificationCode: code });
      setCode('');
      celebrate({ intensity: 1.3, palette: 'gold' });
      toast(t('pc.connected'), { tone: 'reward', icon: '🌟' });
      if (r.achievement) rewardCelebration(null, r.achievement);
      onDone();
    } catch (err) {
      setCode('');
      if (err.code === 'already_linked') { toast(err.message, { icon: '🌟' }); onDone(); return; }
      setTouched(false); // show the server's message, not a 'field empty' hint for the cleared code
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <motion.form className="panel pad pc-form" onSubmit={submit} noValidate initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <h3>{t('pc.formTitle')}</h3>
      <p className="muted">{t('pc.formBody')}</p>
      {error && <div className="form-error" role="alert">{errorText(error, t)}</div>}
      <div className="pc-fields">
        <div className="field">
          <label htmlFor="pc-num">{t('pc.number')}</label>
          <input id="pc-num" ref={first} inputMode="numeric" autoComplete="off" spellCheck={false} dir="ltr" placeholder="0000 0000"
            value={number} onChange={(e) => setNumber(fmtNumber(e.target.value))} aria-invalid={touched && numberBad} aria-describedby="pc-num-hint" />
          <small id="pc-num-hint" className={touched && numberBad ? 'field-error' : 'muted'}>{touched && numberBad ? t('pc.numberError') : t('pc.numberHint')}</small>
        </div>
        <div className="field">
          <label htmlFor="pc-code">{t('pc.code')}</label>
          <input id="pc-code" type="password" inputMode="numeric" autoComplete="off" dir="ltr" placeholder="•••" maxLength={3}
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 3))} aria-invalid={touched && codeBad} aria-describedby="pc-code-hint" />
          <small id="pc-code-hint" className={touched && codeBad ? 'field-error' : 'muted'}>{touched && codeBad ? t('pc.codeError') : t('pc.codeHint')}</small>
        </div>
      </div>
      <div className="row">
        <button className="btn" disabled={busy}>{busy ? t('pc.checking') : t('pc.submit')}</button>
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>{t('pc.cancel')}</button>}
      </div>
    </motion.form>
  );
}

function DisconnectDialog({ onClose, onDone }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const yes = useRef(null);
  useEffect(() => {
    yes.current?.focus();
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const confirm = async () => {
    setBusy(true);
    try {
      await api.del('/pioneer/link', { confirm: true });
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="pc-dc-title" aria-describedby="pc-dc-body"
        initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }} onClick={(e) => e.stopPropagation()}>
        <h3 id="pc-dc-title">{t('pc.disconnectTitle')}</h3>
        <p id="pc-dc-body" className="muted">{t('pc.disconnectBody')}</p>
        {error && <div className="form-error" role="alert">{error.message}</div>}
        <div className="row">
          <button ref={yes} className="btn btn-red" onClick={confirm} disabled={busy}>{t('pc.disconnectYes')}</button>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>{t('pc.cancel')}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Magical's eligibility reasons → customer text.
function rewardState(r, t) {
  if (r.eligible) return { ok: true, text: t('pc.rewardReady') };
  const reasons = r.reasons ?? [];
  if (reasons.includes('card_inactive')) return { text: t('pc.cardInactive') };
  if (reasons.includes('not_yet_available') || r.upcoming) return { text: t('pc.upcoming') };
  if (reasons.includes('sold_out') || r.soldOut) return { text: t('pc.soldOut') };
  if (reasons.includes('per_card_limit_reached') || r.limitReached) return { text: t('pc.limitReached') };
  if (reasons.includes('insufficient_points')) return { text: t('pc.rewardNeed', { n: pts(r.shortfall) }), short: true };
  return { text: '' };
}

function Transactions({ first }) {
  const { t, dateShort } = useI18n();
  const [data, setData] = useState(first);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (!data) return <p className="muted">{t('pc.unavailable')}</p>;
  const pages = Math.max(1, Math.ceil((data.total ?? 0) / (data.pageSize || 20)));
  const go = async (page) => {
    setBusy(true);
    setError(null);
    try { setData(await api.get(`/pioneer/transactions?page=${page}`)); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const items = Array.isArray(data.items) ? data.items : [];
  return (
    <>
      {error && <p className="form-error">{error.message}</p>}
      {items.length === 0 ? <p className="muted">{t('pc.noHistory')}</p> : (
        <ul className="ledger">
          {items.map((h) => (
            <li key={h.id}>
              <span>{dateShort(h.createdAt)}</span>
              <span>{t(`pc.tx_${h.type}`) === `pc.tx_${h.type}` ? h.label : t(`pc.tx_${h.type}`)}{h.description ? <small className="muted"> · {h.description}</small> : null}</span>
              <b className={h.amount >= 0 ? 'plus' : 'minus'}>{h.amount >= 0 ? '+' : ''}{pts(h.amount)}</b>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <div className="row pc-pager">
          <button className="btn btn-ghost btn-sm" disabled={busy || data.page <= 1} onClick={() => go(data.page - 1)}>{t('pc.prev')}</button>
          <span className="muted">{t('pc.pageOf', { page: data.page, pages })}</span>
          <button className="btn btn-ghost btn-sm" disabled={busy || data.page >= pages} onClick={() => go(data.page + 1)}>{t('pc.next')}</button>
        </div>
      )}
    </>
  );
}

function Dashboard({ s, reload }) {
  const { t, dateShort } = useI18n();
  const { toast, refreshUser, refreshCart } = useApp();
  const [dc, setDc] = useState(false);
  const balance = s.balance?.points;
  return (
    <div className="pc-dash">
      <div className="pc-top">
        <CardVisual masked={s.card.masked} holder={s.card.holderName} />
        <div className="panel pad pc-balance">
          <span className="eyebrow">{t('pc.points')}</span>
          <p className="balance-num">{balance != null ? pts(balance) : '—'}</p>
          {s.balance && <small className="muted">{s.balance.live ? `✦ ${t('pc.live')}` : t('pc.asOf', { date: dateShort(s.balance.asOf) })}</small>}
          {s.error && <p className="form-error">{s.error}</p>}
          {s.card.status === 'inactive' && <p className="form-error">{t('pc.cardInactive')}</p>}
          <dl className="pc-facts">
            <div><dt>{t('pc.holder')}</dt><dd>{s.card.holderName ?? t('pc.member')}</dd></div>
            <div><dt>{t('pc.cardNo')}</dt><dd dir="ltr">{s.card.masked}</dd></div>
            {s.card.memberSince && <div><dt>{t('pc.memberSinceLabel')}</dt><dd>{dateShort(s.card.memberSince)}</dd></div>}
            <div><dt>{t('pc.discount')}</dt><dd className="gold">{t('pc.discountBody', { p: s.discountPercent })}</dd></div>
          </dl>
        </div>
      </div>
      {s.partialError && <p className="muted small">{s.partialError}</p>}

      {s.live && (
        <section className="pc-section">
          <h3>{t('pc.rewards')}</h3>
          {s.rewards.length === 0 ? <p className="muted">{t('pc.noRewards')}</p> : (
            <>
              <ul className="pc-rewards">
                {s.rewards.map((r) => {
                  const st = rewardState(r, t);
                  return (
                    <li key={r.id} className="panel pad">
                      <b>{r.title}</b>
                      {r.description && <p className="muted">{r.description}</p>}
                      <div className="row between">
                        <span className="gold">{t('common.points', { n: pts(r.pointsCost) })}</span>
                        <small className={st.ok ? 'ok' : 'muted'}>{st.text}</small>
                      </div>
                      {st.short && balance != null && <span className="bar"><span style={{ width: `${Math.max(4, Math.min(100, (balance / r.pointsCost) * 100))}%` }} /></span>}
                    </li>
                  );
                })}
              </ul>
              <p className="muted small">{t('pc.claimIn')}</p>
            </>
          )}
        </section>
      )}

      {s.live && (
        <section className="pc-section">
          <h3>{t('pc.history')}</h3>
          <Transactions first={s.transactions} />
        </section>
      )}

      <p className="pc-manage"><button className="link" onClick={() => setDc(true)}>{t('pc.disconnect')}</button></p>
      <AnimatePresence>
        {dc && <DisconnectDialog onClose={() => setDc(false)} onDone={() => { setDc(false); toast(t('pc.disconnected'), { icon: '🔓' }); refreshUser(); refreshCart(); reload(); }} />}
      </AnimatePresence>
    </div>
  );
}

/** The whole "My Pioneer Card" section (used in the account). */
export default function MyPioneerCard() {
  const { user, pioneerStatus, refreshUser, refreshCart } = useApp();
  const { t } = useI18n();
  const [n, setN] = useState(0);
  const [open, setOpen] = useState(false);
  const [state] = useAsync(() => (user ? api.get('/pioneer/summary') : Promise.resolve(null)), [user?.id, n]);
  const reload = () => setN((x) => x + 1);
  if (!user) return <div className="panel pad center"><p>{t('pc.signIn')}</p><Link className="btn" to="/login?next=/account/pioneer">{t('common.signIn')}</Link></div>;
  if (state.loading && !state.data) return <Loader />;
  if (state.error) return <p className="form-error">{state.error.message}</p>;
  const s = state.data;
  if (s.linked) return <Dashboard s={s} reload={reload} />;
  const remoteNotice = s.unlinkedRemotely ? <p className="form-error">{t('pc.unlinkedRemotely')}</p> : null;
  const discount = s.discountPercent ?? pioneerStatus?.discountPercent ?? 5;
  return (
    <div className="pc-empty">
      <CardVisual empty />
      <div className="pc-intro">
        {remoteNotice}
        <h2>{t('pc.notLinkedTitle')}</h2>
        <p className="muted">{t('pc.notLinkedBody')}</p>
        <ul className="pc-benefits">
          <li>{t('pc.benefit1', { p: discount })}</li>
          <li>{t('pc.benefit2')}</li>
          <li>{t('pc.benefit3')}</li>
        </ul>
        {!s.available ? (
          <div className="panel pad"><b>{t('pc.soonTitle')}</b><p className="muted">{t('pc.soonBody')}</p></div>
        ) : open ? (
          <ConnectForm onDone={() => { setOpen(false); refreshUser(); refreshCart(); reload(); }} onCancel={() => setOpen(false)} />
        ) : (
          <button className="btn" onClick={() => setOpen(true)}>{t('pc.connect')}</button>
        )}
      </div>
    </div>
  );
}
