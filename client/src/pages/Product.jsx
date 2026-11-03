// The Workshop Window — product detail.
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { money, pct, useAsync } from '../lib.js';
import Art, { ProductVisual } from '../art/Art.jsx';
import { Chapter, Empty, GiftTag, Loader, Price, Ribbon } from '../components/Common.jsx';
import { celebrate } from '../effects/celebrate.js';
import { useI18n } from '../i18n/index.jsx';

const ANGLES = [
  { glow: true, bg: 'radial-gradient(circle at 50% 40%, rgba(242,196,109,0.25), transparent 60%)' },
  { glow: false, bg: 'radial-gradient(circle at 30% 70%, rgba(169,199,255,0.25), transparent 60%)', rotate: -8, scale: 0.9 },
  { glow: true, bg: 'radial-gradient(circle at 70% 30%, rgba(200,16,46,0.25), transparent 60%)', rotate: 6, scale: 1.1 },
];

function Reviews({ product, onPosted }) {
  const { user, toast } = useApp();
  const { t } = useI18n();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post(`/products/${product.slug}/reviews`, { rating, body });
      toast(r.message, { icon: '✉️' });
      setBody('');
      onPosted?.();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="product-reviews">
      <h3>{t('product.guestbook')}</h3>
      {product.reviews.length === 0 && <p className="muted">{t('product.noReviews')}</p>}
      {product.reviews.map((r, i) => (
        <figure key={i} className="review">
          <span className="stars">{'★'.repeat(r.rating)}<span className="muted">{'★'.repeat(5 - r.rating)}</span></span>
          <blockquote>{r.body}</blockquote>
          <figcaption className="muted">— {r.author}{r.city ? `, ${r.city}` : ''}</figcaption>
        </figure>
      ))}
      {user ? (
        <form onSubmit={submit} className="review-form">
          <div className="row" role="radiogroup" aria-label={t('product.rating')}>
            {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} className={`star-btn ${n <= rating ? 'on' : ''}`} onClick={() => setRating(n)} aria-label={t('product.stars', { n })}>★</button>)}
          </div>
          <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} minLength={10} maxLength={1500} required placeholder={t('product.reviewPh')} />
          <button className="btn btn-sm" disabled={busy}>{t('product.sign')}</button>
        </form>
      ) : <p className="muted"><Link className="link" to="/login">{t('common.signIn')}</Link>{t('product.signInReview')}</p>}
    </div>
  );
}

export default function Product() {
  const { slug } = useParams();
  const { addToCart, toast, user, setCartOpen } = useApp();
  const { t } = useI18n();
  const [reload, setReload] = useState(0);
  const [state] = useAsync(() => api.get(`/products/${slug}`), [slug, reload]);
  const [variantId, setVariantId] = useState(null);
  const [qty, setQty] = useState(1);
  const [angle, setAngle] = useState(0);
  const [personalization, setPersonalization] = useState('');
  const [busy, setBusy] = useState(false);
  const [wished, setWished] = useState(false);
  const [unwrapped, setUnwrapped] = useState(false);
  const btnRef = useRef(null);
  const p = state.data?.product;

  useEffect(() => {
    if (!p) return;
    setVariantId(p.variants.find((v) => v.stock > 0)?.id ?? p.variants[0]?.id);
    setWished(p.wished);
    setAngle(0);
    setQty(1);
    document.title = `${p.name} · ${t('brand.name')}`;
    const timer = setTimeout(() => setUnwrapped(true), 60);
    return () => { clearTimeout(timer); setUnwrapped(false); };
  }, [p]);

  if (state.loading && !p) return <Loader label={t('product.unwrapping')} />;
  if (state.error) return <div className="wrap"><Empty title={t('product.wandered')}>{state.error.message}<p><Link className="btn" to="/shop">{t('common.backToMarket')}</Link></p></Empty></div>;

  const variant = p.variants.find((v) => v.id === variantId) ?? p.variants[0];
  const unit = (p.salePrice ?? p.price) + (variant?.priceDelta ?? 0);
  const compare = p.salePrice != null ? p.price + (variant?.priceDelta ?? 0) : null;
  const gallery = p.images.length ? p.images.map((img) => ({ img })) : ANGLES;
  const optionKey = variant && Object.keys(variant.options).find((k) => k !== 'hex');

  const add = async () => {
    if (!variant) return;
    setBusy(true);
    try {
      await addToCart(variant.id, qty, p.isPersonalizable ? personalization.trim() : undefined, btnRef.current);
      toast(t('sleigh.added', { name: p.name }), { icon: '🛷' });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  const wish = async () => {
    if (!user) return toast(t('product.signInWish'), { icon: '💌' });
    try {
      if (wished) await api.del(`/wishlist/${p.id}`);
      else {
        await api.post(`/wishlist/${p.id}`);
        celebrate({ intensity: 0.4, palette: 'gold' });
      }
      setWished(!wished);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };

  return (
    <div className="product">
      <div className="wrap">
        <nav className="crumbs" aria-label={t('product.market')}><Link to="/shop">{t('product.market')}</Link> / {p.category && <Link to={`/shop/${p.category.slug}`}>{p.category.name}</Link>} / <span>{p.name}</span></nav>
        <div className="product-grid">
          <div className="window-frame">
            <div className="window-arch">
              <div className="window-frost" aria-hidden="true" />
              <AnimatePresence mode="wait">
                <motion.div key={angle} className="window-stage" style={{ background: gallery[angle].bg }}
                  initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.5 }}>
                  <motion.div layoutId={`visual-${p.slug}`} className="window-art" style={{ rotate: gallery[angle].rotate ?? 0, scale: gallery[angle].scale ?? 1 }}>
                    {gallery[angle].img ? <img src={gallery[angle].img.url} alt={gallery[angle].img.alt ?? p.name} className="product-photo" /> : <Art art={p.art} glow={gallery[angle].glow} title={p.name} />}
                  </motion.div>
                </motion.div>
              </AnimatePresence>
              {/* gift wrap that tears open on arrival */}
              <div className={`wrap-paper ${unwrapped ? 'open' : ''}`} aria-hidden="true"><span /><span /><i /></div>
            </div>
            <div className="window-panes" role="tablist" aria-label={t('product.gallery')}>
              {gallery.map((g, i) => (
                <button key={i} role="tab" aria-selected={angle === i} className={`pane ${angle === i ? 'on' : ''}`} onClick={() => setAngle(i)}>
                  {g.img ? <img src={g.img.url} alt="" /> : <Art art={p.art} glow={false} />}
                </button>
              ))}
            </div>
          </div>

          <div className="product-info">
            <div className="row">
              {p.isLimited && <span className="badge badge-gold">{t('product.limited')}</span>}
              {p.isMagic && <span className="badge badge-blue">{t('product.magical')}</span>}
              {pct(p.price, p.salePrice) > 0 && <span className="badge badge-red">{t('product.save', { n: pct(p.price, p.salePrice) })}</span>}
            </div>
            <h1 className="product-title">{p.name}</h1>
            {p.subtitle && <p className="product-sub">{p.subtitle}</p>}
            <div className="row product-price-row">
              <Price price={compare ?? unit} sale={compare != null ? unit : null} size="lg" />
              {p.rating && <span className="stars">{'★'.repeat(Math.round(p.rating))} <small className="muted">{p.rating}</small></span>}
            </div>
            <p>{p.description}</p>

            {p.variants.length > 1 && (
              <fieldset className="seals">
                <legend className="label">{optionKey ? t(`product.option_${optionKey}`) : t('product.choose')}</legend>
                <div className="row">
                  {p.variants.map((v) => (
                    <button key={v.id} className={`seal ${v.id === variantId ? 'on' : ''}`} onClick={() => setVariantId(v.id)} disabled={v.stock === 0} style={{ '--sw': v.options.hex ?? 'var(--ember)' }} aria-pressed={v.id === variantId}>
                      {v.options.hex && <span className="seal-swatch" />}
                      {v.name}
                      {v.priceDelta > 0 && <small>+{money(v.priceDelta)}</small>}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {p.isPersonalizable && (
              <div className="field">
                <label htmlFor="pers">{t('product.personal')}</label>
                <input id="pers" value={personalization} onChange={(e) => setPersonalization(e.target.value.slice(0, 60))} placeholder={t('product.personalPh')} />
                <span className="hint">{t('product.personalHint')}</span>
              </div>
            )}

            <p className={`stock ${variant?.stock < 6 ? 'low' : ''}`}>
              {variant?.stock === 0 ? t('product.soldOut') : variant?.stock < 6 ? t('product.low', { n: variant.stock }) : t('product.inStock')}
            </p>

            <div className="buy-row">
              <div className="qty qty-lg">
                <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label={t('sleigh.less')}>−</button>
                <span>{qty}</span>
                <button onClick={() => setQty(Math.min(variant?.stock ?? 1, qty + 1))} aria-label={t('sleigh.more')}>+</button>
              </div>
              <button ref={btnRef} className="btn btn-red buy-btn" onClick={add} disabled={busy || !variant || variant.stock === 0}>
                {busy ? t('product.packing') : t('product.add', { amount: money(unit * qty) })}
              </button>
              <button className={`wish-btn wish-lg ${wished ? 'on' : ''}`} onClick={wish} aria-label={t('product.wishlist')} aria-pressed={wished}>
                <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
              </button>
            </div>
            <button className="link" onClick={() => setCartOpen(true)}>{t('product.viewSleigh')}</button>

            {p.story && (
              <aside className="product-story">
                <span className="script">{t('product.story')}</span>
                <p>{p.story}</p>
              </aside>
            )}
            <ul className="product-promises">
              <li>{t('product.promise1')}</li>
              <li>{t('product.promise2')}</li>
              <li>{t('product.promise3')}</li>
            </ul>
          </div>
        </div>
        <Reviews product={p} onPosted={() => setReload((n) => n + 1)} />
      </div>
      {state.data.related.length > 0 && (
        <section className="section">
          <div className="wrap"><Chapter eyebrow={t('product.sameWorkshop')} title={t('product.alsoWish')} /></div>
          <Ribbon>{state.data.related.map((r, i) => <GiftTag key={r.slug} product={r} index={i} />)}</Ribbon>
        </section>
      )}
    </div>
  );
}
