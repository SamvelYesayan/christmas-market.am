// Home — one clear hero, then categories, popular gifts, offers, Pioneer Card, how shopping works; extras come last.
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { deviceQuality, money, timeGreeting, useAsync, useMediaQuery } from '../lib.js';
import Art, { ProductVisual } from '../art/Art.jsx';
import { Mountains, Pines, Village } from '../art/Scenes.jsx';
import { Chapter, GiftTag, Loader, Reveal, LoadError } from '../components/Common.jsx';
import { CardVisual } from '../components/PioneerCard.jsx';
import { HiddenWonder } from '../components/Shell.jsx';
import { useI18n } from '../i18n/index.jsx';
import WishesWall from '../components/WishesWall.jsx';

const Ornament3D = lazy(() => import('../effects/Ornament3D.jsx'));

function Hero({ blocks }) {
  const { persona, calm } = useApp();
  const { t } = useI18n();
  const big = useMediaQuery('(min-width: 900px)');
  const can3d = big && !calm && deviceQuality() > 0.5;
  const hero = blocks?.['home.hero'] ?? {};
  const name = persona?.name && persona.name !== 'Traveller' ? persona.name : null;
  const ornament = <div className="hero-ornament-fallback"><Art art={{ type: 'ornament', c1: '#c8102e', c2: '#f2c46d' }} glow={false} /></div>;
  return (
    <section className="hero">
      <div className="hero-layer hero-moon" aria-hidden="true" />
      <div className="hero-layer hero-far"><Mountains /></div>
      <div className="hero-layer hero-mid"><Village /></div>
      <div className="hero-layer hero-near"><Pines count={11} /></div>
      <div className="hero-ground" aria-hidden="true" />
      <motion.div className="hero-content wrap" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
        <p className="hero-greeting">{name ? <>{t(`greet.${timeGreeting()}`)}, <span className="script">{name}</span></> : t('home.heroPurpose')}</p>
        <h1 className="hero-title">{hero.title}</h1>
        <p className="hero-sub">{name ? t('home.heroPurpose') : hero.subtitle}</p>
        <div className="row hero-ctas">
          <Link className="btn" to="/shop">{t('home.heroCta')}</Link>
          <Link className="link hero-finder" to="/gift-finder">{t('home.ctaFinder')} →</Link>
        </div>
      </motion.div>
      <div className="hero-ornament" aria-hidden="true">
        {can3d ? (
          <Suspense fallback={ornament}>
            <Ornament3D c1={persona?.atmosphere === 'nordic' ? '#1d6b6b' : persona?.atmosphere === 'enchanted' ? '#2a4fa8' : '#c8102e'} c2="#0b1430" />
          </Suspense>
        ) : ornament}
      </div>
      <HiddenWonder id="golden-acorn" style={{ left: '8%', bottom: '14%' }} />
    </section>
  );
}

// The first eight categories; the rest are one tap away in the shop and the menu.
function Categories({ categories }) {
  const { t } = useI18n();
  return (
    <section className="section">
      <div className="wrap">
        <div className="row between home-head">
          <Chapter title={t('home.stallsTitle')}>{t('home.stallsBody')}</Chapter>
          <Link className="btn btn-ghost btn-sm" to="/shop">{t('home.allCats')}</Link>
        </div>
        <div className="cat-grid">
          {categories.slice(0, 8).map((c) => (
            <Link key={c.slug} to={`/shop/${c.slug}`} className="cat-tile">
              <span className="cat-art"><Art art={{ type: c.art, c1: c.color, c2: c.color === '#f2c46d' ? '#c8102e' : '#f2c46d' }} glow={false} /></span>
              <b>{c.name}</b>
              <small className="muted">{t('home.giftsCount', { n: c.productCount })}</small>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function PopularGifts({ products, limited }) {
  const { t } = useI18n();
  if (!products.length) return null;
  return (
    <section className="section">
      <div className="wrap">
        <div className="row between home-head">
          <Chapter title={t('home.wishedTitle')}>{t('home.wishedBody')}</Chapter>
          <Link className="btn btn-ghost btn-sm" to="/shop">{t('home.seeAllGifts')}</Link>
        </div>
        <div className="tag-grid">{products.map((p, i) => <GiftTag key={p.slug} product={p} index={i} />)}</div>
        {limited.length > 0 && (
          <div className="limited-strip">
            {limited.map((p) => (
              <Link key={p.slug} to={`/product/${p.slug}`} className="limited-item">
                <span className="limited-art"><ProductVisual product={p} /></span>
                <span><span className="badge badge-gold">{t('home.limitedLeft', { n: p.stock })}</span><b>{p.name}</b><small className="muted">{money(p.salePrice ?? p.price)}</small></span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** What the Pioneer Card gives, and the one step to get it. */
function PioneerBand() {
  const { user, pioneerStatus } = useApp();
  const { t } = useI18n();
  const p = pioneerStatus?.discountPercent ?? 5;
  const linked = !!user?.pioneer;
  return (
    <section className="section">
      <div className="wrap">
        <div className="pioneer-band panel">
          <CardVisual masked={linked ? user.pioneer.cardMasked : null} holder={linked ? user.pioneer.holderName : null} empty={!linked} tilt={false} />
          <div className="stack">
            <h2>{t('home.pioneerTitle')}</h2>
            <p className="muted">{t('home.pioneerBody')}</p>
            <ul className="pc-benefits"><li>{t('pc.benefit1', { p })}</li><li>{t('pc.benefit2')}</li><li>{t('pc.benefit3')}</li></ul>
            <div><Link className="btn" to={linked ? '/account/pioneer' : '/pioneer'}>{linked ? t('pc.goToCard') : t('pc.connect')}</Link></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useI18n();
  return (
    <section className="section">
      <div className="wrap">
        <Chapter title={t('home.howTitle')} />
        <ol className="how-steps">
          {[1, 2, 3].map((n) => <li key={n}><span className="how-num">{n}</span><b>{t(`home.how${n}t`)}</b><span className="muted">{t(`home.how${n}b`)}</span></li>)}
        </ol>
      </div>
    </section>
  );
}

// The seasonal extras, in one calm row.
function MoreMagic() {
  const { t } = useI18n();
  const tiles = [
    { to: '/advent', art: { type: 'door', c1: '#0f6b4f', c2: '#f2c46d' }, title: t('nav.advent'), body: t('nav.adventHint') },
    { to: '/gift-finder', art: { type: 'giftbox', c1: '#f2c46d', c2: '#c8102e' }, title: t('nav.finder'), body: t('home.moreFinder') },
    { to: '/games', art: { type: 'star', c1: '#2a4fa8', c2: '#f2c46d' }, title: t('home.moreFunTitle'), body: t('home.moreFun') },
    { to: '/academy', art: { type: 'wand', c1: '#e8dcc4', c2: '#a9c7ff' }, title: t('nav.academy'), body: t('home.moreAcademy') },
  ];
  return (
    <section className="section">
      <div className="wrap">
        <Chapter title={t('home.moreTitle')} />
        <div className="more-magic">
          {tiles.map((x) => (
            <Link key={x.to} to={x.to} className="more-tile">
              <span className="more-art"><Art art={x.art} glow={false} /></span>
              <span><b>{x.title}</b><small className="muted">{x.body}</small></span>
              <span className="more-go" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Offers({ campaigns, onSale }) {
  const { t } = useI18n();
  if (!campaigns.length && !onSale.length) return null;
  return (
    <section className="section">
      <div className="wrap">
        <div className="row between home-head">
          <Chapter title={t('home.sealedTitle')}>{t('home.sealedBody')}</Chapter>
          <Link className="btn btn-ghost btn-sm" to="/shop?onSale=true">{t('home.seeOffers')}</Link>
        </div>
        <div className="letters">
          {campaigns.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.1} className="letter" >
              <div className="letter-paper" style={{ '--seal': c.color }}>
                <span className="letter-seal" aria-hidden="true">✦</span>
                {c.pioneerOnly && <span className="badge badge-gold">{t('home.pioneerOnly')}</span>}
                <h3>{c.headline}</h3>
                <p>{c.body}</p>
                {c.couponCode && <p className="letter-code">{t('home.code')} <b>{c.couponCode}</b></p>}
              </div>
            </Reveal>
          ))}
        </div>
        {onSale.length > 0 && <div className="tag-grid sale-grid">{onSale.slice(0, 4).map((p, i) => <GiftTag key={p.slug} product={p} index={i} />)}</div>}
      </div>
    </section>
  );
}

function Reviews() {
  const { t } = useI18n();
  const [state] = useAsync(() => api.get('/reviews/highlights'), []);
  const reviews = state.data?.reviews ?? [];
  if (!reviews.length) return null;
  return (
    <section className="section">
      <div className="wrap">
        <Chapter title={t('home.postcards')} centered />
        <div className="postcards">
          {reviews.slice(0, 6).map((r, i) => (
            <motion.figure key={i} className="postcard" style={{ '--r': `${(i % 2 ? 1 : -1) * (1 + (i % 3))}deg` }}
              initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
              <div className="postcard-stamp">{r.product ? <Art art={r.product.art} glow={false} /> : '✦'}</div>
              <blockquote>“{r.body}”</blockquote>
              <figcaption><span className="script">{r.author}</span><small>{r.city}{r.product ? ` · ${r.product.name}` : ''}</small><span className="stars" aria-label={t('home.ofFive', { n: r.rating })}>{'★'.repeat(r.rating)}</span></figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Events({ events }) {
  const { t, month, time } = useI18n();
  if (!events.length) return null;
  return (
    <section className="section">
      <div className="wrap">
        <Chapter eyebrow={t('home.eventsEyebrow')} title={t('home.eventsTitle')} />
        <div className="events">
          {events.map((e) => {
            const d = new Date(e.startsAt);
            return (
              <Reveal key={e.id} className="event">
                <div className="event-date"><b>{d.getDate()}</b><span>{month(d)}</span></div>
                <div><h3>{e.title}</h3><p className="muted">{e.description}</p><small className="gold">{time(d)} · {e.location}</small></div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Newsletter({ block }) {
  const { toast, persona } = useApp();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/newsletter', { email, consent, name: persona?.name !== 'Traveller' ? persona?.name : undefined });
      setSent(true);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="section" id="letters">
      <div className="wrap narrow">
        <div className="mailbox panel pad">
          <div className="mailbox-art" aria-hidden="true"><Art art={{ type: 'scroll', c1: '#f3e6c8', c2: '#c8102e' }} /></div>
          <div>
            <Chapter title={block?.title}>{block?.body}</Chapter>
            {sent ? (
              <p className="form-ok">{t('home.letterSent')}</p>
            ) : (
              <form onSubmit={submit} className="stack">
                <div className="row"><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.am" aria-label={t('home.email')} style={{ flex: 1, minWidth: 200 }} /><button className="btn btn-red" disabled={busy || !consent}>{t('home.sendLetters')}</button></div>
                <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> {t('home.consentLetters')}</label>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home({ onReplayWelcome }) {
  const [home, , reloadHome] = useAsync(() => api.get('/content/home'), []);
  const [cats, , reloadCats] = useAsync(() => api.get('/categories'), []);
  const d = home.data;
  const { persona } = useApp();
  const { t } = useI18n();
  const treeProducts = useMemo(() => (d ? [...d.featured, ...d.bestsellers.filter((b) => !d.featured.some((f) => f.slug === b.slug))] : []), [d]);

  useEffect(() => {
    if (!d) return;
    document.title = `${t('brand.name')} · ${t('brand.sub')}`;
  }, [d]);

  return (
    <div className="home">
      <Hero blocks={d?.blocks} />
      {d?.banners?.length > 0 && (
        <div className="ribbon-banner" role="region" aria-label={t('home.announcements')}>
          <div className="ribbon-banner-track">
            {d.banners.map((b, i) => (
              <Link key={i} to={b.ctaLink ?? '/shop'} className="ribbon-banner-item">✦ <b>{b.title}</b> <span>{b.subtitle}</span> <u>{b.ctaLabel}</u></Link>
            ))}
          </div>
        </div>
      )}
      {home.error ? <div className="wrap"><LoadError error={home.error} onRetry={reloadHome} /></div> : !d ? <Loader /> : (
        <>
          {cats.error && <div className="wrap"><LoadError error={cats.error} onRetry={reloadCats} /></div>}
          {cats.data && <Categories categories={cats.data.categories} />}
          <PopularGifts products={treeProducts.slice(0, 8)} limited={d.limited} />
          <Offers campaigns={d.campaigns} onSale={d.onSale} />
          <PioneerBand />
          <HowItWorks />
          <MoreMagic />
          <WishesWall />
          <Reviews />
          <Events events={d.events} />
          <Newsletter block={d.blocks?.['home.newsletter']} />
          <p className="center muted replay"><button className="link" onClick={onReplayWelcome}>{persona?.welcomed ? t('home.replay') : t('home.personalise')}</button></p>
        </>
      )}
    </div>
  );
}
