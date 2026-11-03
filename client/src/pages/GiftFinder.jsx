// The Compass of Wishes — a guided gift discovery journey.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { Empty, GiftTag, Loader } from '../components/Common.jsx';
import { HiddenWonder } from '../components/Shell.jsx';
import { useI18n } from '../i18n/index.jsx';

const STEPS = [
  { key: 'recipient', q: 's1', options: [['child', 'r_child', '🧸'], ['teen', 'r_teen', '🎧'], ['partner', 'r_partner', '❤️'], ['parent', 'r_parent', '🏡'], ['grandparent', 'r_grandparent', '🫖'], ['friend', 'r_friend', '🤝'], ['colleague', 'r_colleague', '💼'], ['self', 'r_self', '✨']] },
  { key: 'age', q: 's2', options: [['kids', 'a_kids', '⛄'], ['teens', 'a_teens', '🛷'], ['adults', 'a_adults', '🎄'], ['seniors', 'a_seniors', '🕯️']] },
  { key: 'interests', multi: true, q: 's3', hint: 's3hint', options: [['decor', 'i_decor', '🎀'], ['cozy', 'i_cozy', '🧦'], ['magic', 'i_magic', '🪄'], ['cooking', 'i_cooking', '🍪'], ['reading', 'i_reading', '📖'], ['fashion', 'i_fashion', '🧣'], ['games', 'i_games', '🎲'], ['music', 'i_music', '🎶'], ['outdoors', 'i_outdoors', '🏔️'], ['crafts', 'i_crafts', '🧶']] },
  { key: 'budget', q: 's4', options: [['0-8000', 'b1', '🪙'], ['8000-20000', 'b2', '💰'], ['20000-40000', 'b3', '💎'], ['40000-200000', 'b4', '🌟']] },
  { key: 'personality', q: 's5', options: [['dreamer', 'p_dreamer', '🌙'], ['classic', 'p_classic', '🎻'], ['playful', 'p_playful', '🎈'], ['elegant', 'p_elegant', '🥂'], ['adventurous', 'p_adventurous', '🧭'], ['cozy', 'p_cozy', '🛋️']] },
  { key: 'occasion', q: 's6', options: [['christmas', 'o_christmas', '🎄'], ['new_year', 'o_new_year', '🎆'], ['secret_santa', 'o_secret_santa', '🎅'], ['thank_you', 'o_thank_you', '💌'], ['family', 'o_family', '👨‍👩‍👧']] },
];

export default function GiftFinder() {
  const [params] = useSearchParams();
  const { persona } = useApp();
  const { t } = useI18n();
  const preset = params.get('for');
  const [answers, setAnswers] = useState(preset ? { recipient: preset, interests: [] } : { interests: [] });
  const [i, setI] = useState(preset ? 1 : 0);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const step = STEPS[i];
  useEffect(() => { document.title = `${t('finder.title')} · ${t('brand.name')}`; }, [t]);

  const pick = (v) => {
    if (step.multi) {
      const cur = answers.interests;
      setAnswers({ ...answers, interests: cur.includes(v) ? cur.filter((x) => x !== v) : cur.length < 3 ? [...cur, v] : cur });
      return;
    }
    setAnswers({ ...answers, [step.key]: v });
    setTimeout(() => next({ ...answers, [step.key]: v }), 250);
  };
  const next = (a = answers) => (i < STEPS.length - 1 ? setI(i + 1) : find(a));
  const find = async (a) => {
    setI(STEPS.length);
    setError(null);
    const [min, max] = (a.budget ?? '0-200000').split('-').map(Number);
    try {
      const r = await api.post('/gift-finder', { recipient: a.recipient, age: a.age, interests: a.interests, budget: { min, max }, personality: a.personality, occasion: a.occasion });
      setResults(r.products);
    } catch (e) {
      setError(e);
    }
  };
  const restart = () => { setAnswers({ interests: [] }); setResults(null); setI(0); };
  const needle = (i / STEPS.length) * 300 - 60;

  return (
    <div className="finder wrap">
      <HiddenWonder id="tiny-reindeer" style={{ right: '4%', top: '6%' }} />
      <header className="finder-head">
        <motion.svg className="finder-compass" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="92" fill="rgba(14,24,56,0.7)" stroke="#f2c46d" strokeOpacity="0.6" />
          {Array.from({ length: 36 }, (_, k) => <line key={k} x1="100" y1="12" x2="100" y2={k % 9 === 0 ? 26 : 18} stroke="#f2c46d" strokeOpacity="0.5" transform={`rotate(${k * 10} 100 100)`} />)}
          <motion.g animate={{ rotate: results ? 720 + 45 : needle }} transition={{ type: 'spring', damping: 9, stiffness: 40 }} style={{ originX: '100px', originY: '100px' }}>
            <polygon points="100,26 109,100 100,174 91,100" fill="#c8102e" />
            <polygon points="100,100 109,100 100,174 91,100" fill="#f6f8ff" />
          </motion.g>
          <circle cx="100" cy="100" r="7" fill="#f2c46d" />
        </motion.svg>
        <div>
          <span className="eyebrow">{t('finder.eyebrow')}</span>
          <h1>{results ? <>{t('finder.h1Result')} <em>{t('finder.here')}</em></> : <>{t('finder.h1a')} <em>{t('finder.h1b')}</em> {t('finder.h1c')}</>}</h1>
          <ol className="finder-path" aria-label={t('finder.progress')}>
            {STEPS.map((s, k) => <li key={s.key} className={k < i ? 'done' : k === i ? 'now' : ''}><button disabled={k > i || !!results} onClick={() => { setResults(null); setI(k); }}>{k + 1}</button></li>)}
          </ol>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {i < STEPS.length ? (
          <motion.section key={step.key} className="finder-step" initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }} transition={{ duration: 0.45 }}>
            <h2>{t(`finder.${step.q}`)}</h2>
            {step.hint && <p className="muted">{t(`finder.${step.hint}`)}</p>}
            <div className="finder-options">
              {step.options.map(([v, l, icon], k) => {
                const on = step.multi ? answers.interests.includes(v) : answers[step.key] === v;
                return (
                  <motion.button key={v} className={`finder-option ${on ? 'on' : ''}`} onClick={() => pick(v)} aria-pressed={on}
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.04 }} whileTap={{ scale: 0.95 }}>
                    <span aria-hidden="true">{icon}</span>{t(`finder.${l}`)}
                  </motion.button>
                );
              })}
            </div>
            <div className="row">
              {i > 0 && <button className="btn btn-ghost" onClick={() => setI(i - 1)}>← {t('common.back')}</button>}
              {(step.multi || answers[step.key]) && <button className="btn" onClick={() => next()} disabled={step.multi && answers.interests.length === 0}>{i === STEPS.length - 1 ? t('finder.show') : t('common.next')}</button>}
              {!step.multi && !answers[step.key] && <button className="link" onClick={() => next()}>{t('finder.skipQ')}</button>}
            </div>
          </motion.section>
        ) : (
          <motion.section key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {error && <div className="form-error">{error.message}</div>}
            {!results && !error ? <Loader label={t('finder.spinning')} /> : results?.length === 0 ? (
              <Empty title={t('finder.undecided')}>
                <p className="muted">{t('finder.undecidedBody')}</p>
                <button className="btn" onClick={restart}>{t('finder.again')}</button>
              </Empty>
            ) : results && (
              <>
                <p className="finder-summary">
                  {t('finder.summary', { name: persona?.name && persona.name !== 'Traveller' ? `${persona.name}, ` : '', n: results.length })}
                </p>
                <div className="tag-grid finder-results">{results.map((p, k) => <GiftTag key={p.slug} product={p} index={k} variant={k === 0 ? 'window' : 'tag'} />)}</div>
                <div className="row center-row"><button className="btn btn-ghost" onClick={restart}>{t('finder.someoneElse')}</button><Link className="btn" to="/shop">{t('finder.browse')}</Link></div>
              </>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
