import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { money } from '../lib.js';
import { ProductVisual } from '../art/Art.jsx';
import { Empty, LoadError } from '../components/Common.jsx';
import { useI18n } from '../i18n/index.jsx';

export function CouponBox() {
  const { cart, setCart, toast } = useApp();
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const apply = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      setCart(await api.post('/cart/coupon', { code: code.trim() }));
      setCode('');
      toast(t('cart.applied'), { tone: 'reward' });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  if (cart.coupon) {
    return (
      <div className="coupon-applied">
        <span>🎟 <b>{cart.coupon.code}</b> {cart.coupon.description && <small className="muted">· {cart.coupon.description}</small>}</span>
        <button className="link" onClick={async () => setCart(await api.del('/cart/coupon'))}>{t('common.remove')}</button>
      </div>
    );
  }
  return (
    <form className="coupon-form" onSubmit={apply}>
      <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t('cart.codePh')} aria-label={t('cart.codeAria')} />
      <button className="btn btn-ghost btn-sm" disabled={busy || code.trim().length < 3}>{t('common.apply')}</button>
      {cart.couponError && <p className="field err">{cart.pendingCoupon}: {cart.couponError}</p>}
    </form>
  );
}

export function Totals({ quote, showShipping = false }) {
  const { t } = useI18n();
  return (
    <dl className="totals">
      <div><dt>{t('cart.gifts')}</dt><dd>{money(quote.subtotal)}</dd></div>
      {quote.discount > 0 && <div className="gold"><dt>{t('cart.code', { code: quote.coupon?.code })}</dt><dd>−{money(quote.discount)}</dd></div>}
      {quote.pioneerDiscount > 0 && <div className="gold"><dt>{t('cart.pioneerPct', { p: quote.pioneerPercent })}</dt><dd>−{money(quote.pioneerDiscount)}</dd></div>}
      {showShipping && <div><dt>{t('cart.delivery')}</dt><dd>{quote.shipping === 0 ? t('common.free') : money(quote.shipping)}</dd></div>}
      <div className="totals-grand"><dt>{t('common.total')}</dt><dd>{money(showShipping ? quote.total : quote.subtotal - quote.discount - quote.pioneerDiscount)}</dd></div>
    </dl>
  );
}

export default function Cart() {
  const { cart, setCart, cartError, refreshCart, toast, user, pioneerStatus } = useApp();
  const { t } = useI18n();
  useEffect(() => { document.title = `${t('cart.title')} · ${t('brand.name')}`; }, [t]);
  const update = async (id, quantity) => {
    try {
      setCart(quantity > 0 ? await api.patch(`/cart/items/${id}`, { quantity }) : await api.del(`/cart/items/${id}`));
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };
  if (!cart.items.length && cartError) return <div className="wrap"><LoadError error={cartError} onRetry={() => refreshCart().catch(() => {})} /></div>;
  if (!cart.items.length) {
    return <div className="wrap"><Empty art={{ type: 'sleigh', c1: '#c8102e' }} title={t('cart.empty')}><p className="muted">{t('cart.emptyBody')}</p><Link className="btn" to="/shop">{t('common.visitMarket')}</Link></Empty></div>;
  }
  return (
    <div className="wrap cart-page">
      <header className="page-head"><span className="eyebrow">{t('cart.eyebrow')}</span><h1>{t('cart.h1a')} <em>{t('cart.h1b')}</em></h1></header>
      <div className="cart-grid">
        <ul className="cart-lines">
          {cart.items.map((it) => (
            <li key={it.id} className="cart-line">
              <Link to={`/product/${it.slug}`} className="cart-thumb"><ProductVisual product={{ art: it.art, image: it.image, name: it.name }} /></Link>
              <div className="cart-line-info">
                <Link to={`/product/${it.slug}`}><h3>{it.name}</h3></Link>
                <p className="muted">{it.variantName}{it.personalization ? ` · ${t('cart.personalised', { text: it.personalization })}` : ''}</p>
                <p className="muted">{t('cart.each', { amount: money(it.unitPrice) })} {it.compareAt && <s>{money(it.compareAt)}</s>}</p>
                {it.quantity > it.stock && <p className="field err">{t('cart.onlyLeft', { n: it.stock })}</p>}
              </div>
              <div className="qty">
                <button onClick={() => update(it.id, it.quantity - 1)} aria-label={t('sleigh.less')}>−</button>
                <span>{it.quantity}</span>
                <button onClick={() => update(it.id, it.quantity + 1)} disabled={it.quantity >= it.stock} aria-label={t('sleigh.more')}>+</button>
              </div>
              <b className="cart-line-total">{money(it.total)}</b>
              <button className="link" onClick={() => update(it.id, 0)}>{t('common.remove')}</button>
            </li>
          ))}
        </ul>
        <aside className="cart-summary panel pad">
          <h3>{t('cart.summary')}</h3>
          <CouponBox />
          <Totals quote={cart} />
          {!cart.hasPioneer && pioneerStatus?.available && (
            <p className="muted small-note">{t('cart.pioneerHint', { p: pioneerStatus.discountPercent })} <Link className="link" to="/pioneer">{t('cart.linkCard')}</Link></p>
          )}
          <p className="muted small-note">{t('cart.shippingNote')}</p>
          <Link className="btn btn-red btn-block" to="/checkout">{t('cart.checkout')}</Link>
          {!user && <p className="muted small-note"><Link className="link" to="/login?next=/checkout">{t('common.signIn')}</Link>{t('cart.guestNote')}</p>}
        </aside>
      </div>
    </div>
  );
}
