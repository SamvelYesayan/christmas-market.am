// Session state. The session token (and the guest-cart token) are kept in memory for requests and persisted ONLY in
// SecureStore. The server stays the authority: on launch the token is checked with GET /auth/me.
import { create } from 'zustand';
import { KEYS, getItem, setItem } from '@/lib/secureStorage';
import type { MobileSession, User } from '@/api/types';

export type SessionStatus = 'booting' | 'signedOut' | 'signedIn';

interface SessionState {
  status: SessionStatus;
  token: string | null;
  cartToken: string | null;
  user: User | null;
  /** Load persisted tokens (call once at launch, before the first request). */
  hydrate: () => Promise<void>;
  setSession: (session: MobileSession | undefined, user: User | null) => Promise<void>;
  setUser: (user: User | null) => void;
  setCartToken: (token: string | null) => void;
  /** Forget the session locally (logout, expired or revoked token). */
  clear: () => Promise<void>;
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'booting',
  token: null,
  cartToken: null,
  user: null,
  hydrate: async () => {
    const [token, cartToken] = await Promise.all([getItem(KEYS.session), getItem(KEYS.cartToken)]);
    set({ token, cartToken });
  },
  setSession: async (session, user) => {
    if (session?.token) {
      await setItem(KEYS.session, session.token);
      // Signing in merges the guest cart into the account cart on the server; the guest token is spent.
      await setItem(KEYS.cartToken, null);
      set({ token: session.token, cartToken: null });
    }
    set({ user, status: user ? 'signedIn' : 'signedOut' });
  },
  setUser: (user) => set({ user, status: user ? 'signedIn' : get().token ? get().status : 'signedOut' }),
  setCartToken: (cartToken) => {
    if (cartToken === get().cartToken) return;
    set({ cartToken });
    void setItem(KEYS.cartToken, cartToken);
  },
  clear: async () => {
    set({ token: null, user: null, status: 'signedOut' });
    await setItem(KEYS.session, null);
  },
}));

export const useUser = () => useSession((s) => s.user);
export const useIsSignedIn = () => useSession((s) => s.status === 'signedIn');
