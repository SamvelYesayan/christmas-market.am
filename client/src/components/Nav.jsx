// Desktop: a garland strung across the top, links hang beneath like ornament tags.
// Mobile: a slim top bar (brand, language, music, sleigh) plus a lantern "compass" radial world map.
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../state/AppState.jsx';
import { LangSwitch, useI18n } from '../i18n/index.jsx';
import MusicPlayer from './MusicPlayer.jsx';

const LINKS = [
  { to: '/shop', key: 'market', color: '#c8102e' },
  { to: '/gift-finder', key: 'finder', color: '#f2c46d' },
  { to: '/advent', key: 'advent', color: '#0f6b4f' },
  { to: '/academy', key: 'academy', color: '#2a4fa8' },
  { to: '/games', key: 'games', color: '#c8102e' },
  { to: '/pioneer', key: 'pioneer', color: '#b8860b' },
];

function Brand() {
  const { t } = useI18n();
  return (
    <Link to="/" className="brand" aria-label={t('brand.name')}>
      <svg viewBox="0 0 40 40" className="brand-star" aria-hidden="true">
        <polygon points="20,2 24.5,14 37,14.5 27,22.5 30.5,35 20,27.8 9.5,35 13,22.5 3,14.5 15.5,14" fill="var(--gold)" />
      </svg>
      <span className="brand-text">
        <span className="brand-name">{t('brand.name')}</span>
        <span className="brand-sub">{t('brand.sub')}</span>
      </span>
    </Link>
  );
}

function Icons({ onSearch }) {
  const { user, cart, setCartOpen } = useApp();
  const { t } = useI18n();
  return (
    <div className="nav-icons">
      <LangSwitch className="hide-xs" />
      <MusicPlayer />
      <button className="nav-ico hide-sm" onClick={onSearch} aria-label={t('nav.search')}>
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
      </button>
      <Link className="nav-ico hide-sm" to={user ? '/account/wishlist' : '/login'} aria-label={t('nav.wishlist')}>
        <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
      </Link>
      <Link className="nav-ico hide-sm" to={user ? '/account' : '/login'} aria-label={user ? t('nav.cottage') : t('common.signIn')}>
        <svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9H4z" /><path d="M10 20v-5h4v5" /></svg>
        {user && <span className="nav-dot" />}
      </Link>
      <button className="nav-ico sleigh-target" onClick={() => setCartOpen(true)} aria-label={t('nav.sleighItems', { n: cart.count })} data-sleigh>
        <svg viewBox="0 0 24 24"><path d="M3 8h11a4 4 0 0 1 4 4v3H5a2 2 0 0 1-2-2z" /><path d="M2 19h17a3 3 0 0 0 3-3" /><path d="M7 15v4M15 15v4" /></svg>
        {cart.count > 0 && <motion.span key={cart.count} className="nav-count" initial={{ scale: 0.4 }} animate={{ scale: 1 }}>{cart.count}</motion.span>}
      </button>
    </div>
  );
}

function SearchOverlay({ open, onClose }) {
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const { t } = useI18n();
  const input = useRef(null);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 50); }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="search-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.form initial={{ y: -20 }} animate={{ y: 0 }} onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); if (q.trim()) { nav(`/shop?q=${encodeURIComponent(q.trim())}`); onClose(); } }}>
            <label className="eyebrow" htmlFor="site-search">{t('nav.searchLabel')}</label>
            <input id="site-search" ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('nav.searchPlaceholder')} autoComplete="off" />
            <div className="row">
              {t('nav.searchSuggestions').split('|').map((s) => (
                <button type="button" key={s} className="chip" onClick={() => { nav(`/shop?q=${encodeURIComponent(s)}`); onClose(); }}>{s}</button>
              ))}
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [compass, setCompass] = useState(false);
  const [search, setSearch] = useState(false);
  const loc = useLocation();
  const { t } = useI18n();
  const { user } = useApp();
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 30);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => { setCompass(false); setSearch(false); }, [loc.pathname]);

  return (
    <>
      <header className={`nav ${scrolled ? 'scrolled' : ''}`}>
        <svg className="garland-wire" viewBox="0 0 1600 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 8 Q 200 46 400 14 T 800 14 T 1200 14 T 1600 8" fill="none" stroke="#1e3a2c" strokeWidth="7" strokeLinecap="round" />
          <path d="M0 8 Q 200 46 400 14 T 800 14 T 1200 14 T 1600 8" fill="none" stroke="#2f5a43" strokeWidth="3" strokeDasharray="2 7" />
          {Array.from({ length: 22 }, (_, i) => {
            const x = 30 + i * 73;
            const tt = (x % 400) / 400;
            const y = 8 + Math.sin(tt * Math.PI) * (x < 400 ? 22 : 8) + 6;
            return <circle key={i} className="garland-bulb" style={{ animationDelay: `${(i % 6) * 0.4}s`, color: ['#ff5a6e', '#f2c46d', '#7fe0c4', '#a9c7ff'][i % 4] }} cx={x} cy={y} r="4.5" fill="currentColor" />;
          })}
        </svg>
        <div className="nav-inner wrap">
          <Brand />
          <nav className="nav-links" aria-label={t('nav.main')}>
            {LINKS.map((l, i) => (
              <NavLink key={l.to} to={l.to} className="nav-tag" style={{ '--tag': l.color, '--d': `${i * 0.12}s` }}>
                <span className="nav-tag-string" aria-hidden="true" />
                <span className="nav-tag-body">{t(`nav.${l.key}`)}</span>
              </NavLink>
            ))}
          </nav>
          <Icons onSearch={() => setSearch(true)} />
        </div>
      </header>

      <button className={`compass-btn ${compass ? 'open' : ''}`} onClick={() => setCompass((v) => !v)} aria-expanded={compass} aria-label={t('nav.openMap')}>
        <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" /><polygon points="24,8 28,24 24,40 20,24" /><circle cx="24" cy="24" r="3" /></svg>
      </button>
      <AnimatePresence>
        {compass && (
          <motion.div className="compass-sheet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCompass(false)}>
            <div className="compass-top" onClick={(e) => e.stopPropagation()}>
              <LangSwitch />
              <button className="chip" onClick={() => { setCompass(false); setSearch(true); }}>🔍 {t('common.search')}</button>
              <Link className="chip" to={user ? '/account' : '/login'}>🏡 {user ? t('nav.cottage') : t('common.signIn')}</Link>
            </div>
            <motion.nav aria-label={t('nav.map')} className="compass-ring" onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.6, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0.6, rotate: 40, opacity: 0 }} transition={{ type: 'spring', damping: 18 }}>
              <Link to="/" className="compass-center">{t('nav.square')}</Link>
              {LINKS.map((l, i) => {
                const a = (i / LINKS.length) * Math.PI * 2 - Math.PI / 2;
                return (
                  <div key={l.to} className="compass-point" style={{ '--x': `${Math.cos(a) * 118}px`, '--y': `${Math.sin(a) * 118}px` }}>
                    <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * i }}>
                      <Link to={l.to} style={{ '--tag': l.color }}><b>{t(`nav.${l.key}`)}</b><small>{t(`nav.${l.key}Hint`)}</small></Link>
                    </motion.div>
                  </div>
                );
              })}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
      <SearchOverlay open={search} onClose={() => setSearch(false)} />
    </>
  );
}
