// When to play the Santa intro.
//  • preference 'auto' (default): full intro on the very first visit, short intro on later visits,
//    at most once per browser session, never on in-app navigation.
//  • 'full' / 'short' / 'off' can be chosen by the visitor (footer + account settings).
//  • Skipped entirely for reduced motion / calm mode and when landing on shopping-critical pages.
import { storage } from '../lib.js';

const PREF = 'mc.introPref';
const SEEN = 'mc.introSeen';
const SESSION = 'mc.introSession';
const NO_INTRO = [/^\/checkout/, /^\/cart/, /^\/order/, /^\/pay\//, /^\/track/, /^\/admin/, /^\/login/, /^\/register/];

export const getIntroPref = () => storage.get(PREF, 'auto');
export const setIntroPref = (v) => storage.set(PREF, v);

export function introPlan(pathname, calm) {
  const pref = getIntroPref();
  if (pref === 'off' || calm) return null;
  if (NO_INTRO.some((re) => re.test(pathname))) return null;
  try { if (sessionStorage.getItem(SESSION)) return null; } catch { /* ignore */ }
  if (pref === 'full' || pref === 'short') return pref;
  return storage.get(SEEN, false) ? 'short' : 'full';
}

export function markIntroSeen() {
  storage.set(SEEN, true);
  try { sessionStorage.setItem(SESSION, '1'); } catch { /* ignore */ }
}
