// Frostspire Academy — an original winter wizarding school: gate, sorting ceremony, house, letter, spells, shop.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { storage, useAsync } from '../lib.js';
import { Castle, Crest } from '../art/Scenes.jsx';
import { Chapter, GiftTag, Loader, Ribbon, LoadError } from '../components/Common.jsx';
import { HiddenWonder } from '../components/Shell.jsx';
import { celebrate } from '../effects/celebrate.js';
import { useI18n } from '../i18n/index.jsx';

function Candles() {
  return (
    <div className="candles" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} className="candle" style={{ left: `${(i * 71) % 100}%`, top: `${8 + ((i * 37) % 50)}%`, animationDelay: `${i * 0.4}s` }} />
      ))}
    </div>
  );
}

function Ceremony({ onSorted }) {
  const { user, persona, refreshUser, toast } = useApp();
  const { t } = useI18n();
  const [qs, , reloadQuestions] = useAsync(() => api.get('/academy/sorting'), []);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [thinking, setThinking] = useState(false);
  const questions = qs.data?.questions ?? [];
  const pick = async (k) => {
    const next = [...answers, k];
    setAnswers(next);
    if (next.length < questions.length) return setI(i + 1);
    setThinking(true);
    try {
      const [r] = await Promise.all([
        api.post('/academy/sort', { answers: next, name: persona?.name !== 'Traveller' ? persona?.name : undefined }),
        new Promise((res) => setTimeout(res, 2600)),
      ]);
      if (!user) storage.set('mc.guestHouse', r);
      else refreshUser();
      onSorted(r);
    } catch (e) {
      toast(e.message, { tone: 'error' });
      setThinking(false);
    }
  };
  if (qs.loading) return <Loader label={t('academy.waking')} />;
  if (qs.error) return <LoadError error={qs.error} onRetry={reloadQuestions} />;
  return (
    <section className="ceremony">
      <Candles />
      <AnimatePresence mode="wait">
        {thinking ? (
          <motion.div key="think" className="sorting-stone" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="stone" />
            <p className="script stone-voice">{t('academy.thinking')}</p>
          </motion.div>
        ) : (
          <motion.div key={i} className="ceremony-q" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}>
            <p className="eyebrow">{t('academy.asks', { i: i + 1, n: questions.length })}</p>
            <h2>{questions[i]?.question}</h2>
            <div className="ceremony-answers">
              {questions[i]?.answers.map((a, k) => (
                <motion.button key={k} className="ceremony-answer" onClick={() => pick(k)} whileHover={{ x: 6 }} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: k * 0.08 }}>
                  <span className="rune" aria-hidden="true">{['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ'][k]}</span>{a}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Letter({ house, identity, name }) {
  const { t } = useI18n();
  return (
    <motion.div className="acceptance" initial={{ opacity: 0, rotateX: 70, y: 60 }} whileInView={{ opacity: 1, rotateX: 0, y: 0 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}>
      <div className="acceptance-seal" style={{ '--h': house.color }}><Crest house={house} size={46} /></div>
      <p className="acceptance-head">{t('academy.letterHead')}</p>
      <p className="script acceptance-dear">{t('academy.dear', { name: identity?.magicalName ?? name })}</p>
      <p>{t('academy.l1a')} <b>{t('academy.title')}</b> {t('academy.l1b')} <b style={{ color: house.color }}>{house.name}</b>{t('academy.l1c', { element: house.element.toLowerCase(), animal: house.animal.toLowerCase() })}</p>
      <p>{t('academy.l2')}</p>
      <ul>
        <li>{t('academy.l3', { wood: identity?.wand?.wood, core: identity?.wand?.core, length: identity?.wand?.length })}</li>
        <li>{t('academy.l4')}</li>
        <li>{t('academy.l5', { familiar: identity?.familiar })}</li>
        <li>{t('academy.l6')}</li>
      </ul>
      <p>{t('academy.l7')} <em>{identity?.constellation}</em>.</p>
      <p className="script acceptance-sign">{t('academy.signature')}</p>
    </motion.div>
  );
}

function SpellCircle({ house }) {
  const ref = useRef(null);
  const { t } = useI18n();
  const [casts, setCasts] = useState(0);
  const cast = (e) => {
    const r = ref.current.getBoundingClientRect();
    celebrate({ intensity: 0.7, palette: house.slug === 'starloom' || house.slug === 'pinehollow' ? 'frost' : 'gold', origin: { x: e?.clientX ?? r.left + r.width / 2, y: e?.clientY ?? r.top + r.height / 2 } });
    setCasts((c) => c + 1);
  };
  return (
    <div className="spell" ref={ref}>
      <button className="spell-circle" onClick={cast} style={{ '--h': house.color, '--a': house.accent }} aria-label={t('academy.castAria')}>
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeDasharray="4 8" />
          <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" strokeOpacity="0.5" />
          <polygon points="100,22 168,140 32,140" fill="none" stroke="currentColor" strokeOpacity="0.7" />
          <polygon points="100,178 32,60 168,60" fill="none" stroke="currentColor" strokeOpacity="0.7" />
          {['ᚠ', 'ᚱ', 'ᛟ', 'ᛉ', 'ᚹ', 'ᛞ'].map((r, k) => <text key={k} x={100 + Math.cos((k / 6) * Math.PI * 2) * 80} y={104 + Math.sin((k / 6) * Math.PI * 2) * 80} fill="currentColor" textAnchor="middle" fontSize="14">{r}</text>)}
        </svg>
        <span className="spell-core" />
      </button>
      <p className="muted">{t('academy.cast')}{casts ? t('academy.casts', { n: casts }) : ''}</p>
    </div>
  );
}

function Profile({ result, onLeave }) {
  const { user } = useApp();
  const { t } = useI18n();
  const { house, identity } = result;
  const name = user?.name?.split(' ')[0] ?? t('greet.traveller');
  useEffect(() => { document.documentElement.dataset.house = house.slug; }, [house.slug]);
  return (
    <>
      <section className="house-reveal" style={{ '--h': house.color, '--a': house.accent }}>
        <motion.div className="house-crest-big" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 12, delay: 0.2 }}>
          <Crest house={house} size={180} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <p className="eyebrow">{result.alreadySorted === false || result.saved === false ? t('academy.spoken') : t('academy.welcomeBack')}</p>
          <h1>{house.name}</h1>
          <p className="house-motto">“{house.motto}”</p>
          <p className="muted house-desc">{house.description}</p>
          {!user && <p className="form-ok">{t('academy.guest')} <Link className="link" to="/register">{t('academy.guestLink')}</Link>{t('academy.guestTail')}</p>}
        </motion.div>
      </section>
      <section className="section">
        <div className="wrap identity-grid">
          <div className="identity-card panel pad" style={{ '--h': house.color }}>
            <span className="eyebrow">{t('academy.identity')}</span>
            <h2 className="script identity-name">{identity.magicalName}</h2>
            <dl>
              <div><dt>{t('academy.house')}</dt><dd>{house.name} · {house.animal}</dd></div>
              <div><dt>{t('academy.wand')}</dt><dd>{identity.wand.wood}, {identity.wand.core}, {identity.wand.length}</dd></div>
              <div><dt>{t('academy.familiar')}</dt><dd>{identity.familiar}</dd></div>
              <div><dt>{t('academy.constellation')}</dt><dd>{identity.constellation}</dd></div>
              <div><dt>{t('academy.spell')}</dt><dd>{identity.signatureSpell}</dd></div>
              <div><dt>{t('academy.sigil')}</dt><dd>{t('academy.sigilNo', { n: String(identity.sigil).padStart(3, '0') })}</dd></div>
            </dl>
            <SpellCircle house={house} />
          </div>
          <Letter house={house} identity={identity} name={name} />
        </div>
      </section>
      {!user && <p className="center"><button className="link" onClick={onLeave}>{t('academy.again')}</button></p>}
    </>
  );
}

export default function Academy() {
  const { user } = useApp();
  const { t } = useI18n();
  const [me, setMe] = useState(undefined);
  const [stage, setStage] = useState('gate');
  const [houses, , reloadHouses] = useAsync(() => api.get('/academy/houses'), []);
  const [shop] = useAsync(() => api.get('/academy/shop'), []);

  useEffect(() => {
    document.title = `${t('academy.title')} · ${t('brand.name')}`;
    if (user) api.get('/academy/me').then((r) => setMe(r.sorted ? r : null)).catch(() => setMe(null));
    else setMe(storage.get('mc.guestHouse', null));
  }, [user]);

  if (me === undefined) return <Loader label={t('academy.creak')} />;

  return (
    <div className="academy">
      <HiddenWonder id="moon-feather" style={{ left: '50%', top: '30%' }} />
      {me ? <Profile result={me} onLeave={() => { storage.remove('mc.guestHouse'); setMe(null); setStage('gate'); }} />
        : stage === 'ceremony' ? <div className="wrap"><Ceremony onSorted={(r) => setMe(r)} /></div>
          : (
            <section className="academy-gate">
              <div className="academy-gate-scene"><Castle /></div>
              <div className="wrap academy-gate-text">
                <span className="eyebrow">{t('academy.eyebrow')}</span>
                <h1>{t('academy.h1a')} <em>{t('academy.h1b')}</em></h1>
                <p>{t('academy.intro')}</p>
                <button className="btn" onClick={() => setStage('ceremony')}>{t('academy.begin')}</button>
              </div>
            </section>
          )}
      <section className="section">
        <div className="wrap">
          <Chapter eyebrow={t('academy.housesEyebrow')} title={t('academy.housesTitle')} />
          {houses.error && <LoadError error={houses.error} onRetry={reloadHouses} />}
          <div className="houses">
            {(houses.data?.houses ?? []).map((h, i) => (
              <motion.article key={h.slug} className="house-card" style={{ '--h': h.color, '--a': h.accent }} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Crest house={h} size={84} />
                <h3>{h.name}</h3>
                <p className="house-motto">“{h.motto}”</p>
                <p className="muted">{h.virtues.join(' · ')}</p>
                <small>{t('academy.students', { n: h.members })}</small>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
      {shop.data?.products?.length > 0 && (
        <section className="section">
          <div className="wrap"><Chapter eyebrow={t('academy.shopEyebrow')} title={t('academy.shopTitle')}>{t('academy.shopBody')}</Chapter></div>
          <Ribbon>{shop.data.products.map((p, i) => <GiftTag key={p.slug} product={p} index={i} />)}</Ribbon>
        </section>
      )}
      <section className="section">
        <div className="wrap grid-3">
          <Link to="/games/mystery" className="academy-tile panel pad"><span className="eyebrow">{t('academy.tile1e')}</span><h3>{t('academy.tile1')}</h3></Link>
          <Link to="/games/quiz" className="academy-tile panel pad"><span className="eyebrow">{t('academy.tile2e')}</span><h3>{t('academy.tile2')}</h3></Link>
          <Link to="/games/hidden" className="academy-tile panel pad"><span className="eyebrow">{t('academy.tile3e')}</span><h3>{t('academy.tile3')}</h3></Link>
        </div>
      </section>
    </div>
  );
}
