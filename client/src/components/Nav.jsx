// Desktop: plain links (Home, Shop, Categories, Offers, Pioneer Card, More) with search, account and cart on the right.
// Phone/tablet: a slim top bar (brand, music, search, menu) plus bottom tabs for what people need most:
// Home, Shop, Cart, Pioneer Card, Account. The mobile app uses the same five tabs.
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api/client.js';
import { useAsync } from '../lib.js';
import { useApp } from '../state/AppState.jsx';
import { LangSwitch, useI18n } from '../i18n/index.jsx';
import MusicPlayer from './MusicPlayer.jsx';

// Everything beyond shopping lives under "More", so it never competes with the shop.
const MORE = [
  { to: '/gift-finder', key: 'finder' },
  { to: '/advent', key: 'advent' },
  { to: '/games', key: 'games' },
  { to: '/academy', key: 'academy' },
  { to: '/track', key: 'track' },
];
const OFFERS = '/shop?onSale=true';

const Icon = {
  search: <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>,
  user: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>,
  sleigh: <svg viewBox="0 0 24 24"><path d="M3 8h11a4 4 0 0 1 4 4v3H5a2 2 0 0 1-2-2z" /><path d="M2 19h17a3 3 0 0 0 3-3" /><path d="M7 15v4M15 15v4" /></svg>,
  home: <svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9H4z" /><path d="M10 20v-5h4v5" /></svg>,
  shop: <svg viewBox="0 0 24 24"><path d="M4 9h16l-1.5 11h-13z" /><path d="M8 9V7a4 4 0 0 1 8 0v2" /></svg>,
  gift: <svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="11" rx="1.5" /><path d="M3 13h18M12 9v11" /><path d="M12 9c-2-4-6-4-6-1.5S9 9 12 9c3 0 6-.5 6-1.5S14 5 12 9z" /></svg>,
  card: <svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></svg>,
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

function CartButton({ className = 'nav-cart', children }) {
  const { cart, setCartOpen } = useApp();
  const { t } = useI18n();
  return (
    <button className={className} onClick={() => setCartOpen(true)} aria-label={t('nav.sleighItems', { n: cart.count })} data-sleigh>
      <span className="nav-cart-icon">
        {Icon.sleigh}
        {cart.count > 0 && <motion.span key={cart.count} className="nav-count" initial={{ scale: 0.4 }} animate={{ scale: 1 }}>{cart.count}</motion.span>}
      </span>
      {children}
    </button>
  );
}

function Icons({ onSearch, onMenu, menuOpen }) {
  const { user } = useApp();
  const { t } = useI18n();
  return (
    <div className="nav-icons">
      <LangSwitch className="hide-lg" />
      <MusicPlayer />
      <button className="nav-ico" onClick={onSearch} aria-label={t('nav.search')}>{Icon.search}</button>
      <Link className="nav-account hide-md" to={user ? '/account' : '/login'}>
        {Icon.user}<span>{user ? t('nav.account') : t('common.signIn')}</span>
      </Link>
      <CartButton className="nav-cart hide-md"><span>{t('nav.cart')}</span></CartButton>
      <button className="nav-ico show-md" onClick={onMenu} aria-expanded={menuOpen} aria-label={t('nav.menu')}>{Icon.menu}</button>
    </div>
  );
}

/** A plain dropdown in the desktop navigation. */
function Dropdown({ label, active, wide, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname, loc.search]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="nav-drop" ref={ref}>
      <button className={`nav-link ${active ? 'active' : ''}`} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((v) => !v)}>
        {label} <span className="nav-caret" aria-hidden="true">▾</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className={`nav-drop-menu ${wide ? 'wide' : ''}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function useCategories() {
  const { lang } = useI18n();
  const [state] = useAsync(() => api.get('/categories'), [lang]);
  return state.data?.categories ?? [];
}

function MainLinks({ cats }) {
  const { t } = useI18n();
  const loc = useLocation();
  const onOffers = loc.pathname === '/shop' && new URLSearchParams(loc.search).has('onSale');
  const inMore = MORE.some((l) => loc.pathname.startsWith(l.to));
  return (
    <nav className="nav-links" aria-label={t('nav.main')}>
      <NavLink to="/" end className="nav-link">{t('nav.home')}</NavLink>
      <Link to="/shop" className={`nav-link ${loc.pathname === '/shop' && !onOffers ? 'active' : ''}`}>{t('nav.market')}</Link>
      <Dropdown label={t('nav.categories')} active={loc.pathname.startsWith('/shop/')} wide>
        <Link className="nav-drop-all" to="/shop">{t('shop.allStalls')}</Link>
        <ul className="nav-drop-cats">
          {cats.map((c) => <li key={c.slug}><NavLink to={`/shop/${c.slug}`}>{c.name}</NavLink></li>)}
        </ul>
      </Dropdown>
      <Link to={OFFERS} className={`nav-link ${onOffers ? 'active' : ''}`}>{t('nav.offers')}</Link>
      <NavLink to="/pioneer" className="nav-link">{t('nav.pioneer')}</NavLink>
      <Dropdown label={t('nav.more')} active={inMore}>
        <ul className="nav-drop-list">
          {MORE.map((l) => <li key={l.to}><NavLink to={l.to}><b>{t(`nav.${l.key}`)}</b><small>{t(`nav.${l.key}Hint`)}</small></NavLink></li>)}
        </ul>
        <div className="nav-drop-lang show-lg"><LangSwitch /></div>
      </Dropdown>
    </nav>
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

function MobileMenu({ open, onClose, cats }) {
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
            <div className="mobile-menu-top"><b>{t('nav.menu')}</b><LangSwitch /></div>
            <h3 className="mobile-menu-h">{t('nav.categories')}</h3>
            <div className="mobile-menu-cats">
              <Link className="chip" to="/shop" onClick={onClose}>{t('shop.allStalls')}</Link>
              {cats.map((c) => <Link key={c.slug} className="chip" to={`/shop/${c.slug}`} onClick={onClose}>{c.name}</Link>)}
            </div>
            <ul>
              <li><Link to={OFFERS} onClick={onClose}><b>{t('nav.offers')}</b><small>{t('nav.offersHint')}</small></Link></li>
              {MORE.map((l) => <li key={l.to}><NavLink to={l.to} onClick={onClose}><b>{t(`nav.${l.key}`)}</b><small>{t(`nav.${l.key}Hint`)}</small></NavLink></li>)}
              {user && <li><NavLink to="/account/wishlist" onClick={onClose}><b>{t('nav.wishlist')}</b><small>{t('nav.wishlistHint')}</small></NavLink></li>}
            </ul>
          </motion.nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TabBar() {
  const { t } = useI18n();
  const { user } = useApp();
  return (
    <nav className="tabbar" aria-label={t('nav.main')}>
      <NavLink to="/" end className="tabbar-item">{Icon.home}<span>{t('nav.home')}</span></NavLink>
      <NavLink to="/shop" className="tabbar-item">{Icon.shop}<span>{t('nav.market')}</span></NavLink>
      <CartButton className="tabbar-item"><span>{t('nav.cart')}</span></CartButton>
      <NavLink to="/pioneer" className="tabbar-item">{Icon.card}<span>{t('nav.pioneerShort')}</span></NavLink>
      <NavLink to={user ? '/account' : '/login'} className="tabbar-item">{Icon.user}<span>{user ? t('nav.accountShort') : t('common.signIn')}</span></NavLink>
    </nav>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const loc = useLocation();
  const { t } = useI18n();
  const cats = useCategories();
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 30);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => { setMenu(false); setSearch(false); }, [loc.pathname, loc.search]);

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
          <MainLinks cats={cats} />
          <Icons onSearch={() => setSearch(true)} onMenu={() => setMenu((v) => !v)} menuOpen={menu} />
        </div>
      </header>
      <TabBar />
      <MobileMenu open={menu} onClose={() => setMenu(false)} cats={cats} />
      <SearchOverlay open={search} onClose={() => setSearch(false)} />
    </>
  );
}
