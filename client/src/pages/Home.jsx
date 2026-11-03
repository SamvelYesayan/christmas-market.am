// The Village Square — the homepage told as a story in chapters.
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { api } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { ATMOSPHERES, deviceQuality, money, timeGreeting, useAsync, useMediaQuery } from '../lib.js';
import Art, { ProductVisual } from '../art/Art.jsx';
import { Castle, Crest, Mountains, Pines, Village } from '../art/Scenes.jsx';
import { Chapter, GiftTag, Loader, Price, Reveal, Ribbon } from '../components/Common.jsx';
import { HiddenWonder } from '../components/Shell.jsx';
import SnowCap from '../effects/SnowCap.jsx';
import { useI18n } from '../i18n/index.jsx';

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

const TREE_SPOTS = [[50, 22], [38, 36], [62, 38], [30, 52], [52, 54], [70, 56], [24, 70], [44, 72], [64, 74], [78, 72]];

function WishingTree({ products, title, body }) {
  const { persona } = useApp();
  const { t } = useI18n();
  const [active, setActive] = useState(null);
  const picks = products.slice(0, TREE_SPOTS.length);
  const p = active != null ? picks[active] : null;
  return (
    <section className="section wish-section">
      <div className="wrap wish-grid">
        <div>
          <Chapter num="I" title={title ?? t('home.treeTitle')}>{body}</Chapter>
          <AnimatePresence mode="wait">
            {p ? (
              <motion.div key={p.slug} className="wish-card panel" initial={{ opacity: 0, x: -30, rotate: -3 }} animate={{ opacity: 1, x: 0, rotate: 0 }} exit={{ opacity: 0, x: 30 }}>
                <span className="eyebrow">{persona?.name && persona.name !== 'Traveller' ? t('home.wishFor', { name: persona.name }) : t('home.wishRevealed')}</span>
                <h3>{p.name}</h3>
                <p className="muted">{p.subtitle}</p>
                <div className="row between"><Price price={p.price} sale={p.salePrice} /><Link to={`/product/${p.slug}`} className="btn btn-sm">{t('home.unwrap')}</Link></div>
              </motion.div>
            ) : (
              <motion.p key="hint" className="wish-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {t('home.treeHint')}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <div className="wish-tree">
          <svg viewBox="0 0 100 100" className="wish-tree-svg" aria-hidden="true">
            <defs><linearGradient id="treeG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1f9a72" /><stop offset="1" stopColor="#064030" /></linearGradient></defs>
            <path d="M50 8 L72 34 L64 34 L82 58 L72 58 L92 86 L8 86 L28 58 L18 58 L36 34 L28 34z" fill="url(#treeG)" />
            <path d="M28 58 Q50 66 72 58 M18 86 Q50 94 82 86 M36 34 Q50 40 64 34" stroke="#f6f8ff" strokeWidth="2.2" fill="none" opacity="0.85" strokeLinecap="round" />
            <path d="M34 40 Q52 50 68 44 M26 64 Q50 76 78 66" stroke="#f2c46d" strokeWidth="0.6" fill="none" strokeDasharray="1 1.6" />
            <rect x="45" y="86" width="10" height="9" fill="#5a3524" />
            <polygon points="50,1 52.2,6 57.5,6.2 53.3,9.4 54.8,14.5 50,11.6 45.2,14.5 46.7,9.4 42.5,6.2 47.8,6" fill="#f2c46d" className="art-twinkle" />
          </svg>
          {picks.map((prod, i) => (
            <motion.button key={prod.slug} className={`wish-ornament ${active === i ? 'on' : ''}`} style={{ left: `${TREE_SPOTS[i][0]}%`, top: `${TREE_SPOTS[i][1]}%`, '--c': prod.art?.c1 ?? '#c8102e' }}
              onClick={() => setActive(i)} aria-label={t('home.reveal', { name: prod.name })} whileHover={{ scale: 1.25 }} whileTap={{ scale: 0.9 }}
              initial={{ opacity: 0, y: -20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06, type: 'spring' }}>
              {active === i && <span className="wish-ornament-art"><ProductVisual product={prod} /></span>}
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stalls({ categories, title, body }) {
  const { t } = useI18n();
  return (
    <section className="section stalls-section">
      <div className="wrap"><Chapter num="II" title={title ?? t('home.stallsTitle')}>{body ?? t('home.stallsBody')}</Chapter></div>
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

function ForYou() {
  const { user, persona } = useApp();
  const { t, article, lang } = useI18n();
  const [state] = useAsync(() => (user ? api.get('/me/recommendations') : api.get(`/products?featured=true&limit=8&sort=popular`)), [user?.id]);
  if (!persona?.welcomed && !user) return null;
  const list = state.data?.products ?? [];
  if (!list.length) return null;
  const atmoName = ATMOSPHERES[persona?.atmosphere] ? t(`atmo.${persona.atmosphere}`) : null;
  return (
    <section className="section">
      <div className="wrap">
        <Chapter eyebrow={t('home.forYou')} title={<>{t('home.pickedFor')} <span className="script gold">{persona?.name && persona.name !== 'Traveller' ? persona.name : t('home.you')}</span></>}>
          {user || !atmoName ? t('home.studied') : t('home.suits', { a: article(atmoName), atmo: lang === 'en' ? atmoName.toLowerCase() : atmoName })}
        </Chapter>
      </div>
      <Ribbon>{list.map((p, i) => <GiftTag key={p.slug} product={p} index={i} />)}</Ribbon>
    </section>
  );
}

function AcademyGate({ title, body }) {
  const { persona } = useApp();
  const { t } = useI18n();
  const [state] = useAsync(() => api.get('/academy/houses'), []);
  return (
    <section className="section academy-teaser">
      <SnowCap />
      <div className="wrap academy-teaser-grid">
        <div className="academy-teaser-scene">
          <Castle />
          <motion.div className="frozen-door left" initial={{ x: 0 }} whileInView={{ x: '-92%' }} viewport={{ once: true, amount: 0.6 }} transition={{ duration: 1.6, ease: [0.65, 0, 0.35, 1], delay: 0.3 }} />
          <motion.div className="frozen-door right" initial={{ x: 0 }} whileInView={{ x: '92%' }} viewport={{ once: true, amount: 0.6 }} transition={{ duration: 1.6, ease: [0.65, 0, 0.35, 1], delay: 0.3 }} />
        </div>
        <div>
          <Chapter num="III" title={title ?? t('home.gateTitle')}>{body}</Chapter>
          <div className="crest-orbit">
            {(state.data?.houses ?? []).map((h, i) => (
              <motion.div key={h.slug} className="crest-chip" initial={{ opacity: 0, scale: 0.6 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.12, type: 'spring' }}>
                <Crest house={h} size={64} />
                <b>{h.name}</b>
                <small>{h.animal}</small>
              </motion.div>
            ))}
          </div>
          <Link to="/academy" className="btn btn-ghost">{persona?.house ? t('home.returnTo', { house: persona.house.name }) : t('home.enterAcademy')}</Link>
        </div>
      </div>
    </section>
  );
}

function PioneerVip({ title, body }) {
  const card = useRef(null);
  const { user, pioneerStatus } = useApp();
  const { t } = useI18n();
  const onMove = (e) => {
    const r = card.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.current.style.setProperty('--rx', `${-y * 14}deg`);
    card.current.style.setProperty('--ry', `${x * 18}deg`);
    card.current.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
  };
  return (
    <section className="section pioneer-teaser">
      <div className="wrap grid-2" style={{ alignItems: 'center' }}>
        <div>
          <Chapter num="IV" title={title ?? t('home.lodgeTitle')}>{body}</Chapter>
          <ul className="perks">
            <li><b>{t('home.perk1', { p: pioneerStatus?.discountPercent ?? 5 })}</b>{t('home.perk1b')}</li>
            <li><b>{t('home.perk2')}</b>{t('home.perk2b')}</li>
            <li><b>{t('home.perk3')}</b>{t('home.perk3b')}</li>
            <li><b>{t('home.perk4')}</b>{t('home.perk4b')}</li>
          </ul>
          <Link to="/pioneer" className="btn">{user?.pioneer ? t('home.openLodge') : t('home.linkCard')}</Link>
        </div>
        <div className="vip-card-stage" onPointerMove={onMove} onPointerLeave={() => { card.current.style.setProperty('--rx', '0deg'); card.current.style.setProperty('--ry', '0deg'); }}>
          <div className="vip-card" ref={card}>
            <div className="vip-card-shine" />
            <span className="vip-card-chip" />
            <span className="vip-card-brand">Magical Pioneer</span>
            <span className="vip-card-num" dir="ltr">•••• •••• {user?.pioneer?.cardMasked?.slice(-4) ?? '2026'}</span>
            <span className="vip-card-name">{user?.name ?? t('home.cardName')}</span>
            <svg className="vip-card-star" viewBox="0 0 40 40" aria-hidden="true"><polygon points="20,2 24.5,14 37,14.5 27,22.5 30.5,35 20,27.8 9.5,35 13,22.5 3,14.5 15.5,14" /></svg>
          </div>
        </div>
      </div>
    </section>
  );
}

function CompassTeaser({ title, body }) {
  const nav = useNavigate();
  const { t } = useI18n();
  const options = [['child', 'forChild'], ['partner', 'forPartner'], ['parent', 'forParent'], ['friend', 'forFriend'], ['colleague', 'forColleague'], ['self', 'forSelf']];
  return (
    <section className="section compass-teaser">
      <div className="wrap compass-grid">
        <div className="compass-dial" aria-hidden="true">
          <svg viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="92" fill="none" stroke="#f2c46d" strokeOpacity="0.5" />
            <circle cx="100" cy="100" r="78" fill="none" stroke="#f2c46d" strokeOpacity="0.25" strokeDasharray="2 6" />
            {['N', 'E', 'S', 'W'].map((d, i) => <text key={d} x={100 + Math.sin((i * Math.PI) / 2) * 66} y={106 - Math.cos((i * Math.PI) / 2) * 66} textAnchor="middle" fill="#f2c46d" fontFamily="Fraunces" fontSize="14">{d}</text>)}
            <g className="compass-needle"><polygon points="100,30 108,100 100,170 92,100" fill="#c8102e" /><polygon points="100,100 108,100 100,170 92,100" fill="#f6f8ff" /><circle cx="100" cy="100" r="6" fill="#f2c46d" /></g>
          </svg>
        </div>
        <div>
          <Chapter num="V" title={title ?? t('home.compassTitle')}>{body}</Chapter>
          <p className="label" style={{ marginBottom: '0.8rem' }}>{t('home.whoFor')}</p>
          <div className="row">
            {options.map(([v, l]) => <button key={v} className="chip" onClick={() => nav(`/gift-finder?for=${v}`)}>{t(`home.${l}`)}</button>)}
          </div>
        </div>
      </div>
    </section>
  );
}

function ClocktowerTeaser({ title, body }) {
  const { t } = useI18n();
  const now = new Date();
  const christmas = new Date(now.getFullYear(), 11, 25);
  if (christmas < now) christmas.setFullYear(now.getFullYear() + 1);
  const days = Math.ceil((christmas - now) / 86400000);
  const [state] = useAsync(() => api.get('/advent'), []);
  const doors = state.data?.doors ?? [];
  return (
    <section className="section clock-teaser">
      <div className="wrap grid-2" style={{ alignItems: 'center' }}>
        <div>
          <Chapter num="VI" title={title ?? t('home.clockTitle')}>{body}</Chapter>
          <p className="countdown"><span className="countdown-num">{days}</span> {t('home.nights')}</p>
          <Link to="/advent" className="btn btn-green">{state.data?.unlockedThrough ? t('home.openToday') : t('home.seeClock')}</Link>
        </div>
        <div className="mini-advent">
          {Array.from({ length: 24 }, (_, i) => {
            const d = doors[i];
            return <Link key={i} to="/advent" className={`mini-door ${d?.state ?? 'locked'}`} style={{ '--i': i }}><span>{i + 1}</span></Link>;
          })}
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
        <Chapter num="VIII" title={t('home.sealedTitle')}>{t('home.sealedBody')}</Chapter>
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
        <Chapter num="IX" title={t('home.postcards')} centered />
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
            <Chapter num="X" title={block?.title}>{block?.body}</Chapter>
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
          <WishingTree products={treeProducts} title={ch.tree?.title} body={ch.tree?.body} />
          {cats.data && <Stalls categories={cats.data.categories} title={ch.stalls?.title} body={ch.stalls?.body} />}
          <ForYou />
          <AcademyGate title={ch.academy?.title} body={ch.academy?.body} />
          <PioneerVip title={ch.pioneer?.title} body={ch.pioneer?.body} />
          <CompassTeaser title={ch.finder?.title} body={ch.finder?.body} />
          <ClocktowerTeaser title={ch.advent?.title} body={ch.advent?.body} />
          <section className="section">
            <div className="wrap"><Chapter num="VII" title={t('home.wishedTitle')}>{t('home.wishedBody')}</Chapter></div>
            <Ribbon>{d.bestsellers.map((p, i) => <GiftTag key={p.slug} product={p} index={i} />)}</Ribbon>
            {d.limited.length > 0 && (
              <div className="wrap limited-strip">
                {d.limited.map((p) => (
                  <Link key={p.slug} to={`/product/${p.slug}`} className="limited-item">
                    <span className="limited-art"><ProductVisual product={p} /></span>
                    <span><span className="badge badge-gold">{t('home.limitedLeft', { n: p.stock })}</span><b>{p.name}</b><small className="muted">{money(p.salePrice ?? p.price)}</small></span>
                  </Link>
                ))}
              </div>
            )}
          </section>
          <Offers campaigns={d.campaigns} onSale={d.onSale} />
          <Reviews />
          <Events events={d.events} />
          <Newsletter block={d.blocks?.['home.newsletter']} />
          {persona?.welcomed && (
            <p className="center muted replay"><button className="link" onClick={onReplayWelcome}>{t('home.replay')}</button></p>
          )}
        </>
      )}
    </div>
  );
}
