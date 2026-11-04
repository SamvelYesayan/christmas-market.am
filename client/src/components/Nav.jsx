// Desktop: a garland strung across the top, shopping links hang beneath like ornament tags.
// Mobile: a slim top bar (brand, language, music, cart) plus a bottom tab bar (Home, Shop, Gift Finder, Account, Menu).
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../state/AppState.jsx';
import { LangSwitch, useI18n } from '../i18n/index.jsx';
import MusicPlayer from './MusicPlayer.jsx';

// What a shopper needs first, always visible.
const PRIMARY = [
  { to: '/shop', key: 'market', color: '#c8102e' },
  { to: '/gift-finder', key: 'finder', color: '#f2c46d' },
  { to: '/pioneer', key: 'pioneer', color: '#b8860b' },
];
// The seasonal extras, grouped so they don't compete with shopping.
const FUN = [
  { to: '/advent', key: 'advent', color: '#0f6b4f' },
  { to: '/games', key: 'games', color: '#c8102e' },
  { to: '/academy', key: 'academy', color: '#2a4fa8' },
];

const Icon = {
  search: <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>,
  user: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>,
  sleigh: <svg viewBox="0 0 24 24"><path d="M3 8h11a4 4 0 0 1 4 4v3H5a2 2 0 0 1-2-2z" /><path d="M2 19h17a3 3 0 0 0 3-3" /><path d="M7 15v4M15 15v4" /></svg>,
  home: <svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9H4z" /><path d="M10 20v-5h4v5" /></svg>,
  shop: <svg viewBox="0 0 24 24"><path d="M4 9h16l-1.5 11h-13z" /><path d="M8 9V7a4 4 0 0 1 8 0v2" /></svg>,
  gift: <svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="11" rx="1.5" /><path d="M3 13h18M12 9v11" /><path d="M12 9c-2-4-6-4-6-1.5S9 9 12 9c3 0 6-.5 6-1.5S14 5 12 9z" /></svg>,
  menu: <svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></svg>,
};

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

function CartButton() {
  const { cart, setCartOpen } = useApp();
  const { t } = useI18n();
  return (
    <button className="nav-ico sleigh-target" onClick={() => setCartOpen(true)} aria-label={t('nav.sleighItems', { n: cart.count })} data-sleigh>
      {Icon.sleigh}
      {cart.count > 0 && <motion.span key={cart.count} className="nav-count" initial={{ scale: 0.4 }} animate={{ scale: 1 }}>{cart.count}</motion.span>}
    </button>
  );
}

function Icons({ onSearch }) {
  const { user } = useApp();
  const { t } = useI18n();
  return (
    <div className="nav-icons">
      <LangSwitch className="hide-xs" />
      <MusicPlayer />
      <button className="nav-ico hide-md" onClick={onSearch} aria-label={t('nav.search')}>{Icon.search}</button>
      <Link className="nav-account hide-md" to={user ? '/account' : '/login'}>
        {Icon.user}<span>{user ? t('nav.account') : t('common.signIn')}</span>
      </Link>
      <CartButton />
    </div>
  );
}

function FunMenu() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const active = FUN.some((l) => loc.pathname.startsWith(l.to));
  return (
    <div className="nav-tag nav-fun" ref={ref} style={{ '--tag': '#0f6b4f', '--d': `${PRIMARY.length * 0.12}s` }}>
      <span className="nav-tag-string" aria-hidden="true" />
      <button className={`nav-tag-body ${active ? 'is-active' : ''}`} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((v) => !v)}>
        {t('nav.fun')} <span aria-hidden="true">▾</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul className="nav-fun-menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {FUN.map((l) => (
              <li key={l.to}><NavLink to={l.to} style={{ '--tag': l.color }}><b>{t(`nav.${l.key}`)}</b><small>{t(`nav.${l.key}Hint`)}</small></NavLink></li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
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

function MobileMenu({ open, onClose, onSearch }) {
  const { t } = useI18n();
  const { user } = useApp();
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="mobile-menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.nav className="mobile-menu-sheet" aria-label={t('nav.menu')} onClick={(e) => e.stopPropagation()}
            initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} transition={{ type: 'spring', damping: 26, stiffness: 260 }}>
            <div className="mobile-menu-top">
              <LangSwitch />
              <button className="chip" onClick={() => { onClose(); onSearch(); }}>🔍 {t('common.search')}</button>
            </div>
            <ul>
              {[...PRIMARY, ...FUN].map((l) => (
                <li key={l.to}><NavLink to={l.to} style={{ '--tag': l.color }}><b>{t(`nav.${l.key}`)}</b><small>{t(`nav.${l.key}Hint`)}</small></NavLink></li>
              ))}
              <li><NavLink to="/track" style={{ '--tag': '#a9c7ff' }}><b>{t('nav.track')}</b><small>{t('nav.trackHint')}</small></NavLink></li>
              {user && <li><NavLink to="/account/wishlist" style={{ '--tag': '#ff5a6e' }}><b>{t('nav.wishlist')}</b><small>{t('nav.wishlistHint')}</small></NavLink></li>}
            </ul>
          </motion.nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TabBar({ menuOpen, onMenu }) {
  const { t } = useI18n();
  const { user } = useApp();
  const tabs = [
    { to: '/', label: t('nav.home'), icon: Icon.home, end: true },
    { to: '/shop', label: t('nav.market'), icon: Icon.shop },
    { to: '/gift-finder', label: t('nav.finderShort'), icon: Icon.gift },
    { to: user ? '/account' : '/login', label: user ? t('nav.account') : t('common.signIn'), icon: Icon.user },
  ];
  return (
    <nav className="tabbar" aria-label={t('nav.main')}>
      {tabs.map((tb) => (
        <NavLink key={tb.label} to={tb.to} end={tb.end} className="tabbar-item" aria-label={tb.label}>{tb.icon}<span aria-hidden="true">{tb.label}</span></NavLink>
      ))}
      <button className={`tabbar-item ${menuOpen ? 'active' : ''}`} onClick={onMenu} aria-expanded={menuOpen} aria-label={t('nav.menu')}>{Icon.menu}<span aria-hidden="true">{t('nav.menu')}</span></button>
    </nav>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const loc = useLocation();
  const { t } = useI18n();
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 30);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => { setMenu(false); setSearch(false); }, [loc.pathname]);

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
            {PRIMARY.map((l, i) => (
              <NavLink key={l.to} to={l.to} className="nav-tag" style={{ '--tag': l.color, '--d': `${i * 0.12}s` }}>
                <span className="nav-tag-string" aria-hidden="true" />
                <span className="nav-tag-body">{t(`nav.${l.key}`)}</span>
              </NavLink>
            ))}
            <FunMenu />
          </nav>
          <Icons onSearch={() => setSearch(true)} />
        </div>
      </header>
      <TabBar menuOpen={menu} onMenu={() => setMenu((v) => !v)} />
      <MobileMenu open={menu} onClose={() => setMenu(false)} onSearch={() => setSearch(true)} />
      <SearchOverlay open={search} onClose={() => setSearch(false)} />
    </>
  );
}
