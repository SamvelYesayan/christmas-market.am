// Persistent Christmas music player (lives in the nav, outside page transitions, so it never restarts).
// Never autoplays: playback starts only from an explicit click. Volume/mute/track are remembered.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { audio, SONGS } from '../effects/audio.js';
import { useI18n } from '../i18n/index.jsx';
import { storage } from '../lib.js';

const KEY = 'mc.music';

function useEngine() {
  const [s, setS] = useState(audio.state);
  useEffect(() => audio.subscribe(setS), []);
  return s;
}

function Bars({ active, n = 5 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    const tick = () => {
      const lv = audio.levels(n);
      ref.current?.querySelectorAll('span').forEach((el, i) => { el.style.transform = `scaleY(${0.15 + lv[i] * 0.95})`; });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, n]);
  return <span ref={ref} className={`mp-bars ${active ? 'on' : ''}`} aria-hidden="true">{Array.from({ length: n }, (_, i) => <span key={i} />)}</span>;
}

const Icon = {
  play: <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>,
  pause: <svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>,
  next: <svg viewBox="0 0 24 24"><path d="M6 6l8.5 6L6 18zM16 6h2v12h-2z" /></svg>,
  prev: <svg viewBox="0 0 24 24"><path d="M18 6l-8.5 6L18 18zM6 6h2v12H6z" /></svg>,
  vol: <svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
  mute: <svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
  list: <svg viewBox="0 0 24 24"><path d="M4 6h12M4 12h12M4 18h8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M18 14v6a2 2 0 1 1-2-2" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>,
};

export default function MusicPlayer() {
  const { t, lang } = useI18n();
  const s = useEngine();
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(() => !storage.get(KEY, {}).dismissedHint);
  const box = useRef(null);

  // restore preferences (not playback) once
  useEffect(() => {
    const p = storage.get(KEY, {});
    if (typeof p.volume === 'number') audio.setVolume(p.volume);
    if (typeof p.muted === 'boolean') audio.setMuted(p.muted);
    if (Number.isInteger(p.index)) audio.state.index = Math.min(SONGS.length - 1, Math.max(0, p.index));
  }, []);
  useEffect(() => {
    storage.set(KEY, { ...storage.get(KEY, {}), volume: s.volume, muted: s.muted, index: s.index });
  }, [s.volume, s.muted, s.index]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const dismissHint = () => {
    setHint(false);
    storage.set(KEY, { ...storage.get(KEY, {}), dismissedHint: true });
  };
  const toggle = () => { dismissHint(); audio.toggle(); };
  const song = SONGS[s.index];

  return (
    <div className="mp" ref={box}>
      <div className={`mp-pill ${s.playing ? 'playing' : ''}`}>
        <button className="mp-btn mp-main" onClick={toggle} aria-label={s.playing ? t('music.pause') : t('music.play')} title={s.playing ? t('music.pause') : t('music.play')}>
          {s.playing ? Icon.pause : Icon.play}
        </button>
        <button className="mp-title" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog" aria-label={`${t('music.title')}: ${song.title[lang]}`}>
          <Bars active={s.playing && !s.muted} />
          <span className="mp-title-text"><span key={song.id}>{song.title[lang]}</span></span>
        </button>
      </div>
      <AnimatePresence>
        {hint && !s.playing && (
          <motion.div className="mp-hint" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 1.2 }}>
            <button className="mp-hint-main" onClick={toggle}>🎄 {t('music.enable')}</button>
            <button className="mp-hint-x" onClick={dismissHint} aria-label={t('common.close')}>×</button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.div className="mp-panel" role="dialog" aria-label={t('music.title')} initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}>
            <div className="mp-now">
              <span className="eyebrow">{s.playing ? t('music.nowPlaying') : t('music.paused')}</span>
              <b>{song.title[lang]}</b>
              <small className="muted">{song.credit[lang]}</small>
            </div>
            <div className="mp-controls">
              <button className="mp-btn" onClick={() => { dismissHint(); audio.prev(); }} aria-label={t('music.prev')} title={t('music.prev')}>{Icon.prev}</button>
              <button className="mp-btn mp-big" onClick={toggle} aria-label={s.playing ? t('music.pause') : t('music.play')}>{s.playing ? Icon.pause : Icon.play}</button>
              <button className="mp-btn" onClick={() => { dismissHint(); audio.next(); }} aria-label={t('music.next')} title={t('music.next')}>{Icon.next}</button>
            </div>
            <div className="mp-volume">
              <button className="mp-btn" onClick={() => audio.setMuted(!s.muted)} aria-label={s.muted ? t('music.unmute') : t('music.mute')} aria-pressed={s.muted}>{s.muted ? Icon.mute : Icon.vol}</button>
              <input type="range" min="0" max="1" step="0.05" value={s.muted ? 0 : s.volume} aria-label={t('music.volume')}
                onChange={(e) => { const v = Number(e.target.value); audio.setVolume(v); if (s.muted && v > 0) audio.setMuted(false); }} style={{ '--v': `${(s.muted ? 0 : s.volume) * 100}%` }} />
            </div>
            <div className="mp-list">
              <span className="label">{Icon.list} {t('music.playlist')}</span>
              <ol>
                {SONGS.map((x, i) => (
                  <li key={x.id}>
                    <button className={i === s.index ? 'on' : ''} onClick={() => { dismissHint(); audio.play(i); }} aria-current={i === s.index}>
                      <span className="mp-li-n">{i === s.index && s.playing ? <Bars active n={3} /> : i + 1}</span>
                      <span>{x.title[lang]}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <p className="mp-credit muted">{t('music.credit')}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
