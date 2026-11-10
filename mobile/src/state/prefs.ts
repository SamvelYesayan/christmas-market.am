// Device preferences (non-secret): language, calm mode, haptics, analytics consent, reminders, guest persona.
import { create } from 'zustand';
import { AccessibilityInfo } from 'react-native';
import * as Crypto from 'expo-crypto';
import { KEYS, getJson, setJson, getItem, setItem } from '@/lib/secureStorage';
import { useLangStore, type Lang } from '@/i18n';
import type { Atmosphere } from '@/api/types';

export interface Persona {
  name: string;
  atmosphere: Atmosphere;
  preferences: Record<string, unknown>;
}

interface Prefs {
  lang: Lang;
  calm: boolean;
  haptics: boolean;
  analytics: boolean;
  reminders: boolean;
}

interface PrefsState extends Prefs {
  systemReduceMotion: boolean;
  persona: Persona | null;
  visitorId: string | null;
  loaded: boolean;
  load: () => Promise<void>;
  update: (p: Partial<Prefs>) => void;
  setPersona: (p: Persona | null) => void;
}

const DEFAULTS: Prefs = { lang: 'hy', calm: false, haptics: true, analytics: false, reminders: false };

export const usePrefs = create<PrefsState>((set, get) => ({
  ...DEFAULTS,
  systemReduceMotion: false,
  persona: null,
  visitorId: null,
  loaded: false,
  load: async () => {
    const [saved, persona, reduce] = await Promise.all([
      getJson<Partial<Prefs>>(KEYS.prefs, {}),
      getJson<Persona | null>(KEYS.persona, null),
      AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
    ]);
    const prefs = { ...DEFAULTS, ...saved };
    let visitorId: string | null = null;
    if (prefs.analytics) visitorId = await ensureVisitorId();
    useLangStore.getState().setLang(prefs.lang);
    set({ ...prefs, persona, systemReduceMotion: reduce, visitorId, loaded: true });
    AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => set({ systemReduceMotion: v }));
  },
  update: (p) => {
    const next = { ...pick(get()), ...p };
    if (p.lang) useLangStore.getState().setLang(p.lang);
    set(p);
    void setJson(KEYS.prefs, next);
    if (p.analytics === true) void ensureVisitorId().then((visitorId) => set({ visitorId }));
    if (p.analytics === false) set({ visitorId: null });
  },
  setPersona: (persona) => {
    set({ persona });
    void setJson(KEYS.persona, persona);
  },
}));

const pick = (s: Prefs): Prefs => ({ lang: s.lang, calm: s.calm, haptics: s.haptics, analytics: s.analytics, reminders: s.reminders });

async function ensureVisitorId() {
  let id = await getItem(KEYS.visitorId);
  if (!id) {
    id = Crypto.randomUUID();
    await setItem(KEYS.visitorId, id);
  }
  return id;
}

/** True when animations should be minimal (in-app calm mode or the OS setting). */
export const useCalm = () => usePrefs((s) => s.calm || s.systemReduceMotion);
