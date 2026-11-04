// Christmas Wishes Wall — little messages of hope travelling through the night.
// One approved wish at a time rises like a lantern; the next drifts in. Wishes come only from the database
// (approved by staff); the browser fetches small random batches, and only once the section is near the screen.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { prefersReducedMotion } from '../lib.js';
import { useI18n } from '../i18n/index.jsx';

export const WISH_CATEGORIES = ['family', 'friends', 'love', 'health', 'success', 'peace', 'everyone'];
const LIMITS = { author: [2, 60], recipient: 60, message: [10, 400] };
const BATCH = 24;
const REFRESH_MS = 5 * 60_000;

// Small gold line glyphs, one per category (the "Christmas-themed detail" on each letter).
const GLYPH = {
  family: <path d="M4 12l8-7 8 7M6 10.5V20h12v-9.5M10 20v-5h4v5" />,
  friends: <><circle cx="8.5" cy="9" r="3" /><circle cx="15.5" cy="9" r="3" /><path d="M3 20c.8-3.4 3-5 5.5-5s4.7 1.6 5.5 5M10.5 20c.8-3.4 2.6-5 5-5s4.7 1.6 5.5 5" /></>,
  love: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  health: <><path d="M12 21V9" /><path d="M12 13c-4 0-6-2.5-6-6 3.5 0 6 2 6 6zM12 11c0-3.5 2.5-6 6-6 0 3.5-2 6-6 6z" /></>,
  success: <polygon points="12,3 14.4,9.2 21,9.5 15.8,13.6 17.6,20 12,16.4 6.4,20 8.2,13.6 3,9.5 9.6,9.2" />,
  peace: <><path d="M4 13c3-1 5.5-4 6.5-8 1.5 3 2 6 1 9" /><path d="M11.5 14c2.5-2 6-2.5 8.5-1-1.5 3.5-5 5.5-9 5l-3 2" /></>,
  everyone: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5S9.4 5.9 12 3.5z" /></>,
  none: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" />,
};
export function WishGlyph({ category }) {
  return <svg className="wish-glyph" viewBox="0 0 24 24" aria-hidden="true">{GLYPH[category] ?? GLYPH.none}</svg>;
}

const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const dwellFor = (w) => Math.min(8000, Math.max(5000, 4200 + (w?.message?.length ?? 0) * 18));
const sizeClass = (n) => (n > 260 ? 'is-long' : n > 140 ? 'is-medium' : 'is-short');

/* ───────── Write a wish ───────── */
function WishForm({ onClose }) {
  const { t } = useI18n();
  const { user } = useApp();
  const opened = useRef(Date.now());
  const first = useRef(null);
  const [f, setF] = useState({ authorName: user?.name ?? '', recipientName: '', message: '', category: '' });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const honeypot = useRef(null);
  useEffect(() => {
    first.current?.focus();
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = prev; };
  }, [onClose]);

  const author = f.authorName.trim();
  const message = f.message.trim();
  const errors = {
    authorName: author.length < LIMITS.author[0] ? t('wishes.errName') : null,
    message: message.length < LIMITS.message[0] ? t('wishes.errMessage') : null,
  };
  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (errors.authorName || errors.message) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/wishes', {
        authorName: author,
        recipientName: f.recipientName.trim() || undefined,
        message,
        category: f.category || undefined,
        website: honeypot.current?.value || undefined,
        elapsedMs: Date.now() - opened.current,
      });
      setSent(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div className="wish-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="wish-modal" role="dialog" aria-modal="true" aria-labelledby="wish-form-title" onClick={(e) => e.stopPropagation()}
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
        <button className="wish-modal-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div key="sent" className="wish-sent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="status">
              <div className="wish-sent-star" aria-hidden="true">
                <svg viewBox="0 0 40 40"><polygon points="20,2 24.5,14 37,14.5 27,22.5 30.5,35 20,27.8 9.5,35 13,22.5 3,14.5 15.5,14" /></svg>
                <span className="wish-sent-trail" />
              </div>
              <h2 id="wish-form-title">{t('wishes.sentTitle')}</h2>
              <p className="muted">{t('wishes.sentBody')}</p>
              <button className="btn" onClick={onClose}>{t('wishes.sentClose')}</button>
            </motion.div>
          ) : (
            <motion.form key="form" className="wish-form" onSubmit={submit} noValidate exit={{ opacity: 0, y: -10 }}>
              <span className="eyebrow">{t('wishes.eyebrow')}</span>
              <h2 id="wish-form-title">{t('wishes.formTitle')}</h2>
              <p className="muted wish-form-intro">{t('wishes.formIntro')}</p>
              {error && <div className="form-error" role="alert">{error.message}</div>}
              <div className="wish-form-row">
                <div className="field">
                  <label htmlFor="wish-author">{t('wishes.yourName')}</label>
                  <input id="wish-author" ref={first} maxLength={LIMITS.author[1]} autoComplete="given-name" value={f.authorName}
                    onChange={(e) => setF({ ...f, authorName: e.target.value })} aria-invalid={touched && !!errors.authorName} aria-describedby="wish-author-err" required />
                  {touched && errors.authorName && <small id="wish-author-err" className="field-error">{errors.authorName}</small>}
                </div>
                <div className="field">
                  <label htmlFor="wish-recipient">{t('wishes.recipient')} <span className="muted">{t('wishes.optional')}</span></label>
                  <input id="wish-recipient" maxLength={LIMITS.recipient} value={f.recipientName} placeholder={t('wishes.recipientHint')}
                    onChange={(e) => setF({ ...f, recipientName: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="wish-message">{t('wishes.message')}</label>
                <textarea id="wish-message" rows={5} maxLength={LIMITS.message[1]} value={f.message} placeholder={t('wishes.messageHint')}
                  onChange={(e) => setF({ ...f, message: e.target.value })} aria-invalid={touched && !!errors.message} aria-describedby="wish-message-count wish-message-err" required />
                <div className="wish-field-foot">
                  {touched && errors.message ? <small id="wish-message-err" className="field-error">{errors.message}</small> : <span />}
                  <small id="wish-message-count" className={`muted ${f.message.length > 360 ? 'gold' : ''}`}>{f.message.length}/{LIMITS.message[1]}</small>
                </div>
              </div>
              <fieldset className="wish-cats">
                <legend>{t('wishes.category')} <span className="muted">{t('wishes.optional')}</span></legend>
                {WISH_CATEGORIES.map((c) => (
                  <label key={c} className={`wish-cat ${f.category === c ? 'on' : ''}`}>
                    <input type="radio" name="wish-category" value={c} checked={f.category === c} onChange={() => setF({ ...f, category: c })}
                      onClick={() => f.category === c && setF({ ...f, category: '' })} />
                    <WishGlyph category={c} /><span>{t(`wishes.cat_${c}`)}</span>
                  </label>
                ))}
              </fieldset>
              {/* Hidden from people; bots fill it in. */}
              <div className="wish-hp" aria-hidden="true"><label htmlFor="wish-website">Website</label><input id="wish-website" ref={honeypot} tabIndex={-1} autoComplete="off" /></div>
              <button className="btn btn-block wish-submit" disabled={busy}>{busy ? t('wishes.sending') : t('wishes.submit')}</button>
              <p className="muted small wish-note">{t('wishes.moderationNote')}</p>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/* ───────── The wall ───────── */
export default function WishesWall() {
  const { t, lang } = useI18n();
  const section = useRef(null);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const [near, setNear] = useState(false);
  const [queue, setQueue] = useState(null); // null = not loaded yet
  const [total, setTotal] = useState(0);
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false); // hover / focus inside the wall
  const [paused, setPaused] = useState(false); // explicit pause button
  const [hidden, setHidden] = useState(false); // tab hidden or section off-screen
  const [writing, setWriting] = useState(false);
  const [userMoved, setUserMoved] = useState(false);
  const seen = useRef([]);
  const lastFetch = useRef(0);
  const loading = useRef(false);
  const opener = useRef(null);
  const openForm = (e) => { opener.current = e.currentTarget; setWriting(true); };
  const closeForm = useCallback(() => { setWriting(false); setTimeout(() => opener.current?.focus(), 0); }, []);

  // Only start once the section is close to the viewport; pause while it is off-screen.
  useEffect(() => {
    const el = section.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setNear(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setNear(true); setHidden(!e.isIntersecting); }, { rootMargin: '400px 0px' });
    io.observe(el);
    const vis = () => setHidden(document.visibilityState !== 'visible');
    document.addEventListener('visibilitychange', vis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, []);

  const loadBatch = useCallback(async (fresh = false) => {
    if (loading.current) return;
    loading.current = true;
    try {
      const exclude = seen.current.slice(-40).join(',');
      const r = await api.get(`/wishes?limit=${BATCH}${exclude ? `&exclude=${exclude}` : ''}`);
      lastFetch.current = Date.now();
      setTotal(r.total);
      setQueue((q) => {
        const items = r.items ?? [];
        if (fresh || !q?.length) return items;
        // Continue with the new batch; never show the wish that is on screen twice in a row.
        const current = q[index];
        const next = items.filter((w) => w.id !== current?.id);
        return [current, ...next].filter(Boolean);
      });
      setIndex(fresh ? 0 : 1); // after a refill, move straight on to a new wish
    } catch {
      setQueue((q) => q ?? []);
    } finally {
      loading.current = false;
    }
  }, [index]);

  useEffect(() => { if (near && queue === null) loadBatch(true); }, [near, queue, loadBatch]);
  // Language switch: content is the same, but reload so the wall restarts cleanly.
  useEffect(() => { if (queue !== null) { seen.current = []; loadBatch(true); setIndex(0); } }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = queue?.[index] ?? queue?.[0] ?? null;
  useEffect(() => { if (current && seen.current.at(-1) !== current.id) seen.current = [...seen.current.slice(-60), current.id]; }, [current]);

  const advance = useCallback((step = 1) => {
    if (!queue?.length) return;
    const next = index + step;
    if (next >= queue.length) {
      // End of this batch: fetch a fresh random batch if there are more wishes than one batch holds,
      // otherwise reshuffle what we have (keeping the current wish from repeating immediately).
      if (total > queue.length || Date.now() - lastFetch.current > REFRESH_MS) { loadBatch(); return; }
      const cur = queue[index];
      const rest = shuffle(queue.filter((w) => w.id !== cur?.id));
      setQueue([...rest, cur].filter(Boolean));
      setIndex(0);
      return;
    }
    setIndex(next < 0 ? queue.length - 1 : next);
  }, [queue, index, total, loadBatch]);

  const running = !!current && (queue?.length ?? 0) > 1 && !held && !paused && !hidden && !writing;
  const dwell = dwellFor(current);
  useEffect(() => {
    if (!running) return undefined;
    const id = setTimeout(() => { setUserMoved(false); advance(1); }, dwell);
    return () => clearTimeout(id);
  }, [running, dwell, advance, current?.id]);

  const go = (step) => { setUserMoved(true); advance(step); };
  const empty = queue !== null && queue.length === 0;
  const variants = reduced
    ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    // The leaving wish rises and fades like a lantern while the next one drifts in beneath it (they overlap).
    : {
      enter: { opacity: 0, y: 52, filter: 'blur(6px)', scale: 0.97 },
      center: { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1, transition: { duration: 1.15, delay: 0.35, ease: [0.22, 1, 0.36, 1] } },
      exit: { opacity: 0, y: -70, filter: 'blur(5px)', scale: 0.985, transition: { duration: 1.1, ease: [0.4, 0, 0.6, 1] } },
    };

  return (
    <section ref={section} className={`wishes-wall ${reduced ? 'is-reduced' : ''}`} aria-labelledby="wishes-title">
      <div className="wishes-lights" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <span key={i} style={{ '--i': i }} />)}</div>
      {!reduced && <div className="wishes-snow" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--i': i }} />)}</div>}
      <div className="wrap wishes-grid">
        <div className="wishes-intro">
          <span className="eyebrow">{t('wishes.eyebrow')}</span>
          <h2 id="wishes-title">{t('wishes.title')}</h2>
          <p className="wishes-lede">{t('wishes.lede')}</p>
          {total > 0 && <p className="wishes-count"><b>{total.toLocaleString('en-US')}</b> {total === 1 ? t('wishes.countOne') : t('wishes.count')}</p>}
          <button className="btn wishes-cta" onClick={openForm}>✦ {t('wishes.write')}</button>
        </div>

        <div className="wishes-stage" onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false); }}>
          <div className="wishes-glow" aria-hidden="true" />
          {queue === null ? (
            <div className="wish-letter is-loading" aria-hidden="true"><span /><span /><span /></div>
          ) : empty ? (
            <div className="wish-letter wish-empty">
              <svg className="wish-candle" viewBox="0 0 40 64" aria-hidden="true"><path className="flame" d="M20 4c4 6 6 9 6 13a6 6 0 0 1-12 0c0-4 2-7 6-13z" /><rect x="14" y="26" width="12" height="34" rx="2" /></svg>
              <p className="wish-text is-short">{t('wishes.emptyTitle')}</p>
              <p className="muted">{t('wishes.emptyBody')}</p>
              <button className="btn btn-ghost" onClick={openForm}>{t('wishes.writeFirst')}</button>
            </div>
          ) : (
            <div className="wish-track" aria-roledescription={t('wishes.carousel')} aria-live={userMoved ? 'polite' : 'off'}>
              <AnimatePresence initial={false}>
                <motion.figure key={current.id} className="wish-letter" variants={variants} initial="enter" animate="center" exit="exit"
                  transition={{ duration: reduced ? 0.6 : 1.1, ease: [0.22, 1, 0.36, 1] }}>
                  <div className="wish-seal"><WishGlyph category={current.category} /></div>
                  {current.recipient && <p className="wish-to">{t('wishes.to')} <b>{current.recipient}</b></p>}
                  <blockquote className={`wish-text ${sizeClass(current.message.length)}`}>{current.message}</blockquote>
                  <figcaption className="wish-from">— {current.author}{current.category ? <span className="wish-cat-name"> · {t(`wishes.cat_${current.category}`)}</span> : null}</figcaption>
                </motion.figure>
              </AnimatePresence>
            </div>
          )}
          {current && queue.length > 1 && (
            <div className="wishes-controls">
              <button className="wish-ctl" onClick={() => go(-1)} aria-label={t('wishes.prev')}>‹</button>
              <div className="wish-thread" aria-hidden="true">
                <span key={`${current.id}-${running}`} className={running ? 'run' : ''} style={{ '--dwell': `${dwell}ms` }} />
              </div>
              <button className="wish-ctl" onClick={() => setPaused((p) => !p)} aria-pressed={paused} aria-label={paused ? t('wishes.play') : t('wishes.pause')}>{paused ? '▶' : '❚❚'}</button>
              <button className="wish-ctl" onClick={() => go(1)} aria-label={t('wishes.next')}>›</button>
            </div>
          )}
        </div>
      </div>
      {/* Rendered at the document root so the dialog is above the header and every other section. */}
      {createPortal(<AnimatePresence>{writing && <WishForm onClose={closeForm} />}</AnimatePresence>, document.body)}
    </section>
  );
}
