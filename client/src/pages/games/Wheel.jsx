// The Christmas Wheel — the server chooses the prize; the wheel only shows it (GSAP spin).
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { useApp } from '../../state/AppState.jsx';
import { useAsync } from '../../lib.js';
import { Loader } from '../../components/Common.jsx';
import { GameFrame, SignInGate } from '../Games.jsx';
import { useI18n } from '../../i18n/index.jsx';

export default function Wheel() {
  const { user, rewardCelebration, toast } = useApp();
  const { t } = useI18n();
  const [state] = useAsync(() => api.get('/games/wheel'), [user?.id]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const wheel = useRef(null);
  const rotation = useRef(0);
  useEffect(() => { if (state.data?.lastReward) setResult(state.data.lastReward); }, [state.data]);

  if (state.loading) return <Loader />;
  const segs = state.data?.segments ?? [];
  const n = segs.length || 1;
  const slice = 360 / n;

  const spin = async () => {
    setSpinning(true);
    try {
      const r = await api.post('/games/wheel/spin');
      const target = 360 * 6 + (360 - (r.segmentIndex * slice + slice / 2));
      const { gsap } = await import('gsap');
      const from = rotation.current % 360;
      rotation.current = target;
      await gsap.fromTo(wheel.current, { rotate: from }, { rotate: target, duration: document.documentElement.classList.contains('calm') ? 0.01 : 5, ease: 'power4.out' });
      setResult(r.reward);
      rewardCelebration(r.reward);
    } catch (e) {
      toast(e.message, { tone: 'error' });
    } finally {
      setSpinning(false);
    }
  };

  return (
    <GameFrame title={t('games.wheel.title')}>
      <SignInGate>
        <div className="wheel-stage">
          <div className="wheel-pointer" aria-hidden="true">▼</div>
          <svg ref={wheel} viewBox="-110 -110 220 220" className="wheel" role="img" aria-label={t('games.wheel.aria')}>
            {segs.map((s, k) => {
              const a1 = ((k * slice - 90) * Math.PI) / 180;
              const a2 = (((k + 1) * slice - 90) * Math.PI) / 180;
              const mid = ((k + 0.5) * slice - 90);
              return (
                <g key={s.id}>
                  <path d={`M0 0 L${Math.cos(a1) * 100} ${Math.sin(a1) * 100} A100 100 0 0 1 ${Math.cos(a2) * 100} ${Math.sin(a2) * 100}z`} fill={s.color} stroke="#f2c46d" strokeWidth="1" />
                  <text transform={`rotate(${mid}) translate(58 0)`} textAnchor="middle" dominantBaseline="middle" fill={s.color === '#f2c46d' ? '#24160a' : '#fff'} fontSize="9" fontWeight="700" style={{ fontFamily: 'var(--font-body)' }}>{s.label}</text>
                </g>
              );
            })}
            <circle r="100" fill="none" stroke="#f2c46d" strokeWidth="5" />
            {Array.from({ length: 24 }, (_, k) => <circle key={k} cx={Math.cos((k / 24) * Math.PI * 2) * 104} cy={Math.sin((k / 24) * Math.PI * 2) * 104} r="2.6" fill="#fff6dc" className="art-bulb" style={{ animationDelay: `${(k % 4) * 0.3}s` }} />)}
            <circle r="14" fill="#f2c46d" />
          </svg>
          <div className="center stack">
            {result ? (
              <div className="panel pad">
                <p className="eyebrow">{t('games.wheel.today')}</p>
                <h3>{result.title}</h3>
                {result.couponCode && <p>{t('games.wheel.code')} <b className="gold">{result.couponCode}</b></p>}
                {result.payload?.text && <p className="muted">{result.payload.text}</p>}
                <p className="muted">{t('games.wheel.rests')}</p>
              </div>
            ) : <button className="btn btn-red" onClick={spin} disabled={spinning || state.data?.spunToday}>{spinning ? t('games.wheel.spinning') : t('games.wheel.spin')}</button>}
          </div>
        </div>
      </SignInGate>
    </GameFrame>
  );
}
