import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { money, pct } from '../lib.js';
import { useApp } from '../state/AppState.jsx';
import { api } from '../api/client.js';
import Art, { ProductVisual } from '../art/Art.jsx';
import { translate, useI18n } from '../i18n/index.jsx';

export function Chapter({ num, title, children, centered, eyebrow }) {
  const { t } = useI18n();
  return (
    <motion.header className={`chapter ${centered ? 'centered' : ''}`} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
      {(num || eyebrow) && <span className="num">{num ? t('home.chapter', { n: num }) : eyebrow}</span>}
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </motion.header>
  );
}

export function Reveal({ children, delay = 0, y = 30, className, as = 'div' }) {
  const M = motion[as];
  return (
    <M className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </M>
  );
}

export function Price({ price, sale, size = '' }) {
  return (
    <span className={`price ${size}`}>
      {sale != null ? (
        <>
          <span className="price-now">{money(sale)}</span>
          <s className="price-was">{money(price)}</s>
        </>
      ) : (
        <span className="price-now">{money(price)}</span>
      )}
    </span>
  );
}

export function Loader({ label = translate('common.loading') }) {
  return (
    <div className="loader" role="status">
      <div className="loader-lantern" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorNote({ error, children }) {
  if (!error) return null;
  return <div className="form-error" role="alert">{children ?? error.message}</div>;
}

export function Empty({ art = { type: 'snowglobe', c1: '#0b1430', c2: '#a9c7ff' }, title, children }) {
  return (
    <div className="empty">
      <Art art={art} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/** A product as a gift tag hanging from a ribbon. Variants: 'tag' (default), 'window' (feature), 'mini'. */
export function GiftTag({ product, variant = 'tag', index = 0, reason }) {
  const { user, toast } = useApp();
  const { t } = useI18n();
  const [wished, setWished] = useState(false);
  const discount = pct(product.price, product.salePrice);
  const soldOut = product.stock === 0;

  const wish = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return toast(t('tag.signInWish'), { icon: '💌' });
    try {
      if (wished) await api.del(`/wishlist/${product.id}`);
      else {
        const r = await api.post(`/wishlist/${product.id}`);
        if (r.achievement) toast(t('tag.achievement', { title: r.achievement.title }), { tone: 'reward', icon: '🏅' });
      }
      setWished(!wished);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };

  return (
    <motion.article className={`gift-tag gift-tag--${variant}`} style={{ '--i': index, '--tag-color': product.art?.c1 ?? '#c8102e' }}
      initial={{ opacity: 0, y: 40, rotate: index % 2 ? 2 : -2 }} whileInView={{ opacity: 1, y: 0, rotate: 0 }}
      viewport={{ once: true, margin: '-30px' }} transition={{ duration: 0.8, delay: (index % 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}>
      <Link to={`/product/${product.slug}`} className="gift-tag-link">
        <span className="gift-tag-string" aria-hidden="true" />
        <div className="gift-tag-card">
          <span className="gift-tag-hole" aria-hidden="true" />
          <div className="gift-tag-visual">
            <motion.div layoutId={variant === 'mini' ? undefined : `visual-${product.slug}`} className="gift-tag-art">
              <ProductVisual product={product} />
            </motion.div>
            <div className="gift-tag-badges">
              {product.isLimited && <span className="badge badge-gold">{t('common.limited')}</span>}
              {discount > 0 && <span className="badge badge-red">−{discount}%</span>}
              {product.isMagic && <span className="badge badge-blue">{t('common.magic')}</span>}
              {soldOut && <span className="badge badge-test">{t('common.soldOut')}</span>}
            </div>
            {product.match != null && <span className="gift-tag-match">{t('common.match', { n: product.match })}</span>}
          </div>
          <div className="gift-tag-text">
            {product.category && variant !== 'mini' && <span className="eyebrow">{product.category.name}</span>}
            <h3>{product.name}</h3>
            {variant !== 'mini' && product.subtitle && <p className="gift-tag-sub">{product.subtitle}</p>}
            {(reason || product.reasons?.[0]) && <p className="gift-tag-reason">✦ {reason ?? product.reasons[0]}</p>}
            <div className="gift-tag-foot">
              <Price price={product.price} sale={product.salePrice} />
              <button className={`wish-btn ${wished ? 'on' : ''}`} onClick={wish} aria-label={wished ? t('tag.removeWish') : t('tag.addWish')} aria-pressed={wished}>
                <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
              </button>
            </div>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

export function Ribbon({ children, className = '' }) {
  return (
    <div className={`tag-ribbon ${className}`}>
      <svg className="tag-ribbon-line" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 10 Q 250 50 500 18 T 1000 10" stroke="var(--ember)" strokeWidth="4" fill="none" />
      </svg>
      <div className="tag-ribbon-row">{children}</div>
    </div>
  );
}
