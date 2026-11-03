import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setVisitorId } from '../api/client.js';
import { prefersReducedMotion, storage } from '../lib.js';
import { celebrate } from '../effects/celebrate.js';
import { translate } from '../i18n/index.jsx';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const PERSONA_KEY = 'mc.persona';
const CALM_KEY = 'mc.calm';
const CONSENT_KEY = 'mc.consent';

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [cart, setCart] = useState({ items: [], count: 0, total: 0, subtotal: 0 });
  const [cartOpen, setCartOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [calm, setCalmState] = useState(() => storage.get(CALM_KEY, null) ?? prefersReducedMotion());
  const [consent, setConsentState] = useState(() => storage.get(CONSENT_KEY, null));
  // Guest persona lives in memory; it is written to this device only if the visitor opts in.
  const [guestPersona, setGuestPersona] = useState(() => storage.get(PERSONA_KEY, null));
  const [pioneerStatus, setPioneerStatus] = useState(null);
  const toastId = useRef(0);

  const toast = useCallback((message, opts = {}) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, message, tone: opts.tone ?? 'info', icon: opts.icon }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration ?? 4200);
  }, []);

  const refreshUser = useCallback(async () => {
    const { user: u } = await api.get('/auth/me');
    setUser(u);
    return u;
  }, []);

  const refreshCart = useCallback(async () => {
    const c = await api.get('/cart');
    setCart(c);
    return c;
  }, []);

  useEffect(() => {
    refreshUser().catch(() => {}).finally(() => setAuthReady(true));
    refreshCart().catch(() => {});
    api.get('/pioneer/status').then(setPioneerStatus).catch(() => {});
  }, [refreshUser, refreshCart]);

  useEffect(() => {
    if (consent?.analytics) {
      let id = storage.get('mc.vid');
      if (!id) {
        id = crypto.randomUUID();
        storage.set('mc.vid', id);
      }
      setVisitorId(id);
      api.post('/analytics', { type: 'visit', ref: document.referrer?.slice(0, 200) || undefined }).catch(() => {});
    } else {
      setVisitorId(null);
    }
  }, [consent?.analytics]);

  const persona = useMemo(() => {
    if (user) {
      return {
        name: user.profile.displayName?.split(' ')[0] ?? user.name.split(' ')[0],
        atmosphere: user.profile.atmosphere ?? guestPersona?.atmosphere ?? 'enchanted',
        preferences: user.profile.preferences ?? {},
        house: user.profile.house,
        identity: user.profile.identity,
        welcomed: true,
      };
    }
    return guestPersona;
  }, [user, guestPersona]);

  useEffect(() => {
    document.documentElement.dataset.atmosphere = persona?.atmosphere ?? 'enchanted';
    if (persona?.house?.slug) document.documentElement.dataset.house = persona.house.slug;
    else delete document.documentElement.dataset.house;
  }, [persona?.atmosphere, persona?.house?.slug]);

  useEffect(() => {
    document.documentElement.classList.toggle('calm', !!calm);
  }, [calm]);

  const setCalm = useCallback((v) => {
    setCalmState(v);
    storage.set(CALM_KEY, v);
  }, []);

  const setConsent = useCallback((c) => {
    setConsentState(c);
    storage.set(CONSENT_KEY, c);
  }, []);

  /** Save welcome answers: memory always; this device only with `remember`; account when signed in. */
  const savePersona = useCallback(async (p, { remember } = {}) => {
    const next = { ...p, welcomed: true, remember: !!remember };
    setGuestPersona(next);
    if (remember) storage.set(PERSONA_KEY, next);
    else storage.remove(PERSONA_KEY);
    if (user && user.consents.personalization) {
      await api.put('/me/profile', { displayName: p.name, atmosphere: p.atmosphere, preferences: p.preferences }).then(({ user: u }) => setUser(u)).catch(() => {});
    }
  }, [user]);

  const forgetPersona = useCallback(() => {
    storage.remove(PERSONA_KEY);
    setGuestPersona(null);
  }, []);

  const login = useCallback(async (email, password) => {
    const { user: u } = await api.post('/auth/login', { email, password });
    setUser(u);
    refreshCart().catch(() => {});
    return u;
  }, [refreshCart]);

  const register = useCallback(async (data) => {
    const profile = guestPersona ? { displayName: guestPersona.name, atmosphere: guestPersona.atmosphere, preferences: guestPersona.preferences } : undefined;
    const { user: u } = await api.post('/auth/register', { ...data, profile });
    setUser(u);
    refreshCart().catch(() => {});
    celebrate({ intensity: 1 });
    return u;
  }, [guestPersona, refreshCart]);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setUser(null);
    setCart({ items: [], count: 0, total: 0, subtotal: 0 });
  }, []);

  const addToCart = useCallback(async (variantId, quantity = 1, personalization, originEl) => {
    const c = await api.post('/cart/items', { variantId, quantity, personalization: personalization || undefined });
    setCart(c);
    window.dispatchEvent(new CustomEvent('mc:fly-to-sleigh', { detail: { from: originEl?.getBoundingClientRect?.() } }));
    return c;
  }, []);

  /** Show a reward from the server with the shared celebration effect. */
  const rewardCelebration = useCallback((reward, achievement) => {
    if (reward) {
      celebrate({ intensity: reward.kind === 'coupon' ? 1.2 : 0.8 });
      const msg = reward.kind === 'points'
        ? translate('reward.stardust', { n: reward.points, title: reward.title })
        : reward.kind === 'coupon' ? translate('reward.code', { title: reward.title, code: reward.couponCode }) : reward.title;
      toast(msg, { tone: 'reward', icon: reward.kind === 'coupon' ? '🎟' : '✨', duration: 6000 });
    }
    if (achievement) {
      setTimeout(() => {
        celebrate({ intensity: 0.6, palette: 'gold' });
        toast(translate('reward.achievement', { title: achievement.title }), { tone: 'reward', icon: '🏅', duration: 6000 });
      }, reward ? 900 : 0);
    }
  }, [toast]);

  const value = {
    user, authReady, refreshUser, login, register, logout, setUser,
    cart, setCart, refreshCart, addToCart, cartOpen, setCartOpen,
    persona, savePersona, forgetPersona,
    calm, setCalm, consent, setConsent,
    toasts, toast, rewardCelebration,
    pioneerStatus,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
