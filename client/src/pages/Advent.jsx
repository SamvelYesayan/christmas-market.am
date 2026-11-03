// The Clocktower — 24 doors. Opening is decided by the server (no early peeking).
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import Art from '../art/Art.jsx';
import { GiftTag, Loader } from '../components/Common.jsx';
import { HiddenWonder } from '../components/Shell.jsx';
import { useI18n } from '../i18n/index.jsx';

const ART_COLORS = ['#c8102e', '#0f6b4f', '#1b2a5c', '#7a2a1e', '#b8860b', '#2a4fa8'];
// A hand-arranged, non-sequential door layout like a real advent calendar.
const ORDER = [13, 4, 20, 9, 1, 17, 7, 22, 11, 3, 15, 24, 6, 19, 2, 12, 23, 8, 16, 5, 21, 10, 18, 14];

function DoorContent({ content }) {
  const { t } = useI18n();
  if (!content) return null;
  return (
    <div className="door-content">
      <h3>{content.title}</h3>
      {content.story && <p className="door-story">{content.story}</p>}
      {content.text && <p>{content.text}</p>}
      {content.reward?.kind === 'coupon' && (
        <div className="coupon-ticket"><span>{t('advent.yourCode')}</span><b>{content.reward.couponCode}</b><small>{t('advent.codeNote')}</small></div>
      )}
      {content.reward?.kind === 'points' && <p className="stardust">+{content.reward.points} {t('common.stardust')} ✨ {content.reward.pioneerSyncStatus === 'no_card' && <small className="muted">{t('advent.linkCard')}</small>}</p>}
      {content.product && <div className="door-product"><GiftTag product={content.product} variant="mini" /></div>}
      {content.game && <Link className="btn btn-sm" to={`/games/${content.game}`}>{t('advent.playNow')}</Link>}
    </div>
  );
}

export default function Advent() {
  const { user, rewardCelebration, toast } = useApp();
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [opening, setOpening] = useState(null);
  const [shown, setShown] = useState(null);
  const gsapRef = useRef(null);

  const load = () => api.get('/advent').then(setData, setError);
  useEffect(() => {
    load();
    document.title = `${t('advent.title')} · ${t('brand.name')}`;
    import('gsap').then((m) => { gsapRef.current = m.gsap; });
  }, []);

  const open = async (door, el) => {
    if (door.state === 'locked') {
      el?.animate?.([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 350 });
      return toast(data.unlockedThrough === 0 ? t('advent.lockedFirst') : t('advent.lockedDay', { day: door.day }), { icon: '🔒' });
    }
    if (door.state === 'opened') return setShown(door);
    if (!user) return toast(t('advent.signInToast'), { icon: '🔑' });
    setOpening(door.day);
    try {
      const r = await api.post(`/advent/${door.day}/open`);
      const leaf = el?.querySelector('.door-leaf');
      if (gsapRef.current && leaf && !document.documentElement.classList.contains('calm')) {
        await gsapRef.current.timeline()
          .to(leaf, { rotateY: -12, duration: 0.15, ease: 'power1.out' })
          .to(leaf, { rotateY: 8, duration: 0.12 })
          .to(leaf, { rotateY: -110, duration: 0.9, ease: 'back.out(1.4)' });
      }
      const updated = { ...door, state: 'opened', content: r.content };
      setData((d) => ({ ...d, doors: d.doors.map((x) => (x.day === door.day ? updated : x)) }));
      setShown(updated);
      if (r.newReward) rewardCelebration(r.content.reward, r.achievements?.[0]);
    } catch (e) {
      toast(e.message, { tone: 'error' });
    } finally {
      setOpening(null);
    }
  };

  if (error) return <div className="wrap"><div className="form-error">{error.message}</div></div>;
  if (!data) return <Loader label={t('advent.winding')} />;
  const byDay = Object.fromEntries(data.doors.map((d) => [d.day, d]));
  const opened = data.doors.filter((d) => d.state === 'opened').length;

  return (
    <div className="advent wrap">
      <HiddenWonder id="lost-mitten" style={{ left: '2%', top: '40%' }} />
      <header className="advent-head">
        <div>
          <span className="eyebrow">{t('advent.eyebrow', { year: data.year })}</span>
          <h1>{t('advent.h1a')}<br /><em>{t('advent.h1b')}</em></h1>
          <p className="muted">{data.unlockedThrough === 0 ? t('advent.before') : t('advent.during', { day: data.unlockedThrough })}</p>
          {user ? <p className="advent-progress"><b>{t('advent.opened', { n: opened })}</b> <span className="bar"><span style={{ width: `${(opened / 24) * 100}%` }} /></span></p>
            : <Link className="btn" to="/login?next=/advent">{t('advent.signIn')}</Link>}
        </div>
        <div className="advent-clock" aria-hidden="true"><Art art={{ type: 'clock', c1: '#1b2a5c' }} /></div>
      </header>
      <div className="advent-board">
        {ORDER.map((day, k) => {
          const d = byDay[day];
          if (!d) return <div key={day} className="door locked" />;
          const color = ART_COLORS[(day * 5) % ART_COLORS.length];
          return (
            <button key={day} className={`door ${d.state} ${day === data.unlockedThrough ? 'today' : ''} ${k % 5 === 0 ? 'wide' : ''} ${k % 7 === 3 ? 'tall' : ''}`}
              onClick={(e) => open(d, e.currentTarget)} disabled={opening === day} aria-label={t(d.state === 'locked' ? 'advent.doorLocked' : d.state === 'opened' ? 'advent.doorOpened' : 'advent.door', { day })}
              style={{ '--door': color }}>
              <span className="door-inside"><span className="door-inside-art"><Art art={{ type: d.art, c1: color, c2: '#f2c46d' }} /></span></span>
              <span className="door-leaf">
                <span className="door-num">{day}</span>
                {d.state === 'available' && <span className="door-teaser">{d.teaser}</span>}
                {d.state === 'locked' && <span className="door-lock">🔒</span>}
                <span className="door-knob" />
              </span>
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {shown && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShown(null)}>
            <motion.div className="modal door-modal" role="dialog" aria-label={t('advent.door', { day: shown.day })} onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.6, rotateX: 40, opacity: 0 }} animate={{ scale: 1, rotateX: 0, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ type: 'spring', damping: 16 }}>
              <span className="door-modal-day">{shown.day}</span>
              <div className="door-modal-art"><Art art={{ type: shown.art, c1: ART_COLORS[(shown.day * 5) % ART_COLORS.length], c2: '#f2c46d' }} /></div>
              <DoorContent content={shown.content} />
              <button className="btn btn-ghost btn-sm" onClick={() => setShown(null)}>{t('advent.close')}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
