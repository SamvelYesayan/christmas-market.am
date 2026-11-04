// Magical Pioneer Card — what membership gives you and how to connect your card.
// Connecting and the live card dashboard live in the account ("My Pioneer Card").
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { useAsync } from '../lib.js';
import { Price } from '../components/Common.jsx';
import { HiddenWonder } from '../components/Shell.jsx';
import { ProductVisual } from '../art/Art.jsx';
import { CardVisual } from '../components/PioneerCard.jsx';
import { useI18n } from '../i18n/index.jsx';

function MemberOffers() {
  const { t } = useI18n();
  const [offers] = useAsync(() => api.get('/pioneer/offers'), []);
  const list = offers.data?.offers ?? [];
  if (!list.length) return null;
  return (
    <section className="section">
      <h2>{t('pc.offersTitle')}</h2>
      <p className="muted">{t('pc.offersBody')}</p>
      <div className="reward-shop">
        {list.map((o, i) => (
          <motion.article key={o.id} className="reward-item" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
            <div className="reward-art">{o.product ? <ProductVisual product={o.product} /> : <span className="reward-pct">{o.discountPercent ?? '✦'}{o.discountPercent ? '%' : ''}</span>}</div>
            <div className="reward-text">
              <span className="eyebrow">{o.kind === 'discount' ? t('pioneer.kindDiscount') : o.kind === 'redeem_gift' ? t('pioneer.kindGift') : t('pioneer.kindExclusive')}</span>
              <h3>{o.title}</h3>
              {o.description && <p className="muted">{o.description}</p>}
              {o.product && <Price price={o.product.price} sale={o.product.salePrice} />}
            </div>
            <div className="reward-cta">
              {o.product ? <Link className="btn btn-sm btn-ghost" to={`/product/${o.product.slug}`}>{t('pioneer.seeFirst')}</Link> : <span className="muted">{t('pioneer.membersOnly')}</span>}
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

export default function Pioneer() {
  const { user, pioneerStatus } = useApp();
  const { t } = useI18n();
  useEffect(() => { document.title = `${t('pc.pageTitle')} · ${t('brand.name')}`; }, [t]);
  const p = pioneerStatus?.discountPercent ?? 5;
  const linked = !!user?.pioneer;
  const cta = linked ? t('pc.goToCard') : t('pc.connect');
  const to = user ? '/account/pioneer' : '/login?next=/account/pioneer';
  return (
    <div className="lodge">
      <HiddenWonder id="compass-star" style={{ right: '8%', top: '18%' }} />
      <div className="wrap">
        <section className="pc-landing">
          <div className="pc-intro">
            <span className="eyebrow">{t('pc.pageEyebrow')}</span>
            <h1>{t('pc.pageTitle')}</h1>
            <p className="muted">{t('pc.pageIntro', { p })}</p>
            <ul className="pc-benefits">
              <li>{t('pc.benefit1', { p })}</li>
              <li>{t('pc.benefit2')}</li>
              <li>{t('pc.benefit3')}</li>
            </ul>
            <Link className="btn" to={to}>{cta}</Link>
          </div>
          <CardVisual masked={linked ? user.pioneer.cardMasked : null} holder={linked ? user.pioneer.holderName : null} empty={!linked} />
        </section>
        {!linked && (
          <section className="section">
            <h2>{t('pc.howTitle')}</h2>
            <ol className="pc-steps">
              <li>{t('pc.how1')}</li>
              <li>{t('pc.how2')}</li>
              <li>{t('pc.how3')}</li>
            </ol>
          </section>
        )}
        <MemberOffers />
      </div>
    </div>
  );
}
