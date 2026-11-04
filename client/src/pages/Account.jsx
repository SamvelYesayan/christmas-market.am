// Your Cottage — the personal dashboard.
import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { ATMOSPHERES, money, useAsync } from '../lib.js';
import { Crest } from '../art/Scenes.jsx';
import Art from '../art/Art.jsx';
import { Empty, GiftTag, Loader, Ribbon } from '../components/Common.jsx';
import { payLabel, statusLabel } from './Order.jsx';
import { LangSwitch, useI18n } from '../i18n/index.jsx';
import { getIntroPref, setIntroPref } from '../effects/introPrefs.js';
import MyPioneerCard from '../components/PioneerCard.jsx';

const ACH_ICON = { snowflake: 'snowflake', crest: 'star', sleigh: 'sleigh', door: 'door', star: 'star', gift: 'giftbox', book: 'book', eye: 'key', card: 'card', heart: 'heart' };

function CouponTicket({ c }) {
  const { t, dateShort } = useI18n();
  return (
    <div className="ticket">
      <b className="ticket-code">{c.code}</b>
      <span>{c.type === 'percent' ? t('account.pctOff', { v: c.value }) : c.type === 'fixed' ? t('account.fixedOff', { v: money(c.value) }) : t('account.freeDelivery')}{c.minSubtotal ? t('account.over', { amount: money(c.minSubtotal) }) : ''}</span>
      <small className="muted">{c.description}{c.endsAt ? t('account.until', { date: dateShort(c.endsAt) }) : ''}</small>
    </div>
  );
}

function Overview({ dash }) {
  const { user, persona } = useApp();
  const { t } = useI18n();
  const [recs] = useAsync(() => api.get('/me/recommendations'), []);
  const house = user.profile.house;
  const atmo = ATMOSPHERES[user.profile.atmosphere] ? user.profile.atmosphere : null;
  return (
    <div className="stack">
      <div className="cottage-tiles">
        <div className="tile tile-identity" style={{ '--h': house?.color ?? '#2a4fa8' }}>
          {house ? <Crest house={house} size={70} /> : <Art art={{ type: 'wand', c1: '#e8dcc4', c2: '#a9c7ff' }} />}
          <div>
            <span className="eyebrow">{t('account.identity')}</span>
            {house ? <><h3 className="script">{user.profile.identity?.magicalName ?? user.name}</h3><p className="muted">{house.name} · {house.animal}</p></>
              : <><h3>{t('account.notSorted')}</h3><Link className="link" to="/academy">{t('account.visitAcademy')}</Link></>}
          </div>
        </div>
        <div className="tile"><span className="eyebrow">{t('common.stardust')}</span><b className="tile-num">{dash.stardust} ✨</b><small className="muted">{t('account.earned')}</small></div>
        <div className="tile"><span className="eyebrow">{t('pc.tab')}</span>{user.pioneer ? <><b className="tile-num" dir="ltr">{user.pioneer.cardMasked}</b><Link className="link" to="/account/pioneer">{t('pc.manage')}</Link></> : <><small className="muted">{t('pc.none')}</small><Link className="link" to="/account/pioneer">{t('pc.connectShort')}</Link></>}</div>
        <div className="tile"><span className="eyebrow">{t('account.advent')}</span><b className="tile-num">{dash.advent.opened}/24</b><span className="bar"><span style={{ width: `${(dash.advent.opened / 24) * 100}%` }} /></span></div>
        <div className="tile"><span className="eyebrow">{t('account.atmosphere')}</span><b>{atmo ? t(`atmo.${atmo}`) : t('account.notChosen')}</b>{atmo && <small className="muted">{t(`atmo.${atmo}Blurb`)}</small>}</div>
        <div className="tile"><span className="eyebrow">{t('account.wishlist')}</span><b className="tile-num">{dash.wishlistCount}</b><Link className="link" to="/account/wishlist">{t('account.open')}</Link></div>
      </div>
      {dash.coupons.length > 0 && (
        <section><h3>{t('account.codes')}</h3><div className="coupons">{dash.coupons.map((c) => <CouponTicket key={c.code} c={c} />)}</div></section>
      )}
      {recs.data?.products?.length > 0 && (
        <section><h3>{t('account.pickedFor', { name: persona?.name })}</h3><Ribbon>{recs.data.products.map((p, i) => <GiftTag key={p.slug} product={p} index={i} variant="mini" />)}</Ribbon></section>
      )}
    </div>
  );
}

function Orders({ dash }) {
  const { t, dateShort } = useI18n();
  if (!dash.orders.length) return <Empty art={{ type: 'sleigh', c1: '#c8102e' }} title={t('account.noOrders')}><Link className="btn" to="/shop">{t('common.visitMarket')}</Link></Empty>;
  return (
    <ul className="order-list">
      {dash.orders.map((o) => (
        <li key={o.number}>
          <Link to={`/order/${o.number}`} className="order-row">
            <b>{o.number}</b>
            <span>{dateShort(o.createdAt)}</span>
            <span>{t('account.giftsN', { n: o.itemCount })}</span>
            <span className={`status status-${o.status}`}>{statusLabel(o.status)}</span>
            <span className="muted">{payLabel(o.paymentStatus)}{o.isTest ? ` · ${t('common.test')}` : ''}</span>
            <b>{money(o.total)}</b>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Wishlist() {
  const { t } = useI18n();
  const [state] = useAsync(() => api.get('/wishlist'), []);
  if (state.loading) return <Loader />;
  if (!state.data.products.length) return <Empty art={{ type: 'heart', c1: '#c8102e' }} title={t('account.noWishes')}><p className="muted">{t('account.noWishesBody')}</p></Empty>;
  return <div className="tag-grid">{state.data.products.map((p, i) => <GiftTag key={p.slug} product={p} index={i} variant="mini" />)}</div>;
}

function Rewards({ dash }) {
  const { t, dateShort } = useI18n();
  return (
    <div className="stack">
      <section><h3>{t('account.achievements')}</h3><Achievements dash={dash} /></section>
      {dash.coupons.length > 0 && <div className="coupons">{dash.coupons.map((c) => <CouponTicket key={c.code} c={c} />)}</div>}
      <h3>{t('account.history')}</h3>
      {dash.rewards.length === 0 ? <p className="muted">{t('account.noRewards')}</p> : (
        <ul className="ledger">
          {dash.rewards.map((r) => (
            <li key={r.id}>
              <span>{dateShort(r.createdAt)}</span>
              <span>{r.title}{r.couponCode ? <b className="gold"> · {r.couponCode}</b> : ''}{r.points > 0 && <small className="muted"> · {t(`account.sync_${r.pioneerSyncStatus}`)}</small>}</span>
              <b className="plus">{r.points > 0 ? `+${r.points} ✨` : r.kind === 'coupon' ? '🎟' : '✦'}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Achievements({ dash }) {
  const { dateShort } = useI18n();
  return (
    <div className="achievements">
      {dash.achievements.map((a, i) => (
        <motion.div key={a.key} className={`achievement ${a.earnedAt ? 'earned' : ''}`} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}>
          <span className="achievement-art"><Art art={{ type: ACH_ICON[a.icon] ?? 'star', c1: a.earnedAt ? '#c8102e' : '#3a4566', c2: a.earnedAt ? '#f2c46d' : '#6b7896' }} glow={!!a.earnedAt} /></span>
          <b>{a.title}</b>
          <small className="muted">{a.description}</small>
          {a.earnedAt && <small className="gold">{dateShort(a.earnedAt)}</small>}
        </motion.div>
      ))}
    </div>
  );
}

function Settings() {
  const { user, setUser, toast, logout, forgetPersona } = useApp();
  const { t } = useI18n();
  const nav = useNavigate();
  const [f, setF] = useState({ name: user.name, phone: user.phone ?? '', displayName: user.profile.displayName ?? '', atmosphere: user.profile.atmosphere ?? 'enchanted', marketingConsent: user.consents.marketing, personalizationConsent: user.consents.personalization });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [intro, setIntro] = useState(getIntroPref);
  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { name: f.name, phone: f.phone || undefined, marketingConsent: f.marketingConsent, personalizationConsent: f.personalizationConsent };
      if (f.personalizationConsent) Object.assign(body, { displayName: f.displayName || f.name, atmosphere: f.atmosphere });
      const r = await api.put('/me/profile', body);
      setUser(r.user);
      toast(t('account.tidied'), { icon: '🏡' });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };
  const changePw = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/password', pw);
      setPw({ currentPassword: '', newPassword: '' });
      toast(t('account.pwChanged'), { icon: '🔐' });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };
  return (
    <div className="grid-2">
      <form className="panel pad" onSubmit={save}>
        <h3>{t('account.profile')}</h3>
        <div className="field"><label htmlFor="sn">{t('account.fullName')}</label><input id="sn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label htmlFor="sp">{t('account.phone')}</label><input id="sp" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <label className="check"><input type="checkbox" checked={f.personalizationConsent} onChange={(e) => setF({ ...f, personalizationConsent: e.target.checked })} /> {t('account.personalise')}</label>
        {f.personalizationConsent && (
          <>
            <div className="field" style={{ marginTop: '1rem' }}><label htmlFor="sd">{t('account.callMe')}</label><input id="sd" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></div>
            <div className="field"><label htmlFor="sa">{t('account.atmosphere')}</label><select id="sa" value={f.atmosphere} onChange={(e) => setF({ ...f, atmosphere: e.target.value })}>{Object.keys(ATMOSPHERES).map((k) => <option key={k} value={k}>{t(`atmo.${k}`)}</option>)}</select></div>
          </>
        )}
        <label className="check"><input type="checkbox" checked={f.marketingConsent} onChange={(e) => setF({ ...f, marketingConsent: e.target.checked })} /> {t('account.letters')}</label>
        <button className="btn" style={{ marginTop: '1rem' }}>{t('common.save')}</button>
      </form>
      <div className="stack">
        <div className="panel pad">
          <h3>{t('account.language')}</h3>
          <LangSwitch />
          <div className="field" style={{ marginTop: '1.2rem' }}>
            <label htmlFor="ip">{t('account.intro')}</label>
            <select id="ip" value={intro} onChange={(e) => { setIntroPref(e.target.value); setIntro(e.target.value); }}>
              <option value="auto">{t('footer.introFull')} → {t('footer.introShort')}</option>
              <option value="full">{t('footer.introFull')}</option>
              <option value="short">{t('footer.introShort')}</option>
              <option value="off">{t('footer.introOff')}</option>
            </select>
          </div>
        </div>
        <div className="panel pad">
          <h3>{t('pc.connectedCard')}</h3>
          {user.pioneer ? <p><b dir="ltr">{user.pioneer.cardMasked}</b>{user.pioneer.holderName ? <span className="muted"> · {user.pioneer.holderName}</span> : null}</p> : <p className="muted">{t('pc.none')}</p>}
          <Link className="link" to="/account/pioneer">{user.pioneer ? t('pc.manage') : t('pc.connectShort')}</Link>
        </div>
        <form className="panel pad" onSubmit={changePw}>
          <h3>{t('account.password')}</h3>
          <div className="field"><label htmlFor="cp">{t('account.current')}</label><input id="cp" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required /></div>
          <div className="field"><label htmlFor="np">{t('account.newPw')}</label><input id="np" type="password" autoComplete="new-password" minLength={10} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required /></div>
          <button className="btn btn-ghost">{t('account.changePw')}</button>
        </form>
        <div className="panel pad">
          <h3>{t('account.leave')}</h3>
          <div className="row">
            <button className="btn btn-ghost" onClick={async () => { await logout(); nav('/'); }}>{t('common.signOut')}</button>
            <button className="btn btn-ghost" onClick={() => { forgetPersona(); toast(t('account.forgotten')); }}>{t('account.forget')}</button>
          </div>
          {user.role === 'admin' && <p style={{ marginTop: '1rem' }}><Link className="link" to="/admin">{t('account.admin')}</Link></p>}
        </div>
      </div>
    </div>
  );
}

export default function Account() {
  const { user, authReady, persona } = useApp();
  const { t } = useI18n();
  const [state] = useAsync(() => (user ? api.get('/me/dashboard') : Promise.resolve(null)), [user?.id]);
  useEffect(() => { document.title = `${t('account.title')} · ${t('brand.name')}`; }, [t]);
  if (!authReady) return <Loader />;
  if (!user) return <Navigate to="/login?next=/account" replace />;
  const tabs = [['', 'account.overview'], ['orders', 'account.orders'], ['pioneer', 'pc.tab'], ['wishlist', 'account.wishlist'], ['rewards', 'account.rewards'], ['settings', 'account.settings']];
  return (
    <div className="wrap cottage">
      <header className="page-head cottage-head">
        <div>
          <span className="eyebrow">{t('account.title')}</span>
          <h1>{t('account.welcome')} <span className="script gold">{persona?.name ?? user.name}</span></h1>
        </div>
      </header>
      <nav className="cottage-tabs" aria-label={t('account.tabs')}>
        {tabs.map(([to, l]) => <NavLink key={to} end to={`/account${to ? `/${to}` : ''}`} className="cottage-tab">{t(l)}</NavLink>)}
      </nav>
      {!state.data ? <Loader /> : (
        <Routes>
          <Route index element={<Overview dash={state.data} />} />
          <Route path="orders" element={<Orders dash={state.data} />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="rewards" element={<Rewards dash={state.data} />} />
          <Route path="pioneer" element={<MyPioneerCard />} />
          <Route path="achievements" element={<Navigate to="/account/rewards" replace />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      )}
    </div>
  );
}
