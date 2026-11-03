// The Lantern Gate — first-visit ritual that personalises the whole village.
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../state/AppState.jsx';
import { useI18n } from '../i18n/index.jsx';
import { ATMOSPHERES } from '../lib.js';
import Art from '../art/Art.jsx';
import { celebrate } from '../effects/celebrate.js';

const QUESTIONS = [
  { key: 'favorite', q: 'q1', options: [['lights', 'q1a', '✨'], ['baking', 'q1b', '🍪'], ['stories', 'q1c', '📖'], ['snow', 'q1d', '❄️'], ['magic', 'q1e', '🪄']] },
  { key: 'tradition', q: 'q2', options: [['tree', 'q2a', '🎄'], ['wrapping', 'q2b', '🎁'], ['table', 'q2c', '🍽️'], ['walks', 'q2d', '🌙']] },
  { key: 'giftStyle', q: 'q3', options: [['handmade', 'q3a', '🧶'], ['surprise', 'q3b', '🎉'], ['useful', 'q3c', '🕯️'], ['magical', 'q3d', '🔮']] },
];

const ATMO_ART = { cozy: { type: 'candle', c1: '#a0522d', c2: '#ffb347' }, grand: { type: 'ornament', c1: '#8e0a20', c2: '#f2c46d' }, enchanted: { type: 'lantern', c1: '#1b2a5c', c2: '#a9c7ff' }, nordic: { type: 'tree', c1: '#1d6b6b', c2: '#7fe0c4', frosted: true } };

const step = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -30 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
};

export default function WelcomeGate({ onClose }) {
  const { savePersona } = useApp();
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [name, setName] = useState('');
  const [answers, setAnswers] = useState({});
  const [qi, setQi] = useState(0);
  const [atmosphere, setAtmosphere] = useState(null);
  const [remember, setRemember] = useState(true);
  const display = name.trim() || t('greet.traveller');
  const [greetPre, greetPost] = t('gate.welcome', { name: '\u0000' }).split('\u0000');

  const shake = () => {
    setShaking(true);
    setTimeout(() => { setShaking(false); setI(1); }, 900);
  };
  const answer = (key, value) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    setTimeout(() => (qi < QUESTIONS.length - 1 ? setQi(qi + 1) : setI(3)), 380);
  };
  const finish = async () => {
    const interestMap = { lights: 'decor', baking: 'cooking', stories: 'reading', snow: 'outdoors', magic: 'magic', handmade: 'crafts', magical: 'magic', useful: 'cozy', surprise: 'games' };
    const interests = [...new Set([answers.favorite, answers.giftStyle].map((v) => interestMap[v]).filter(Boolean))];
    await savePersona({ name: name.trim() || 'Traveller', atmosphere, preferences: { ...answers, interests } }, { remember });
    document.documentElement.dataset.atmosphere = atmosphere;
    setI(5);
    celebrate({ intensity: 1.3 });
  };
  const skip = () => {
    savePersona({ name: 'Traveller', atmosphere: 'enchanted', preferences: {} }, { remember: false });
    onClose();
  };

  return (
    <motion.div className="gate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.7 }} role="dialog" aria-modal="true" aria-label={t('gate.label')}>
      <div className="gate-aurora" aria-hidden="true" />
      {i < 5 && <button className="gate-skip" onClick={skip}>{t('gate.skip')}</button>}
      <div className="gate-progress" aria-hidden="true">{[0, 1, 2, 3, 4].map((n) => <span key={n} className={n <= i ? 'on' : ''} />)}</div>
      <AnimatePresence mode="wait">
        {i === 0 && (
          <motion.div key="s0" className="gate-step" {...step}>
            <span className="eyebrow">{t('gate.found')}</span>
            <h1 className="gate-title">{t('gate.title1')}<br /><em>{t('gate.title2')}</em></h1>
            <button className={`gate-globe ${shaking ? 'shaking' : ''}`} onClick={shake} aria-label={t('gate.shakeAria')}>
              <Art art={{ type: 'snowglobe', c1: '#0b1430', c2: '#f2c46d', scene: 'village' }} />
            </button>
            <p className="muted">{t('gate.shake')}</p>
          </motion.div>
        )}
        {i === 1 && (
          <motion.form key="s1" className="gate-step gate-letter" {...step} onSubmit={(e) => { e.preventDefault(); setI(2); }}>
            <p className="script gate-letter-hello">{t('gate.dear')}</p>
            <p>{t('gate.askName')}</p>
            <input className="gate-name" value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder={t('gate.namePlaceholder')} autoFocus aria-label={t('gate.namePlaceholder')} />
            <button className="btn btn-red" type="submit" disabled={!name.trim()}>{t('gate.light')}</button>
          </motion.form>
        )}
        {i === 2 && (
          <motion.div key={`s2-${qi}`} className="gate-step" {...step}>
            <span className="eyebrow">{t('gate.question', { name: name ? `${name}, ` : '', i: qi + 1, n: QUESTIONS.length })}</span>
            <h2>{t(`gate.${QUESTIONS[qi].q}`)}</h2>
            <div className="gate-options">
              {QUESTIONS[qi].options.map(([value, label, icon], k) => (
                <motion.button key={value} className={`gate-option ${answers[QUESTIONS[qi].key] === value ? 'on' : ''}`} onClick={() => answer(QUESTIONS[qi].key, value)}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.07 }} whileHover={{ y: -4 }} whileTap={{ scale: 0.96 }}>
                  <span className="gate-option-icon" aria-hidden="true">{icon}</span>{t(`gate.${label}`)}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
        {i === 3 && (
          <motion.div key="s3" className="gate-step" {...step}>
            <span className="eyebrow">{t('gate.chooseAtmo')}</span>
            <h2>{t('gate.atmoQ')}</h2>
            <div className="gate-atmos">
              {Object.entries(ATMOSPHERES).map(([key, a], k) => (
                <motion.button key={key} className={`atmo ${atmosphere === key ? 'on' : ''}`} style={{ '--a1': a.sky[0], '--a2': a.sky[1], '--acc': a.accent }}
                  onClick={() => { setAtmosphere(key); document.documentElement.dataset.atmosphere = key; }} aria-pressed={atmosphere === key}
                  initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.08 }}>
                  <div className="atmo-art"><Art art={ATMO_ART[key]} /></div>
                  <b>{t(`atmo.${key}`)}</b>
                  <small>{t(`atmo.${key}Blurb`)}</small>
                </motion.button>
              ))}
            </div>
            <button className="btn" disabled={!atmosphere} onClick={() => setI(4)}>{t('gate.thisOne')}</button>
          </motion.div>
        )}
        {i === 4 && (
          <motion.div key="s4" className="gate-step gate-letter" {...step}>
            <p className="script gate-letter-hello">{t('gate.lastThing', { name: display })}</p>
            <p>{t('gate.rememberBody')}</p>
            <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {t('gate.remember')}</label>
            <button className="btn btn-red" onClick={finish}>{t('gate.open')}</button>
          </motion.div>
        )}
        {i === 5 && (
          <motion.div key="s5" className="gate-step" {...step}>
            <motion.h1 className="gate-title" initial={{ letterSpacing: '0.3em', opacity: 0 }} animate={{ letterSpacing: '0em', opacity: 1 }} transition={{ duration: 1.4 }}>
              {greetPre}<span className="script gate-name-script">{display}</span>{greetPost}
            </motion.h1>
            <p className="gate-lead">{t('gate.waiting')}</p>
            <button className="btn" onClick={onClose}>{t('gate.step')}</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
