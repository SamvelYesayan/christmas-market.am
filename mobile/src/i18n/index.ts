// Bilingual UI — Armenian (default) and English, same dictionaries as the website plus mobile-only strings.
// The chosen language is sent to the API as X-Locale so server content and messages arrive translated.
import { create } from 'zustand';
import { useCallback, useMemo } from 'react';
import hyWeb from './hy.web';
import enWeb from './en.web';
import { mobileEn, mobileHy } from './mobile';

export type Lang = 'hy' | 'en';
export const LANGS: Lang[] = ['hy', 'en'];

type Dict = Record<string, unknown>;
const DICTS: Record<Lang, Dict> = {
  hy: { ...(hyWeb as Dict), ...mobileHy },
  en: { ...(enWeb as Dict), ...mobileEn },
};

const lookup = (dict: Dict, key: string): unknown => key.split('.').reduce<unknown>((o, k) => (o == null ? o : (o as Dict)[k]), dict);

// Website strings sometimes carry decorative emoji/symbols; the app draws its own icons instead.
const DECOR = /^[\s←-⇿☀-➿⬀-⯿\u{1F000}-\u{1FAFF}️✦✨]+|[\s←-⇿☀-➿⬀-⯿\u{1F000}-\u{1FAFF}️✦✨]+$/gu;
export const stripDecor = (s: string) => s.replace(DECOR, '').trim();

export function translate(lang: Lang, key: string, vars?: Record<string, string | number | null | undefined>): string {
  let s = lookup(DICTS[lang], key);
  if (s == null) s = lookup(DICTS.hy, key);
  if (typeof s !== 'string') return Array.isArray(s) ? s.join('\n\n') : key;
  const out = vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : s;
  return stripDecor(out);
}

/** Paragraph arrays (e.g. info.terms.body). */
export function translateList(lang: Lang, key: string): string[] {
  const v = lookup(DICTS[lang], key) ?? lookup(DICTS.hy, key);
  if (Array.isArray(v)) return v.map(String);
  if (v && typeof v === 'object') return Object.values(v as Dict).map(String);
  return typeof v === 'string' ? [v] : [];
}

export const hasKey = (lang: Lang, key: string) => typeof lookup(DICTS[lang], key) === 'string';

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const useLangStore = create<LangState>((set) => ({
  lang: 'hy', // first launch is Armenian, like the website
  setLang: (lang) => set({ lang }),
}));

/** Current language outside React (API client, notifications). */
export const currentLang = () => useLangStore.getState().lang;
export const t = (key: string, vars?: Record<string, string | number | null | undefined>) => translate(currentLang(), key, vars);

export function useI18n() {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const tt = useCallback((key: string, vars?: Record<string, string | number | null | undefined>) => translate(lang, key, vars), [lang]);
  return useMemo(() => {
    const locale = lang === 'hy' ? 'hy-AM' : 'en-GB';
    const fmt = (d: string | number | Date | null | undefined, opts: Intl.DateTimeFormatOptions) => {
      if (!d) return '—';
      try {
        return new Date(d).toLocaleDateString(locale, opts);
      } catch {
        return new Date(d).toDateString();
      }
    };
    return {
      lang,
      setLang,
      t: tt,
      list: (key: string) => translateList(lang, key),
      has: (key: string) => hasKey(lang, key),
      date: (d: string | number | Date | null | undefined) => fmt(d, { day: 'numeric', month: 'long', year: 'numeric' }),
      dateShort: (d: string | number | Date | null | undefined) => fmt(d, { day: 'numeric', month: 'short', year: 'numeric' }),
      dateTime: (d: string | number | Date | null | undefined) => {
        if (!d) return '—';
        try {
          return new Date(d).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
        } catch {
          return new Date(d).toString();
        }
      },
    };
  }, [lang, setLang, tt]);
}
