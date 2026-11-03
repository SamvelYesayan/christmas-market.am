import { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../api/client.js';
import { useApp } from '../../state/AppState.jsx';
import { useAsync } from '../../lib.js';
import Art from '../../art/Art.jsx';
import { Loader } from '../../components/Common.jsx';
import { GameFrame, SignInGate } from '../Games.jsx';
import { useI18n } from '../../i18n/index.jsx';

const RARITY = { common: '#a9c7ff', uncommon: '#7fe0c4', rare: '#c8a2ff', legendary: '#f2c46d' };

export default function Mystery() {
  const { user, rewardCelebration, toast } = useApp();
  const { t } = useI18n();
  const [state] = useAsync(() => api.get('/games/mystery'), [user?.id]);
  const [phase, setPhase] = useState('idle'); // idle | shaking | open
  const [result, setResult] = useState(null);

  if (state.loading) return <Loader />;
  const already = state.data?.openedToday;
  const shown = result ?? (already ? { reward: state.data.lastReward } : null);

  const open = async () => {
    setPhase('shaking');
    try {
      const [r] = await Promise.all([api.post('/games/mystery/open'), new Promise((res) => setTimeout(res, 1600))]);
      setResult(r);
      setPhase('open');
      rewardCelebration(r.reward);
    } catch (e) {
      setPhase('idle');
      toast(e.message, { tone: 'error' });
    }
  };

  return (
    <GameFrame title={t('games.mystery.title')}>
      <SignInGate>
        <div className="mystery">
          <motion.button className={`mystery-box ${phase}`} onClick={open} disabled={phase !== 'idle' || already} aria-label={t('games.mystery.aria')}
            animate={phase === 'shaking' ? { rotate: [0, -8, 8, -10, 10, -6, 6, 0], y: [0, -6, 0, -10, 0] } : {}} transition={{ duration: 1.6 }}>
            <Art art={{ type: 'giftbox', c1: '#2a4fa8', c2: '#f2c46d', mystery: true }} />
            {phase === 'open' && <span className="mystery-burst" style={{ '--r': RARITY[result?.rarity] ?? '#f2c46d' }} />}
          </motion.button>
          {shown?.reward ? (
            <motion.div className="panel pad center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {result?.rarity && <span className="badge" style={{ background: RARITY[result.rarity], color: '#0b1430' }}>{t(`games.mystery.${result.rarity}`)}</span>}
              <h3>{shown.reward.title}</h3>
              {shown.reward.couponCode && <p>{t('games.mystery.code')} <b className="gold">{shown.reward.couponCode}</b></p>}
              {shown.reward.payload?.text && <p className="muted">{shown.reward.payload.text}</p>}
              <p className="muted">{t('games.mystery.midnight')}</p>
            </motion.div>
          ) : <p className="muted center">{t('games.mystery.hint')}</p>}
        </div>
      </SignInGate>
    </GameFrame>
  );
}
