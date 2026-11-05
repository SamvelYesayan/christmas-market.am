// Magical Pioneer Card — what membership gives you and how to connect your card.
// Connecting and the live card dashboard live in the account ("My Pioneer Card").
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { useAsync } from '../lib.js';
import { Price } from '../components/Common.jsx';
import { HiddenWonder } from '../components/Shell.jsx';
import { ProductVisual } from '../art/Art.jsx';
import { CardVisual } from '../components/PioneerCard.jsx';
import { useI18n } from '../i18n/index.jsx';
import { celebrate } from '../effects/celebrate.js';

/** Redeem one gift with Pioneer points. One requestId per dialog: double clicks and retries reuse it. */
function RedeemDialog({ offer, onClose }) {
  const { t } = useI18n();
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const yes = useRef(null);
  useEffect(() => {
    yes.current?.focus();
    const esc = (e) => e.key === 'Escape' && !busy && onClose(result);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [busy, result, onClose]);
  const redeem = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post(`/pioneer/offers/${offer.id}/redeem`, { requestId });
      setResult(r.redemption);
      if (r.redemption.status === 'completed') celebrate({ intensity: 1.2, palette: 'gold' });
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const done = result?.status === 'completed';
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !busy && onClose(result)}>
      <motion.div className="modal" role="dialog" aria-modal="true" aria-labelledby="redeem-title" initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }} onClick={(e) => e.stopPropagation()}>
        {!result ? (
          <>
            <h3 id="redeem-title">{t('pc.redeemTitle')}</h3>
            <p><b>{offer.title}</b></p>
            <p className="muted">{t('pc.redeemBody', { n: offer.pointsCost.toLocaleString('en-US') })}</p>
            {error && <div className="form-error" role="alert">{error.message}</div>}
            <div className="row">
              <button ref={yes} className="btn" onClick={redeem} disabled={busy}>{busy ? t('pc.redeeming') : t('pc.redeemYes')}</button>
              <button className="btn btn-ghost" onClick={() => onClose(null)} disabled={busy}>{t('pc.cancel')}</button>
            </div>
          </>
        ) : (
          <div role="status">
            <h3 id="redeem-title">{done ? t('pc.redeemedTitle') : t('pc.pendingTitle')}</h3>
            {done && result.couponCode && <div className="coupon-ticket"><span>{t('pc.yourCode')}</span><b dir="ltr">{result.couponCode}</b></div>}
            <p className="muted">{done ? (result.couponCode ? '' : t('pc.redeemedCollect')) : t('pc.pendingBody')}</p>
            {done && result.balanceAfter != null && <p className="gold">{t('pc.pointsLeft', { n: result.balanceAfter.toLocaleString('en-US') })}</p>}
            <div className="row"><Link className="btn btn-ghost" to="/account/pioneer">{t('pc.goToCard')}</Link><button ref={yes} className="btn" onClick={() => onClose(result)}>{t('common.close')}</button></div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function MemberOffers() {
  const { t } = useI18n();
  const { user, pioneerStatus, refreshUser } = useApp();
  const [n, setN] = useState(0);
  const [redeeming, setRedeeming] = useState(null);
  const [offers] = useAsync(() => api.get('/pioneer/offers'), [n]);
  const linked = !!user?.pioneer;
  const canRedeem = !!pioneerStatus?.pointsRedeemable;
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
              {o.redeemable ? <b className="gold">{t('pc.costPoints', { n: o.pointsCost.toLocaleString('en-US') })}</b> : o.product && <Price price={o.product.price} sale={o.product.salePrice} />}
            </div>
            <div className="reward-cta">
              {o.redeemable && (!canRedeem ? <span className="muted">{t('pc.redeemOff')}</span>
                : linked ? <button className="btn btn-sm" disabled={o.stock === 0} onClick={() => setRedeeming(o)}>{o.stock === 0 ? t('pc.soldOut') : t('pc.redeemFor', { n: o.pointsCost.toLocaleString('en-US') })}</button>
                  : <Link className="btn btn-sm btn-ghost" to={user ? '/account/pioneer' : '/login?next=/account/pioneer'}>{t('pc.connectToRedeem')}</Link>)}
              {o.product ? <Link className="btn btn-sm btn-ghost" to={`/product/${o.product.slug}`}>{t('pioneer.seeFirst')}</Link> : !o.redeemable && <span className="muted">{t('pioneer.membersOnly')}</span>}
            </div>
          </motion.article>
        ))}
      </div>
      <AnimatePresence>
        {redeeming && <RedeemDialog offer={redeeming} onClose={(r) => { setRedeeming(null); if (r) { setN((x) => x + 1); refreshUser(); } }} />}
      </AnimatePresence>
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
