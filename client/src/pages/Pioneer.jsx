// The Pioneer Lodge — Magical Pioneer Card linking, balance, history and the reward shop.
// Every number shown here comes from the Pioneer integration on the server; nothing is invented client-side.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { useAsync } from '../lib.js';
import { Chapter, Loader, Price } from '../components/Common.jsx';
import { HiddenWonder } from '../components/Shell.jsx';
import { ProductVisual } from '../art/Art.jsx';
import { celebrate } from '../effects/celebrate.js';
import { useI18n } from '../i18n/index.jsx';

function LinkForm({ onLinked, sandbox }) {
  const { toast, rewardCelebration } = useApp();
  const { t } = useI18n();
  const [cardCode, setCardCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.post('/pioneer/link', { cardCode, verificationCode });
      celebrate({ intensity: 1.4, palette: 'gold' });
      toast(t('pioneer.linked'), { tone: 'reward', icon: '🌟' });
      if (r.achievement) rewardCelebration(null, r.achievement);
      onLinked();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="lodge-form panel pad" onSubmit={submit}>
      <h3>{t('pioneer.linkTitle')}</h3>
      <p className="muted">{t('pioneer.linkBody')}</p>
      {sandbox && <p className="badge badge-test">{t('pioneer.sandboxHint')}</p>}
      {error && <div className="form-error" role="alert">{error.message}</div>}
      <div className="field"><label htmlFor="cc">{t('pioneer.cardCode')}</label><input id="cc" inputMode="numeric" autoComplete="off" value={cardCode} onChange={(e) => setCardCode(e.target.value.replace(/[^0-9A-Za-z -]/g, '').slice(0, 30))} placeholder="0000 0000 0000" required /></div>
      <div className="field"><label htmlFor="vc">{t('pioneer.verify')}</label><input id="vc" inputMode="numeric" autoComplete="off" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9A-Za-z]/g, '').slice(0, 12))} placeholder="••••" required /></div>
      <button className="btn btn-block" disabled={busy}>{busy ? t('pioneer.checking') : t('pioneer.linkBtn')}</button>
    </form>
  );
}

function Offers({ offers, linked, balance, onRedeemed }) {
  const { toast } = useApp();
  const { t } = useI18n();
  const [busy, setBusy] = useState(null);
  const redeem = async (o) => {
    if (!window.confirm(t('pioneer.confirm', { n: o.pointsCost, title: o.title }))) return;
    setBusy(o.id);
    try {
      const r = await api.post(`/pioneer/offers/${o.id}/redeem`);
      celebrate({ intensity: 1.2, palette: 'gold' });
      toast(t('pioneer.codeToast', { msg: r.message, code: r.couponCode }), { tone: 'reward', icon: '🎁', duration: 9000 });
      onRedeemed();
    } catch (e) {
      toast(e.message, { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="reward-shop">
      {offers.map((o, i) => (
        <motion.article key={o.id} className="reward-item" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
          <div className="reward-art">{o.product ? <ProductVisual product={o.product} /> : <span className="reward-pct">{o.discountPercent}%</span>}</div>
          <div className="reward-text">
            <span className="eyebrow">{o.kind === 'redeem_gift' ? t('pioneer.kindGift') : o.kind === 'discount' ? t('pioneer.kindDiscount') : t('pioneer.kindExclusive')}</span>
            <h3>{o.title}</h3>
            <p className="muted">{o.description}</p>
            {o.product && o.kind !== 'redeem_gift' && <Price price={o.product.price} sale={o.product.salePrice} />}
          </div>
          <div className="reward-cta">
            {o.pointsCost ? <b className="reward-cost">{t('common.points', { n: o.pointsCost.toLocaleString('en-US') })}</b> : null}
            {o.kind === 'exclusive_product' && o.product ? <Link className="btn btn-sm" to={`/product/${o.product.slug}`}>{t('pioneer.seeFirst')}</Link>
              : linked ? <button className="btn btn-sm" disabled={busy === o.id || balance == null || balance < o.pointsCost} onClick={() => redeem(o)}>{balance != null && balance < o.pointsCost ? t('pioneer.notEnough') : busy === o.id ? t('pioneer.redeeming') : t('pioneer.redeem')}</button>
                : <span className="muted">{t('pioneer.membersOnly')}</span>}
          </div>
        </motion.article>
      ))}
    </div>
  );
}

export default function Pioneer() {
  const { user, pioneerStatus, refreshUser, refreshCart, toast } = useApp();
  const { t, dateShort } = useI18n();
  const [n, setN] = useState(0);
  const [summary] = useAsync(() => (user ? api.get('/pioneer/summary') : Promise.resolve(null)), [user?.id, n]);
  const [offers] = useAsync(() => api.get('/pioneer/offers'), [n]);
  useEffect(() => { document.title = `${t('pioneer.title')} · ${t('brand.name')}`; }, [t]);
  const s = summary.data;
  const reload = () => { setN((x) => x + 1); refreshUser(); refreshCart(); };
  const unlink = async () => {
    if (!window.confirm(t('pioneer.unlinkConfirm'))) return;
    await api.del('/pioneer/link');
    toast(t('pioneer.unlinked'), { icon: '🔓' });
    reload();
  };

  return (
    <div className="lodge">
      <HiddenWonder id="compass-star" style={{ right: '8%', top: '18%' }} />
      {(pioneerStatus?.sandbox || s?.card?.sandbox) && <div className="ribbon-test">{t('pioneer.sandbox')}</div>}
      <header className="lodge-hero">
        <div className="lodge-fire" aria-hidden="true" />
        <div className="wrap">
          <span className="eyebrow">{t('pioneer.eyebrow')}</span>
          <h1>{t('pioneer.h1a')} <em>{t('pioneer.h1b')}</em></h1>
          <p className="muted">{t('pioneer.intro', { p: pioneerStatus?.discountPercent ?? 5 })}</p>
        </div>
      </header>
      <div className="wrap">
        {!pioneerStatus ? <Loader /> : !pioneerStatus.available ? (
          <div className="panel pad center lodge-closed">
            <h2>{t('pioneer.soonTitle')}</h2>
            <p className="muted">{t('pioneer.soonBody')}</p>
          </div>
        ) : !user ? (
          <div className="panel pad center"><p>{t('pioneer.signInBody')}</p><Link className="btn" to="/login?next=/pioneer">{t('common.signIn')}</Link></div>
        ) : summary.loading ? <Loader /> : !s?.linked ? (
          <div className="grid-2 lodge-link"><LinkForm onLinked={reload} sandbox={pioneerStatus.sandbox} />
            <div><Chapter eyebrow={t('pioneer.whyEyebrow')} title={t('pioneer.whyTitle')} />
              <ul className="perks">
                <li><b>{t('pioneer.perk1', { p: pioneerStatus.discountPercent })}</b>{t('pioneer.perk1b')}</li>
                <li><b>{t('pioneer.perk2')}</b>{t('pioneer.perk2b')}</li>
                <li><b>{t('pioneer.perk3')}</b>{t('pioneer.perk3b')}</li>
                <li><b>{t('pioneer.perk4')}</b>{t('pioneer.perk4b')}</li>
              </ul></div>
          </div>
        ) : (
          <div className="lodge-member">
            <div className="lodge-card-row">
              <div className="vip-card static">
                <div className="vip-card-shine" /><span className="vip-card-chip" />
                <span className="vip-card-brand">Magical Pioneer</span>
                <span className="vip-card-num" dir="ltr">{s.card.masked}</span>
                <span className="vip-card-name">{user.name} · {s.card.tier ?? t('pioneer.member')}</span>
              </div>
              <div className="lodge-balance panel pad">
                <span className="eyebrow">{t('pioneer.points')}</span>
                {s.error ? <p className="form-error">{s.error}</p> : <p className="balance-num">{s.balance?.toLocaleString('en-US') ?? '—'}</p>}
                {s.pendingStardust > 0 && <p className="muted">{t('pioneer.pending', { n: s.pendingStardust })}</p>}
                <p className="muted">{t('pioneer.discount')} <b className="gold">{s.discountPercent}%</b> {t('pioneer.everyOrder')}</p>
                <button className="link" onClick={unlink}>{t('pioneer.unlink')}</button>
              </div>
            </div>
            <section className="section">
              <Chapter eyebrow={t('pioneer.recent')} title={t('pioneer.story')} />
              {s.history.length === 0 ? <p className="muted">{t('pioneer.noTx')}</p> : (
                <ul className="ledger">
                  {s.history.map((h) => (
                    <li key={h.id}><span>{dateShort(h.date)}</span><span>{h.description}</span><b className={h.points >= 0 ? 'plus' : 'minus'}>{h.points >= 0 ? '+' : ''}{h.points}</b></li>
                  ))}
                </ul>
              )}
              {s.redemptions.length > 0 && (
                <>
                  <h3 style={{ marginTop: '2rem' }}>{t('pioneer.redeemed')}</h3>
                  <ul className="ledger">{s.redemptions.map((r, k) => <li key={k}><span>{dateShort(r.createdAt)}</span><span>{r.title} {r.couponCode && <b className="gold">· {r.couponCode}</b>}</span><b className="minus">−{r.points}</b></li>)}</ul>
                </>
              )}
            </section>
          </div>
        )}
        <section className="section">
          <Chapter eyebrow={t('pioneer.shopEyebrow')} title={t('pioneer.shopTitle')}>{t('pioneer.shopBody')}</Chapter>
          {offers.data ? <Offers offers={offers.data.offers} linked={!!s?.linked} balance={s?.balance} onRedeemed={reload} /> : <Loader />}
        </section>
      </div>
    </div>
  );
}
