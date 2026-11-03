// Small shared helpers.
import { useEffect, useState } from 'react';

const amd = new Intl.NumberFormat('en-US');
export const money = (n) => `${amd.format(Math.round(n ?? 0))} ֏`;

export const storage = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode — ignore */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export function useMediaQuery(q) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setMatch(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [q]);
  return match;
}

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Rough device capability score used to scale particle budgets. 0.35 (weak) … 1 (strong). */
export function deviceQuality() {
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = navigator.deviceMemory ?? 4;
  const small = window.innerWidth < 700;
  let q = Math.min(1, (cores / 8) * 0.6 + (mem / 8) * 0.4);
  if (small) q *= 0.6;
  return Math.max(0.35, q);
}

export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => alive && setState({ loading: false, data, error: null }),
      (error) => alive && setState({ loading: false, data: null, error }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [state, setState];
}

export const pct = (price, sale) => (sale != null && price ? Math.round((1 - sale / price) * 100) : 0);

/** Key of the greeting for the time of day (translate with t(`greet.${key}`)). */
export function timeGreeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'night';
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

// Atmosphere visuals; names/blurbs are translated via t('atmo.<key>') / t('atmo.<key>Blurb').
export const ATMOSPHERES = {
  cozy: { sky: ['#1a0f14', '#2a1418'], accent: '#ffb347', particles: '#ffcf8a' },
  grand: { sky: ['#120a1e', '#2a0f22'], accent: '#f2c46d', particles: '#ffe7a8' },
  enchanted: { sky: ['#060b1d', '#101c46'], accent: '#a9c7ff', particles: '#cfe0ff' },
  nordic: { sky: ['#04121a', '#0b2a33'], accent: '#7fe0c4', particles: '#e6fff7' },
};
