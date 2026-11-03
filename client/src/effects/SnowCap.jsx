// Snow that settles on section edges. It grows slowly the longer the visitor stays (snow accumulation),
// driven by one shared CSS variable (--snow-depth) updated by <SnowAccumulator/>.
import { useEffect } from 'react';
import { useApp } from '../state/AppState.jsx';

export function SnowAccumulator() {
  const { calm } = useApp();
  useEffect(() => {
    const root = document.documentElement;
    if (calm) {
      root.style.setProperty('--snow-depth', '1');
      return undefined;
    }
    let depth = 0.35;
    root.style.setProperty('--snow-depth', String(depth));
    const id = setInterval(() => {
      if (document.hidden) return;
      depth = Math.min(1, depth + 0.035);
      root.style.setProperty('--snow-depth', depth.toFixed(3));
      if (depth >= 1) clearInterval(id);
    }, 4000);
    return () => clearInterval(id);
  }, [calm]);
  return null;
}

export default function SnowCap({ variant = 0, className = '' }) {
  const paths = [
    'M0 30 C 40 6, 80 34, 130 16 S 220 4, 270 22 S 360 34, 420 12 S 520 2, 580 24 S 680 36, 740 14 S 840 6, 900 22 S 980 30, 1000 18 L1000 0 L0 0 Z',
    'M0 22 C 60 34, 110 4, 170 18 S 260 36, 330 14 S 430 2, 490 26 S 600 34, 660 10 S 770 4, 830 24 S 950 32, 1000 12 L1000 0 L0 0 Z',
  ];
  return (
    <svg className={`snow-cap ${className}`} viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
      <path d={paths[variant % paths.length]} fill="var(--snow)" />
      <path d={paths[variant % paths.length]} fill="url(#snowShade)" opacity="0.5" />
      <defs>
        <linearGradient id="snowShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#bcd2ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}
