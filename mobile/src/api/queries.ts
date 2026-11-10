// TanStack Query keys and shared hooks. Every key includes the language, because the server localizes content.
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { api, isApiError } from './index';
import type { Cart } from './types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // The API client already retries safe requests on network failures; do not multiply retries here.
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});

export const qk = {
  me: (lang: string) => ['me', lang] as const,
  cart: (lang: string, who: string) => ['cart', lang, who] as const,
  dashboard: (lang: string, who: string) => ['dashboard', lang, who] as const,
  pioneerStatus: ['pioneerStatus'] as const,
};

/** Who is asking — part of keys for per-user data so switching accounts never shows stale data. */
export const useWho = () => useSession((s) => s.user?.id ?? (s.cartToken ? 'guest' : 'anon'));

export const EMPTY_CART: Cart = { items: [], subtotal: 0, discount: 0, pioneerDiscount: 0, shipping: 0, total: 0, currency: 'AMD', coupon: null, count: 0 };

export function useCart() {
  const { lang } = useI18n();
  const who = useWho();
  return useQuery({ queryKey: qk.cart(lang, who), queryFn: ({ signal }) => api.cart.get({ signal }), placeholderData: EMPTY_CART });
}

/** Mutations that return the fresh cart write it straight into the cache. */
export function useCartMutation<V>(fn: (v: V) => Promise<Cart>) {
  const qc = useQueryClient();
  const { lang } = useI18n();
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart) => {
      const who = useSession.getState().user?.id ?? (useSession.getState().cartToken ? 'guest' : 'anon');
      qc.setQueryData(qk.cart(lang, who), cart);
      void qc.invalidateQueries({ queryKey: ['cart'], refetchType: 'none' });
    },
  });
}

export function usePioneerStatus() {
  return useQuery({ queryKey: qk.pioneerStatus, queryFn: ({ signal }) => api.pioneer.status({ signal }), staleTime: 10 * 60_000 });
}

export function useDashboard() {
  const { lang } = useI18n();
  const who = useWho();
  const signedIn = useSession((s) => s.status === 'signedIn');
  return useQuery({ queryKey: qk.dashboard(lang, who), queryFn: ({ signal }) => api.me.dashboard({ signal }), enabled: signedIn });
}

/** Refresh everything that depends on who is signed in or on the cart. */
export async function refreshUserData() {
  try {
    const { user } = await api.auth.me();
    useSession.getState().setUser(user);
  } catch (e) {
    if (!isApiError(e) || !e.isNetwork) throw e;
  }
  await queryClient.invalidateQueries();
}
