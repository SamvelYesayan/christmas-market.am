// App-wide chrome: sleigh (cart drawer), footer, toasts, consent, fly-to-sleigh effect, hidden wonders, intro.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../state/AppState.jsx';
import { api } from '../api/client.js';
import { LoadError } from './Common.jsx';
import { money } from '../lib.js';
import { ProductVisual } from '../art/Art.jsx';
import { Village } from '../art/Scenes.jsx';
import SnowCap from '../effects/SnowCap.jsx';
import { celebrate } from '../effects/celebrate.js';
import { useI18n } from '../i18n/index.jsx';
import { getIntroPref, setIntroPref } from '../effects/introPrefs.js';

export function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} className={`toast ${t.tone}`} initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}>
            {t.icon && <span className="ico" aria-hidden="true">{t.icon}</span>}
            <span>{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function SleighDrawer() {
  const { cart, setCart, cartError, refreshCart, cartOpen, setCartOpen, toast } = useApp();
  const { t } = useI18n();
  const nav = useNavigate();
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setCartOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCartOpen]);
  const update = async (id, quantity) => {
    try {
      setCart(quantity > 0 ? await api.patch(`/cart/items/${id}`, { quantity }) : await api.del(`/cart/items/${id}`));
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };
  const freeLeft = cart.freeShippingOver ? cart.freeShippingOver - cart.subtotal : null;
  return (
    <AnimatePresence>
      {cartOpen && (
        <motion.div className="drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCartOpen(false)}>
          <motion.aside className="drawer" role="dialog" aria-label={t('sleigh.title')} onClick={(e) => e.stopPropagation()}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 240 }}>
            <header className="drawer-head">
              <div>
                <span className="eyebrow">{t('sleigh.title')}</span>
                <h3>{cart.count ? (cart.count > 1 ? t('sleigh.aboard', { n: cart.count }) : t('sleigh.aboardOne')) : t('sleigh.waiting')}</h3>
              </div>
              <button className="nav-ico" onClick={() => setCartOpen(false)} aria-label={t('common.close')}><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
            </header>
            {cart.items.length === 0 && cartError ? <LoadError error={cartError} onRetry={() => refreshCart().catch(() => {})} /> : cart.items.length === 0 ? (
              <div className="drawer-empty">
                <svg viewBox="0 0 200 120" className="drawer-sleigh" aria-hidden="true">
                  <path d="M30 50 h100 q22 0 30 26 l4 18 h-124 q-12 0 -12 -16z" fill="#c8102e" />
                  <path d="M20 106 h150 q18 0 16 -16" stroke="#f2c46d" strokeWidth="5" fill="none" strokeLinecap="round" />
                </svg>
                <p className="muted">{t('sleigh.impatient')}</p>
                <button className="btn" onClick={() => { setCartOpen(false); nav('/shop'); }}>{t('common.visitMarket')}</button>
              </div>
            ) : (
              <>
                <ul className="drawer-items">
                  {cart.items.map((it) => (
                    <li key={it.id} className="drawer-item">
                      <Link to={`/product/${it.slug}`} className="drawer-thumb" onClick={() => setCartOpen(false)}><ProductVisual product={{ art: it.art, image: it.image, name: it.name }} /></Link>
                      <div>
                        <b>{it.name}</b>
                        <small className="muted">{it.variantName}{it.personalization ? ` · “${it.personalization}”` : ''}</small>
                        <div className="qty">
                          <button onClick={() => update(it.id, it.quantity - 1)} aria-label={t('sleigh.less')}>−</button>
                          <span>{it.quantity}</span>
                          <button onClick={() => update(it.id, it.quantity + 1)} aria-label={t('sleigh.more')} disabled={it.quantity >= it.stock}>+</button>
                        </div>
                      </div>
                      <span className="drawer-line-total">{money(it.total)}</span>
                    </li>
                  ))}
                </ul>
                <footer className="drawer-foot">
                  {freeLeft > 0 && <p className="free-ship">{t('sleigh.freeLeft', { amount: money(freeLeft) })}</p>}
                  {cart.pioneerDiscount > 0 && <p className="row between"><span>{t('sleigh.pioneer')}</span><span className="gold">−{money(cart.pioneerDiscount)}</span></p>}
                  {cart.discount > 0 && <p className="row between"><span>{t('sleigh.code', { code: cart.coupon?.code })}</span><span className="gold">−{money(cart.discount)}</span></p>}
                  <p className="row between drawer-total"><span>{t('sleigh.subtotal')}</span><b>{money(cart.subtotal - cart.discount - cart.pioneerDiscount)}</b></p>
                  <button className="btn btn-block" onClick={() => { setCartOpen(false); nav('/checkout'); }}>{t('sleigh.checkout')}</button>
                  <button className="btn btn-ghost btn-block" onClick={() => { setCartOpen(false); nav('/cart'); }}>{t('sleigh.view')}</button>
                </footer>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** A tiny gift that flies from the add-to-cart button to the sleigh icon. */
export function FlyToSleigh() {
  const [flights, setFlights] = useState([]);
  useEffect(() => {
    const on = (e) => {
      if (document.documentElement.classList.contains('calm')) return;
      const from = e.detail?.from;
      const target = [...document.querySelectorAll('[data-sleigh]')].find((el) => el.offsetParent !== null)?.getBoundingClientRect(); // the visible cart button (top bar or tab bar)
      if (!from || !target) return;
      const id = Math.random();
      setFlights((f) => [...f, { id, x: from.left + from.width / 2, y: from.top + from.height / 2, tx: target.left + target.width / 2, ty: target.top + target.height / 2 }]);
      setTimeout(() => setFlights((f) => f.filter((x) => x.id !== id)), 900);
    };
    window.addEventListener('mc:fly-to-sleigh', on);
    return () => window.removeEventListener('mc:fly-to-sleigh', on);
  }, []);
  return flights.map((f) => (
    <motion.div key={f.id} className="flying-gift" initial={{ x: f.x - 14, y: f.y - 14, scale: 1, rotate: 0 }}
      animate={{ x: [f.x - 14, (f.x + f.tx) / 2, f.tx - 14], y: [f.y - 14, Math.min(f.y, f.ty) - 120, f.ty - 14], scale: [1, 1.3, 0.4], rotate: 360 }}
      transition={{ duration: 0.85, ease: 'easeInOut' }}>
      🎁
    </motion.div>
  ));
}

export function ConsentBar() {
  const { consent, setConsent } = useApp();
  const { t } = useI18n();
  if (consent) return null;
  return (
    <motion.div className="consent panel" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 2 }} role="dialog" aria-label={t('consent.label')}>
      <p><b>{t('consent.title')}</b> {t('consent.body')}</p>
      <div className="row">
        <button className="btn btn-ghost btn-sm" onClick={() => setConsent({ analytics: false, at: Date.now() })}>{t('consent.essential')}</button>
        <button className="btn btn-sm" onClick={() => setConsent({ analytics: true, at: Date.now() })}>{t('consent.allow')}</button>
      </div>
    </motion.div>
  );
}

/** A small glimmering object hidden somewhere in the village. */
export function HiddenWonder({ id, style }) {
  const { user, toast, rewardCelebration } = useApp();
  const { t } = useI18n();
  const [found, setFound] = useState(false);
  const find = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (found) return;
    celebrate({ intensity: 0.5, palette: 'gold', origin: { x: e.clientX, y: e.clientY } });
    if (!user) return toast(t('hidden.signIn'), { icon: '✨' });
    try {
      const r = await api.post(`/hidden/${id}/find`);
      setFound(true);
      if (r.alreadyFound) toast(t('hidden.already', { name: r.name }), { icon: '✨' });
      else {
        rewardCelebration(r.reward, r.achievement);
        toast(t('hidden.progress', { found: r.found, total: r.total }), { icon: '🔍' });
      }
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };
  return (
    <button className={`hidden-wonder ${found ? 'found' : ''}`} style={style} onClick={find} aria-label={t('hidden.label')}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" /></svg>
    </button>
  );
}

export function Footer({ onReplayIntro }) {
  const { calm, setCalm } = useApp();
  const { t } = useI18n();
  const [introPref, setPref] = useState(getIntroPref);
  const choose = (v) => { setIntroPref(v); setPref(v); };
  return (
    <footer className="footer">
      <SnowCap variant={1} />
      <div className="footer-village"><Village /></div>
      <div className="footer-body wrap">
        <div className="footer-brand">
          <p className="script footer-sign">{t('footer.sign')}</p>
          <p className="muted">{t('footer.about')}</p>
          <div className="row">
            <button className="chip" onClick={() => setCalm(!calm)} aria-pressed={calm}>{calm ? t('common.calmOn') : t('common.calmOff')}</button>
            <button className="chip" onClick={onReplayIntro}>🛷 {t('footer.replayIntro')}</button>
          </div>
          <label className="footer-intro">
            <span className="label">{t('footer.introSettings')}</span>
            <select className="input" value={introPref} onChange={(e) => choose(e.target.value)}>
              <option value="auto">{t('footer.introFull')} → {t('footer.introShort')}</option>
              <option value="full">{t('footer.introFull')}</option>
              <option value="short">{t('footer.introShort')}</option>
              <option value="off">{t('footer.introOff')}</option>
            </select>
          </label>
        </div>
        <nav className="footer-cols" aria-label={t('footer.help')}>
          <div><h4>{t('footer.market')}</h4><Link to="/shop">{t('footer.allStalls')}</Link><Link to="/shop/limited">{t('footer.limited')}</Link><Link to="/gift-finder">{t('footer.finder')}</Link><Link to="/shop?onSale=true">{t('footer.offers')}</Link></div>
          <div><h4>{t('footer.magic')}</h4><Link to="/academy">{t('footer.academy')}</Link><Link to="/advent">{t('footer.advent')}</Link><Link to="/games">{t('footer.games')}</Link><Link to="/pioneer">{t('footer.pioneer')}</Link></div>
          <div><h4>{t('footer.help')}</h4><Link to="/track">{t('footer.track')}</Link><Link to="/info/delivery">{t('footer.delivery')}</Link><Link to="/info/privacy">{t('footer.privacy')}</Link><Link to="/info/terms">{t('footer.terms')}</Link></div>
        </nav>
        <div className="footer-letter">
          <h4>{t('footer.visit')}</h4>
          <p className="muted">{t('footer.address')}<br />{t('footer.hours')}</p>
          <a className="link" href="mailto:hello@christmas-market.am">hello@christmas-market.am</a>
        </div>
      </div>
      <div className="footer-base wrap"><span>© {new Date().getFullYear()} {t('brand.name')} · christmas-market.am</span><span>{t('footer.prices')}</span></div>
    </footer>
  );
}
