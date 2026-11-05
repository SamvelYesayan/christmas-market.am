// Christmas Calendar — 31 Days of Gifts. One window a day, 1–31 December; the 31st holds the Grand Prize.
// Every rule (which day is today, one claim per day, no catching up, Grand Prize eligibility) is decided by the server.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { api } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { GiftTag, Loader } from '../components/Common.jsx';
import { useI18n } from '../i18n/index.jsx';
import { celebrate } from '../effects/celebrate.js';

// Wrapping paper and ribbon pairs; each day gets its own.
const PAPERS = [['#c8102e', '#f2c46d'], ['#0f6b4f', '#f6e7c1'], ['#1b2a5c', '#f2c46d'], ['#7a2a1e', '#f6e7c1'], ['#b8860b', '#7a1020'], ['#2a4fa8', '#fff6dc']];
const paper = (day) => PAPERS[(day * 7) % PAPERS.length];
const STATE_ICON = { available: '✦', completed: '✓', missed: '✕', locked: '🔒', closed: '·' };

function GiftBox({ day, open = false, grand = false, big = false }) {
  const [box, ribbon] = grand ? ['#14204a', '#f2c46d'] : paper(day);
  return (
    <span className={`gbox ${open ? 'is-open' : ''} ${grand ? 'is-grand' : ''} ${big ? 'is-big' : ''}`} style={{ '--box': box, '--ribbon': ribbon }} aria-hidden="true">
      <span className="gbox-lid"><span className="gbox-bow"><i /><i /></span></span>
      <span className="gbox-body" />
    </span>
  );
}

function Sparks({ n = 14, grand = false }) {
  return (
    <span className={`cal-sparks ${grand ? 'is-grand' : ''}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => <i key={i} style={{ '--a': `${(360 / n) * i}deg`, '--d': `${70 + (i % 3) * 26}px`, '--t': `${(i % 4) * 0.05}s` }} />)}
    </span>
  );
}

/** What a claimed window gave: text, coupon code, Stardust, product, game link. */
function Received({ content }) {
  const { t } = useI18n();
  if (!content) return null;
  const r = content.reward;
  return (
    <div className="cal-received">
      {content.image && <img className="cal-gift-img" src={content.image} alt="" />}
      <h3>{content.title}</h3>
      {content.description && <p>{content.description}</p>}
      {content.story && <p className="cal-story">{content.story}</p>}
      {content.text && <p>{content.text}</p>}
      {r?.kind === 'coupon' && r.couponCode && (
        <div className="coupon-ticket"><span>{t('advent.yourCode')}</span><b>{r.couponCode}</b><small>{t('advent.codeNote')}</small></div>
      )}
      {r?.kind === 'points' && <p className="stardust">{t('advent.points', { n: r.points })}</p>}
      {content.product && <div className="door-product"><GiftTag product={content.product} variant="mini" /></div>}
      {content.game && <Link className="btn btn-sm" to={`/games/${content.game}`}>{t('advent.playNow')}</Link>}
    </div>
  );
}

function SignInPrompt() {
  const { t } = useI18n();
  return (
    <div className="cal-signin">
      <p>{t('advent.signInBody')}</p>
      <div className="cal-actions">
        <Link className="btn" to="/login?next=/advent">{t('advent.signIn')}</Link>
        <Link className="btn btn-ghost" to="/register?next=/advent">{t('advent.register')}</Link>
      </div>
    </div>
  );
}

/** The opened window: reveal → choose/claim → confirmation. */
function DayWindow({ win, data, onClose, onClaimed }) {
  const { t } = useI18n();
  const { user, rewardCelebration } = useApp();
  const reduce = useReducedMotion();
  const [revealed, setRevealed] = useState(win.status !== 'available' || reduce);
  const [choice, setChoice] = useState(win.options?.length === 1 ? win.options[0].key : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const closeRef = useRef(null);
  const grand = win.isGrand;
  const g = data.grand;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const timer = !revealed ? setTimeout(() => setRevealed(true), grand ? 1300 : 900) : null;
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(timer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const claim = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = { day: win.day };
      if (choice) body.optionKey = choice;
      const r = await api.post('/advent/claim', body);
      setResult(r);
      onClaimed(r);
      const reward = r.window.received?.content?.reward;
      if (reward || r.achievements?.[0]) rewardCelebration(reward, r.achievements?.[0]); // toast + confetti
      if (!reward || grand) celebrate({ intensity: grand ? 2 : 1.1, palette: grand ? 'gold' : undefined });
    } catch (e) {
      setError(e);
      if (['already_claimed', 'day_missed', 'day_locked', 'grand_not_eligible'].includes(e.code)) onClaimed(null);
    } finally {
      setBusy(false);
    }
  };

  const shown = result?.window ?? win;
  const needsChoice = shown.status === 'available' && shown.configured && shown.options?.length > 0;
  const grandLost = grand && g?.status === 'lost';

  let body;
  if (shown.status === 'completed') {
    const outcome = shown.received?.outcome;
    body = (
      <div className="cal-done" role="status">
        <div className="cal-check" aria-hidden="true">✓</div>
        <h2>{grand ? t('advent.grandEntered') : result ? t('advent.claimedTitle') : t('advent.completedTitle', { day: shown.day })}</h2>
        {grand ? <p>{t('advent.grandEnteredBody')}</p>
          : outcome === 'check_in' ? <p>{t('advent.checkInBody')}</p>
            : outcome === 'sold_out' ? <p>{t('advent.soldOutBody')}</p> : null}
        <Received content={shown.received?.content} />
        {result && !grand && <p className="cal-tomorrow">{shown.day < 30 ? t('advent.comeBack', { day: shown.day + 1 }) : t('advent.comeBackGrand')}</p>}
      </div>
    );
  } else if (shown.status === 'available') {
    body = (
      <>
        {shown.image && <img className="cal-gift-img" src={shown.image} alt="" />}
        <h2>{grand ? (shown.title ?? t('advent.grandTitle')) : shown.configured ? shown.title : t('advent.wrappingTitle')}</h2>
        {shown.configured ? (shown.description || shown.teaser) && <p>{shown.description ?? shown.teaser}</p> : !grand && <p>{t('advent.wrappingBody')}</p>}
        {grand && shown.description == null && <p>{t('advent.grandLead')}</p>}
        {shown.giftsLeft != null && <p className="cal-left">{t('advent.giftsLeft', { n: shown.giftsLeft })}</p>}
        {grandLost ? (
          <div className="cal-ineligible" role="note"><h3>{t('advent.notEligibleTitle')}</h3><p>{t('advent.notEligibleBody', { days: g.missed.join(', ') })}</p></div>
        ) : !user ? <SignInPrompt /> : (
          <>
            {needsChoice && (
              <fieldset className="cal-options">
                <legend>{t('advent.choose')}</legend>
                {shown.options.map((o) => (
                  <label key={o.key} className={`cal-option ${choice === o.key ? 'on' : ''}`}>
                    <input type="radio" name="gift" value={o.key} checked={choice === o.key} onChange={() => setChoice(o.key)} />
                    {o.image && <img src={o.image} alt="" />}
                    <span><b>{o.title}</b>{o.description && <small>{o.description}</small>}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {error && <p className="form-error" role="alert">{error.message}</p>}
            <button className={`btn cal-claim ${grand ? 'is-grand' : ''}`} onClick={claim} disabled={busy || (needsChoice && !choice)}>
              {busy ? t('advent.claiming') : grand ? t('advent.grandEnter') : shown.configured ? t('advent.claim') : t('advent.markDay')}
            </button>
          </>
        )}
      </>
    );
  } else {
    // Grand Prize preview (before the 31st) or a missed 31st.
    body = (
      <>
        {shown.image && <img className="cal-gift-img" src={shown.image} alt="" />}
        <h2>{shown.title ?? t('advent.grandTitle')}</h2>
        <p>{shown.description ?? t('advent.grandLead')}</p>
        {!shown.title && <p className="muted">{t('advent.grandSoon')}</p>}
        {g && (g.status === 'lost'
          ? <div className="cal-ineligible" role="note"><h3>{t('advent.notEligibleTitle')}</h3><p>{t('advent.notEligibleBody', { days: g.missed.join(', ') })}</p></div>
          : <p className="cal-grand-status">{t(`advent.st_${g.status}`)} · {t('advent.grandCount', { n: g.completed })}</p>)}
        {!user && <SignInPrompt />}
        <p className="cal-tomorrow">{t('advent.grandOpens')}</p>
      </>
    );
  }

  return (
    <motion.div className="cal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className={`cal-window ${grand ? 'is-grand' : ''}`} role="dialog" aria-modal="true" aria-labelledby="cal-window-title" onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, scale: 0.92, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ type: 'spring', damping: 20, stiffness: 220 }}>
        <button ref={closeRef} className="cal-x" onClick={onClose} aria-label={t('common.close')}>×</button>
        {grand && <span className="cal-rays" aria-hidden="true" />}
        <header className="cal-window-head">
          <span className="cal-window-day" id="cal-window-title">{grand ? t('advent.grandDayLabel') : t('advent.dayLabel', { day: win.day })}</span>
          <div className={`cal-window-box ${revealed ? '' : 'is-opening'}`}>
            <GiftBox day={win.day} grand={grand} big open={shown.status === 'completed' || (shown.status === 'available' && revealed)} />
            {revealed && shown.status === 'available' && !reduce && <Sparks grand={grand} n={grand ? 22 : 14} />}
            {result && !reduce && <Sparks grand={grand} n={grand ? 28 : 18} />}
          </div>
        </header>
        <AnimatePresence mode="wait">
          {revealed ? (
            <motion.div key={result ? 'done' : 'gift'} className="cal-window-body" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              {body}
            </motion.div>
          ) : <motion.p key="opening" className="cal-opening muted" exit={{ opacity: 0 }}>{t('advent.opening')}</motion.p>}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default function Advent() {
  const { toast, user } = useApp();
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [openDay, setOpenDay] = useState(null);
  const openerRef = useRef(null);

  const load = () => api.get('/advent').then(setData, setError);
  useEffect(() => { document.title = `${t('advent.title')} · ${t('brand.name')}`; }, [t]);
  useEffect(() => { load(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="wrap"><div className="form-error">{error.message}</div></div>;
  if (!data) return <Loader label={t('advent.loading')} />;

  const byDay = (d) => data.days[d - 1];
  const today = data.todayDay ? byDay(data.todayDay) : null;
  const g = data.grand;
  const pct = (data.progress.completed / data.progress.total) * 100;

  const choose = (win, el) => {
    if (win.status === 'locked' && !win.isGrand) {
      el?.animate?.([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 320 });
      return toast(t('advent.lockedToast', { day: win.day }), { icon: '🔒' });
    }
    if (win.status === 'missed') return toast(t('advent.missedToast', { day: win.day }), { icon: '⌛' });
    if (win.status === 'closed') return toast(t('advent.closedToast', { day: win.day }), { icon: '⌛' });
    openerRef.current = el;
    setOpenDay(win.day);
  };
  const close = () => { setOpenDay(null); setTimeout(() => openerRef.current?.focus?.(), 0); };
  const claimed = (r) => {
    if (!r) return load();
    setData((d) => ({ ...d, progress: r.progress, grand: r.grand, days: d.days.map((x) => (x.day === r.day ? r.window : x)) }));
  };
  const grandWin = byDay(31);

  return (
    <div className="cal wrap">
      <header className="cal-head">
        <span className="eyebrow">{t('advent.eyebrow', { year: data.year })}</span>
        <h1>{t('advent.h1')}</h1>
        <p className="cal-sub">{t('advent.sub')}</p>
        <p className="cal-rules">{t('advent.rules')}</p>
      </header>

      <section className="cal-status" aria-label={t('advent.progressLabel')}>
        <div className="cal-progress">
          <b>{user ? t('advent.progress', { n: data.progress.completed, total: data.progress.total }) : t('advent.progressGuest')}</b>
          <span className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={data.progress.total} aria-valuenow={data.progress.completed}><span style={{ width: `${pct}%` }} /></span>
          {g && <span className={`cal-chip st-${g.status}`}>{t(`advent.st_${g.status}`)}</span>}
        </div>
        <div className="cal-today">
          {data.phase === 'before' ? <p><b>{t('advent.beforeTitle')}</b></p>
            : data.phase === 'over' ? <p><b>{t('advent.overTitle')}</b></p>
              : today && (today.status === 'available'
                ? <button className={`btn cal-today-btn ${today.isGrand ? 'is-grand' : ''}`} onClick={(e) => choose(today, e.currentTarget)}>
                  {today.isGrand ? t('advent.openGrand') : t('advent.openToday', { day: today.day })}
                </button>
                : <p><b>{t('advent.todayDone')}</b></p>)}
        </div>
      </section>

      <ul className="cal-legend" aria-label={t('advent.legend')}>
        {['available', 'completed', 'missed', 'locked'].map((s) => <li key={s} className={`s-${s}`}><i aria-hidden="true">{STATE_ICON[s]}</i>{t(`advent.lg_${s}`)}</li>)}
      </ul>

      <ol className="cal-grid">
        {data.days.slice(0, 30).map((w) => (
          <li key={w.day}>
            <button className={`cal-day s-${w.status} ${w.isToday ? 'is-today' : ''}`} onClick={(e) => choose(w, e.currentTarget)}
              aria-label={t('advent.dayAria', { day: w.day, state: t(`advent.s_${w.status}`) })}>
              <GiftBox day={w.day} open={w.status === 'completed'} />
              <span className="cal-num">{w.day}</span>
              <span className="cal-state" aria-hidden="true"><i>{STATE_ICON[w.status]}</i> <span className="cal-state-text">{t(`advent.s_${w.status}`)}</span></span>
            </button>
          </li>
        ))}
        <li className="cal-grand-cell">
          <button className={`cal-day cal-grand s-${grandWin.status} ${grandWin.isToday ? 'is-today' : ''}`} onClick={(e) => choose(grandWin, e.currentTarget)}
            aria-label={t('advent.grandAria', { state: t(`advent.s_${grandWin.status}`) })}>
            <span className="cal-rays" aria-hidden="true" />
            <GiftBox day={31} grand open={grandWin.status === 'completed'} />
            <span className="cal-grand-text">
              <span className="cal-grand-eyebrow">{t('advent.grandDayLabel')}</span>
              <span className="cal-grand-title">{grandWin.title ?? t('advent.grandTitle')} 🎁</span>
              <span className="cal-grand-lead">{t('advent.grandLead')}</span>
            </span>
            <span className="cal-num">31</span>
          </button>
        </li>
      </ol>

      {createPortal(
        <AnimatePresence>
          {openDay && <DayWindow key={openDay} win={byDay(openDay)} data={data} onClose={close} onClaimed={claimed} />}
        </AnimatePresence>, document.body)}
    </div>
  );
}
