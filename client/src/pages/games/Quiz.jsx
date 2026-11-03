import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../../api/client.js';
import { useApp } from '../../state/AppState.jsx';
import { GameFrame, SignInGate } from '../Games.jsx';
import { useI18n } from '../../i18n/index.jsx';

export default function Quiz() {
  const { rewardCelebration, toast } = useApp();
  const { t } = useI18n();
  const [quiz, setQuiz] = useState(null);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [final, setFinal] = useState(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    try {
      setQuiz(await api.post('/games/quiz/start'));
      setI(0);
      setAnswer(null);
      setFinal(null);
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };
  const choose = async (idx) => {
    if (answer || busy) return;
    setBusy(true);
    try {
      const q = quiz.questions[i];
      const r = await api.post('/games/quiz/answer', { sessionId: quiz.sessionId, questionId: q.id, answer: idx });
      setAnswer({ ...r, chosen: idx });
      if (r.done) {
        setFinal(r);
        rewardCelebration(r.reward, r.achievement);
        if (r.bonus) setTimeout(() => rewardCelebration(r.bonus), 1400);
      }
    } catch (e) {
      toast(e.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  const next = () => { setI(i + 1); setAnswer(null); };
  const q = quiz?.questions[i];

  return (
    <GameFrame title={t('games.quiz.title')}>
      <SignInGate>
        <div className="quiz panel pad">
          {!quiz ? (
            <div className="center stack">
              <p>{t('games.quiz.intro')}</p>
              <button className="btn" onClick={start}>{t('games.quiz.open')}</button>
            </div>
          ) : final && answer?.done && !q ? null : (
            <AnimatePresence mode="wait">
              <motion.div key={i} initial={{ opacity: 0, rotateY: -30 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0, rotateY: 30 }} transition={{ duration: 0.4 }}>
                <p className="eyebrow">{t('games.quiz.q', { i: i + 1, n: quiz.questions.length })}</p>
                <h2 className="quiz-q">{q.question}</h2>
                <div className="quiz-options">
                  {q.options.map((o, k) => {
                    const state = answer ? (k === answer.correctIndex ? 'right' : k === answer.chosen ? 'wrong' : 'dim') : '';
                    return <button key={k} className={`quiz-opt ${state}`} onClick={() => choose(k)} disabled={!!answer}>{o}</button>;
                  })}
                </div>
                {answer && (
                  <motion.div className="quiz-feedback" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <p><b>{answer.correct ? t('games.quiz.correct') : t('games.quiz.wrong')}</b> {answer.funFact}</p>
                    {answer.done ? (
                      <div className="stack">
                        <h3>{t('games.quiz.scored', { s: answer.score, n: answer.total })}</h3>
                        {answer.reward && <p className="stardust">+{answer.reward.points} {t('common.stardust')}</p>}
                        {answer.bonus && <p className="gold">{t('games.quiz.perfect')} <b>{answer.bonus.couponCode}</b></p>}
                        <p className="muted">{t('games.quiz.tomorrow')}</p>
                      </div>
                    ) : <button className="btn btn-sm" onClick={next}>{t('games.quiz.next')}</button>}
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </SignInGate>
    </GameFrame>
  );
}
