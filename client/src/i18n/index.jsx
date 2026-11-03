// Bilingual UI: Armenian (default) and English. The choice is remembered in localStorage and a cookie
// (so the server answers in the same language) and sent with every API request.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import hy from './hy.js';
import en from './en.js';
import { setLocale } from '../api/client.js';

const DICTS = { hy, en };
export const LANGS = ['hy', 'en'];
const KEY = 'mc.lang';

function initialLang() {
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGS.includes(saved)) return saved;
  } catch { /* private mode */ }
  return 'hy'; // first-time visitors always see Armenian
}

const lookup = (dict, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict);

/** Plain translate function usable outside React (e.g. effects) — reads the current language. */
let currentLang = initialLang();
setLocale(currentLang);
export function translate(key, vars, lang = currentLang) {
  let s = lookup(DICTS[lang], key);
  if (s == null) s = lookup(DICTS.hy, key) ?? key;
  if (typeof s !== 'string' || !vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

const I18nCtx = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(currentLang);

  useEffect(() => {
    currentLang = lang;
    setLocale(lang);
    document.documentElement.lang = lang;
    try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
    document.cookie = `mc_lang=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, [lang]);

  const setLang = useCallback((l) => { if (LANGS.includes(l)) { currentLang = l; setLocale(l); setLangState(l); } }, []);

  const value = useMemo(() => {
    const t = (key, vars) => translate(key, vars, lang);
    const locale = lang === 'hy' ? 'hy-AM' : 'en-GB';
    return {
      lang,
      setLang,
      t,
      date: (d, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => (d ? new Date(d).toLocaleDateString(locale, opts) : '—'),
      dateShort: (d) => (d ? new Date(d).toLocaleDateString(locale) : '—'),
      dateTime: (d) => (d ? new Date(d).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }) : '—'),
      time: (d) => new Date(d).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
      month: (d) => new Date(d).toLocaleString(locale, { month: 'short' }),
      /** English needs "a"/"an"; Armenian has no article. */
      article: (word) => (lang === 'en' ? (/^[aeiou]/i.test(word) ? 'an' : 'a') : ''),
    };
  }, [lang, setLang]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);
export const useT = () => useContext(I18nCtx).t;

export function LangSwitch({ className = '' }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label={t('lang.label')}>
      {LANGS.map((l) => (
        <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)} aria-pressed={lang === l} lang={l} title={t(`lang.${l}Full`)}>
          {t(`lang.${l}`)}
        </button>
      ))}
      <span className="lang-switch-thumb" style={{ transform: `translateX(${lang === 'hy' ? 0 : 100}%)` }} aria-hidden="true" />
    </div>
  );
}
