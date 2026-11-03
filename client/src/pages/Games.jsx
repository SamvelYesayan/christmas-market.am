// The Frost Fair — games hub and router.
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api/client.js';
import { useApp } from '../state/AppState.jsx';
import { useAsync } from '../lib.js';
import Art from '../art/Art.jsx';
import { Chapter, Loader } from '../components/Common.jsx';
import { HiddenWonder } from '../components/Shell.jsx';
import { useI18n } from '../i18n/index.jsx';

const CatchGame = lazy(() => import('./games/CatchGame.jsx'));
const TreeGame = lazy(() => import('./games/TreeGame.jsx'));
const Quiz = lazy(() => import('./games/Quiz.jsx'));
const Wheel = lazy(() => import('./games/Wheel.jsx'));
const Mystery = lazy(() => import('./games/Mystery.jsx'));
const Hidden = lazy(() => import('./games/Hidden.jsx'));

const GAME_ART = {
  catch: { type: 'sleigh', c1: '#c8102e' },
  tree: { type: 'tree', c1: '#0f6b4f', c2: '#f2c46d' },
  mystery: { type: 'giftbox', c1: '#2a4fa8', c2: '#f2c46d', mystery: true },
  quiz: { type: 'book', c1: '#7a2a1e' },
  hidden: { type: 'key', c1: '#f2c46d' },
  wheel: { type: 'wheel' },
};

export function GameFrame({ title, children, back = true }) {
  const { t } = useI18n();
  return (
    <div className="game-frame wrap">
      {back && <Link to="/games" className="link game-back">{t('games.back')}</Link>}
      <h1 className="game-title">{title}</h1>
      {children}
    </div>
  );
}

export function SignInGate({ children }) {
  const { user } = useApp();
  const { t } = useI18n();
  if (user) return children;
  return (
    <div className="panel pad center game-signin">
      <p>{t('games.signInBody')}</p>
      <Link className="btn" to="/login?next=/games">{t('games.signInBtn')}</Link>
    </div>
  );
}

function Challenges() {
  const { user, rewardCelebration, toast } = useApp();
  const { t } = useI18n();
  const [state, setState] = useAsync(() => api.get('/challenges/today'), [user?.id]);
  const claim = async (c) => {
    try {
      const r = await api.post(`/challenges/${c.id}/claim`);
      rewardCelebration(r.reward);
      setState((s) => ({ ...s, data: { ...s.data, challenges: s.data.challenges.map((x) => (x.id === c.id ? { ...x, claimed: true } : x)) } }));
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };
  const list = state.data?.challenges ?? [];
  if (!list.length) return null;
  return (
    <section className="challenges panel pad">
      <span className="eyebrow">{t('games.challenge')}</span>
      {list.map((c) => (
        <div key={c.id} className="challenge">
          <div><h3>{c.title}</h3><p className="muted">{c.description}</p></div>
          <div className="challenge-reward">+{c.rewardPoints} ✨</div>
          {c.claimed ? <span className="badge badge-green">{t('games.claimed')}</span>
            : user ? <button className="btn btn-sm" disabled={!c.complete} onClick={() => claim(c)}>{c.complete ? t('games.claim') : t('games.notDone')}</button>
              : <Link className="btn btn-sm btn-ghost" to="/login">{t('common.signIn')}</Link>}
        </div>
      ))}
    </section>
  );
}

function Hub() {
  const { user } = useApp();
  const { t } = useI18n();
  const [state] = useAsync(() => api.get('/games'), [user?.id]);
  useEffect(() => { document.title = `${t('games.title')} · ${t('brand.name')}`; }, [t]);
  return (
    <div className="wrap fair">
      <HiddenWonder id="sugar-quill" style={{ right: '6%', top: '2%' }} />
      <header className="page-head">
        <span className="eyebrow">{t('games.title')}</span>
        <h1>{t('games.h1a')} <em>{t('games.h1b')}</em></h1>
        <p>{t('games.intro')}</p>
      </header>
      <Challenges />
      {state.loading ? <Loader /> : (
        <div className="fair-grid">
          {state.data?.games.map((g, i) => {
            const used = g.playsPerDay != null && g.playsToday >= g.playsPerDay;
            return (
              <motion.div key={g.key} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                <Link to={`/games/${g.key}`} className={`booth booth-${i % 3}`}>
                  <span className="booth-roof" aria-hidden="true" />
                  <span className="booth-art"><Art art={GAME_ART[g.key]} /></span>
                  <h3>{g.title}</h3>
                  <p className="muted">{g.description}</p>
                  {user && g.playsPerDay != null && <span className={`booth-plays ${used ? 'used' : ''}`}>{used ? t('games.tomorrow') : t('games.playsLeft', { left: g.playsPerDay - g.playsToday, total: g.playsPerDay })}</span>}
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
      <section className="section"><Chapter eyebrow={t('games.rules')} title={t('games.rulesTitle')} />
        <ul className="perks">
          <li><b>{t('games.rule1')}</b>{t('games.rule1b')}</li>
          <li><b>{t('games.rule2')}</b>{t('games.rule2b')}</li>
          <li><b>{t('games.rule3')}</b>{t('games.rule3b')}</li>
          <li><b>{t('games.rule4')}</b>{t('games.rule4b')}</li>
        </ul>
      </section>
    </div>
  );
}

export default function Games() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<Loader label={t('games.setting')} />}>
      <Routes>
        <Route index element={<Hub />} />
        <Route path="catch" element={<CatchGame />} />
        <Route path="tree" element={<TreeGame />} />
        <Route path="quiz" element={<Quiz />} />
        <Route path="wheel" element={<Wheel />} />
        <Route path="mystery" element={<Mystery />} />
        <Route path="hidden" element={<Hidden />} />
      </Routes>
    </Suspense>
  );
}
