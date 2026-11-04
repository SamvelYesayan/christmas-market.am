// Home — shop first (categories, popular gifts, offers), then one calm row of extras.
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { api } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { ATMOSPHERES, deviceQuality, money, timeGreeting, useAsync, useMediaQuery } from '../lib.js';
import Art, { ProductVisual } from '../art/Art.jsx';
import { Mountains, Pines, Village } from '../art/Scenes.jsx';
import { Chapter, GiftTag, Loader, Reveal, Ribbon } from '../components/Common.jsx';
import { HiddenWonder } from '../components/Shell.jsx';
import { useI18n } from '../i18n/index.jsx';
import WishesWall from '../components/WishesWall.jsx';

const Ornament3D = lazy(() => import('../effects/Ornament3D.jsx'));

function Hero({ blocks }) {
  const { persona, calm } = useApp();
  const { t, article, lang } = useI18n();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const yFar = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const yMid = useTransform(scrollYProgress, [0, 1], ['0%', '32%']);
  const yNear = useTransform(scrollYProgress, [0, 1], ['0%', '55%']);
  const yText = useTransform(scrollYProgress, [0, 1], ['0%', '-30%']);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const big = useMediaQuery('(min-width: 900px)');
  const can3d = big && !calm && deviceQuality() > 0.5;
  const hero = blocks?.['home.hero'] ?? {};
  const name = persona?.name && persona.name !== 'Traveller' ? persona.name : null;
  const atmoName = t(`atmo.${ATMOSPHERES[persona?.atmosphere] ? persona.atmosphere : 'enchanted'}`);
  const words = (hero.title ?? '').split(' ');

  return (
    <section className="hero" ref={ref}>
      <motion.div className="hero-layer hero-moon" style={{ y: yFar }} aria-hidden="true" />
      <motion.div className="hero-layer hero-far" style={{ y: yFar }}><Mountains /></motion.div>
      <motion.div className="hero-layer hero-mid" style={{ y: yMid }}><Village /></motion.div>
      <motion.div className="hero-layer hero-near" style={{ y: yNear }}><Pines count={11} /></motion.div>
      <div className="hero-ground" aria-hidden="true" />
      <motion.div className="hero-content wrap" style={{ y: yText, opacity: fade }}>
        <motion.p className="hero-greeting" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          {name ? <>{t(`greet.${timeGreeting()}`)}, <span className="script">{name}</span>. {persona?.atmosphere && <span className="muted">{t('home.glows', { a: article(atmoName), atmo: lang === 'en' ? atmoName.toLowerCase() : atmoName })}</span>}</> : hero.eyebrow}
        </motion.p>
        <h1 className="hero-title" aria-label={hero.title}>
          {words.map((w, i) => (
            <motion.span key={i} className={i === words.length - 1 ? 'hero-last' : ''} initial={{ opacity: 0, y: 60, rotateX: -60 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.45 + i * 0.09, duration: 1, ease: [0.22, 1, 0.36, 1] }}>
              {w}{' '}
            </motion.span>
          ))}
        </h1>
        <motion.p className="hero-sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>{hero.subtitle}</motion.p>
        <motion.div className="row hero-ctas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3 }}>
          <Link className="btn" to="/shop">{hero.cta}</Link>
          <Link className="btn btn-ghost" to="/gift-finder">{t('home.ctaFinder')}</Link>
        </motion.div>
      </motion.div>
      <div className="hero-ornament" aria-hidden="true">
        {can3d ? (
          <Suspense fallback={<div className="hero-ornament-fallback"><Art art={{ type: 'ornament', c1: '#c8102e', c2: '#f2c46d' }} glow={false} /></div>}>
            <Ornament3D c1={persona?.atmosphere === 'nordic' ? '#1d6b6b' : persona?.atmosphere === 'enchanted' ? '#2a4fa8' : '#c8102e'} c2="#0b1430" />
          </Suspense>
        ) : (
          <div className="hero-ornament-fallback"><Art art={{ type: 'ornament', c1: '#c8102e', c2: '#f2c46d' }} glow={false} /></div>
        )}
      </div>
      <HiddenWonder id="golden-acorn" style={{ left: '8%', bottom: '14%' }} />
      <div className="hero-scroll" aria-hidden="true"><span /></div>
    </section>
  );
}

function Stalls({ categories, title, body }) {
  const { t } = useI18n();
  return (
    <section className="section stalls-section">
      <div className="wrap"><Chapter title={title ?? t('home.stallsTitle')}>{body ?? t('home.stallsBody')}</Chapter></div>
      <div className="stalls-row" role="list">
        {categories.map((c, i) => (
          <motion.div role="listitem" key={c.slug} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 6) * 0.06 }}>
            <Link to={`/shop/${c.slug}`} className="stall" style={{ '--c': c.color }}>
              <span className="stall-awning" aria-hidden="true" />
              <span className="stall-lamp" aria-hidden="true" />
              <span className="stall-art"><Art art={{ type: c.art, c1: c.color, c2: c.color === '#f2c46d' ? '#c8102e' : '#f2c46d' }} /></span>
              <span className="stall-name">{c.name}</span>
              <span className="stall-tag">{c.tagline}</span>
              <span className="stall-count">{t('home.giftsCount', { n: c.productCount })}</span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function PopularGifts({ products, limited }) {
  const { t } = useI18n();
  if (!products.length) return null;
  return (
    <section className="section">
      <div className="wrap row between home-head">
        <Chapter title={t('home.wishedTitle')}>{t('home.wishedBody')}</Chapter>
        <Link className="btn btn-ghost btn-sm" to="/shop">{t('home.seeAllGifts')}</Link>
      </div>
      <Ribbon>{products.map((p, i) => <GiftTag key={p.slug} product={p} index={i} />)}</Ribbon>
      {limited.length > 0 && (
        <div className="wrap limited-strip">
          {limited.map((p) => (
            <Link key={p.slug} to={`/product/${p.slug}`} className="limited-item">
              <span className="limited-art"><ProductVisual product={p} /></span>
              <span><span className="badge badge-gold">{t('home.limitedLeft', { n: p.stock })}</span><b>{p.name}</b><small className="muted">{money(p.salePrice ?? p.price)}</small></span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// One calm row for everything beyond shopping, instead of a full chapter per feature.
function MoreMagic() {
  const { user, pioneerStatus } = useApp();
  const { t } = useI18n();
  const now = new Date();
  const christmas = new Date(now.getFullYear(), 11, 25);
  if (christmas < now) christmas.setFullYear(now.getFullYear() + 1);
  const days = Math.ceil((christmas - now) / 86400000);
  const tiles = [
    { to: '/gift-finder', art: { type: 'giftbox', c1: '#f2c46d', c2: '#c8102e' }, title: t('nav.finder'), body: t('home.moreFinder') },
    { to: '/pioneer', art: { type: 'card', c1: '#f2c46d', c2: '#3a2a0e' }, title: t('nav.pioneer'), body: user?.pioneer ? t('home.morePioneerOn', { card: user.pioneer.cardMasked }) : t('home.morePioneer', { p: pioneerStatus?.discountPercent ?? 5 }) },
    { to: '/advent', art: { type: 'door', c1: '#0f6b4f', c2: '#f2c46d' }, title: t('nav.advent'), body: t('home.moreAdvent', { n: days }) },
    { to: '/games', art: { type: 'star', c1: '#2a4fa8', c2: '#f2c46d' }, title: t('home.moreFunTitle'), body: t('home.moreFun') },
  ];
  return (
    <section className="section">
      <div className="wrap">
        <Chapter title={t('home.moreTitle')} />
        <div className="more-magic">
          {tiles.map((x, i) => (
            <Reveal key={x.to} delay={i * 0.06}>
              <Link to={x.to} className="more-tile">
                <span className="more-art"><Art art={x.art} /></span>
                <span><b>{x.title}</b><small className="muted">{x.body}</small></span>
                <span className="more-go" aria-hidden="true">→</span>
              </Link>
            </Reveal>
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
        <Chapter title={t('home.sealedTitle')}>{t('home.sealedBody')}</Chapter>
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
        {onSale.length > 0 && <div className="tag-grid sale-grid">{onSale.slice(0, 4).map((p, i) => <GiftTag key={p.slug} product={p} index={i} variant="mini" />)}</div>}
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
  const [home] = useAsync(() => api.get('/content/home'), []);
  const [cats] = useAsync(() => api.get('/categories'), []);
  const d = home.data;
  const ch = d?.blocks?.['home.chapters'] ?? {};
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
            {[...d.banners, ...d.banners].map((b, i) => (
              <Link key={i} to={b.ctaLink ?? '/shop'} className="ribbon-banner-item">✦ <b>{b.title}</b> <span>{b.subtitle}</span> <u>{b.ctaLabel}</u></Link>
            ))}
          </div>
        </div>
      )}
      {!d ? <Loader /> : (
        <>
          {cats.data && <Stalls categories={cats.data.categories} title={ch.stalls?.title} body={ch.stalls?.body} />}
          <PopularGifts products={treeProducts.slice(0, 12)} limited={d.limited} />
          <Offers campaigns={d.campaigns} onSale={d.onSale} />
          <WishesWall />
          <MoreMagic />
          <Reviews />
          <Events events={d.events} />
          <Newsletter block={d.blocks?.['home.newsletter']} />
          <p className="center muted replay"><button className="link" onClick={onReplayWelcome}>{persona?.welcomed ? t('home.replay') : t('home.personalise')}</button></p>
        </>
      )}
    </div>
  );
}
