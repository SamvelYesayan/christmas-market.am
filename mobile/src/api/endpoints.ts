// Typed endpoint functions — one per server route the app uses. See docs/API_MAPPING.md.
import type { ApiClient } from './client';
import type * as T from './types';

type Sig = { signal?: AbortSignal };

export function endpoints(api: ApiClient) {
  return {
    auth: {
      me: (o?: Sig) => api.get<T.AuthResponse>('/auth/me', o),
      login: (email: string, password: string) => api.post<T.AuthResponse>('/auth/login', { email, password }),
      register: (b: { name: string; email: string; password: string; marketingConsent: boolean; personalizationConsent: boolean; profile?: Record<string, unknown> }) =>
        api.post<T.AuthResponse>('/auth/register', b),
      logout: () => api.post<{ ok: true }>('/auth/logout'),
      changePassword: (currentPassword: string, newPassword: string) =>
        api.post<{ ok: true; session?: T.MobileSession }>('/auth/password', { currentPassword, newPassword }),
    },
    me: {
      updateProfile: (b: Record<string, unknown>) => api.put<T.AuthResponse>('/me/profile', b),
      dashboard: (o?: Sig) => api.get<T.Dashboard>('/me/dashboard', o),
      recommendations: (o?: Sig) => api.get<{ products: T.ProductCard[] }>('/me/recommendations', o),
    },
    catalog: {
      categories: (o?: Sig) => api.get<{ categories: T.Category[] }>('/categories', o),
      products: (query: Record<string, string | number | undefined>, o?: Sig) => api.get<T.ProductList>('/products', { ...o, query }),
      product: (slug: string, o?: Sig) => api.get<{ product: T.ProductDetail; related: T.ProductCard[] }>(`/products/${encodeURIComponent(slug)}`, o),
      review: (slug: string, rating: number, body: string) => api.post<{ ok: true; message: string }>(`/products/${encodeURIComponent(slug)}/reviews`, { rating, body }),
      giftFinder: (b: Record<string, unknown>) => api.post<{ products: T.ProductCard[] }>('/gift-finder', b),
      reviewHighlights: (o?: Sig) => api.get<{ reviews: T.HighlightReview[] }>('/reviews/highlights', o),
    },
    content: {
      home: (o?: Sig) => api.get<T.HomeContent>('/content/home', o),
      newsletter: (email: string, name?: string) => api.post<{ ok: true }>('/newsletter', { email, name, consent: true }),
      analyticsVisit: () => api.post<null>('/analytics', { type: 'visit', ref: 'mobile-app' }),
    },
    wishlist: {
      list: (o?: Sig) => api.get<{ products: T.ProductCard[] }>('/wishlist', o),
      add: (productId: string) => api.post<{ ok: true; achievement: T.Achievement | null }>(`/wishlist/${productId}`),
      remove: (productId: string) => api.del<{ ok: true }>(`/wishlist/${productId}`),
    },
    cart: {
      get: (o?: Sig) => api.get<T.Cart>('/cart', o),
      add: (variantId: string, quantity: number, personalization?: string) => api.post<T.Cart>('/cart/items', { variantId, quantity, personalization: personalization || undefined }),
      setQuantity: (id: string, quantity: number) => api.patch<T.Cart>(`/cart/items/${id}`, { quantity }),
      remove: (id: string) => api.del<T.Cart>(`/cart/items/${id}`),
      applyCoupon: (code: string) => api.post<T.Cart>('/cart/coupon', { code }),
      removeCoupon: () => api.del<T.Cart>('/cart/coupon'),
    },
    checkout: {
      options: (o?: Sig) => api.get<T.CheckoutOptions>('/checkout/options', o),
      quote: (zone: string, o?: Sig) => api.get<T.Cart>('/checkout/quote', { ...o, query: { zone } }),
      placeOrder: (b: Record<string, unknown>) => api.post<T.PlaceOrderResponse>('/orders', b),
    },
    orders: {
      mine: (o?: Sig) => api.get<{ orders: T.Order[] }>('/orders', o),
      get: (number: string, access: { key?: string | null; email?: string | null } = {}, o?: Sig) =>
        api.get<{ order: T.Order }>(`/orders/${encodeURIComponent(number)}`, { ...o, query: { key: access.key ?? undefined, email: access.email ?? undefined } }),
      pay: (number: string, access: { key?: string | null; email?: string | null }) => api.post<{ payment: T.PaymentInstruction }>(`/orders/${encodeURIComponent(number)}/pay`, access),
      testPayment: (id: string, o?: Sig) => api.get<{ payment: { id: string; status: string; amount: number; isTest: true }; order: { number: string; total: number } }>(`/payments/test/${id}`, o),
      decideTestPayment: (id: string, decision: 'approve' | 'decline') => api.post<{ orderNumber: string; status: string; paymentStatus: string }>(`/payments/test/${id}/decide`, { decision }),
    },
    games: {
      list: (o?: Sig) => api.get<{ games: T.GameInfo[] }>('/games', o),
      start: (game: 'catch' | 'tree') => api.post<T.SessionStart>(`/games/${game}/start`),
      finish: (game: 'catch' | 'tree', b: { sessionId: string; score: number; state: Record<string, unknown> }) => api.post<T.FinishResult>(`/games/${game}/finish`, b),
      quizStart: () => api.post<T.QuizStart>('/games/quiz/start'),
      quizAnswer: (sessionId: string, questionId: number, answer: number) => api.post<T.QuizAnswer>('/games/quiz/answer', { sessionId, questionId, answer }),
      wheel: (o?: Sig) => api.get<T.WheelState>('/games/wheel', o),
      spin: () => api.post<{ segmentIndex: number; reward: T.Grant | null }>('/games/wheel/spin'),
      mystery: (o?: Sig) => api.get<T.MysteryState>('/games/mystery', o),
      openMystery: () => api.post<{ rarity: string; reward: T.Grant | null }>('/games/mystery/open'),
      hidden: (o?: Sig) => api.get<{ objects: T.HiddenObject[] }>('/hidden', o),
      findHidden: (key: string) => api.post<T.HiddenFind>(`/hidden/${encodeURIComponent(key)}/find`),
      challenges: (o?: Sig) => api.get<{ date: string; challenges: T.Challenge[] }>('/challenges/today', o),
      claimChallenge: (id: number) => api.post<{ ok: true; reward: T.Grant | null }>(`/challenges/${id}/claim`),
    },
    calendar: {
      get: (o?: Sig) => api.get<T.CalendarState>('/advent', o),
      claim: (day: number, optionKey?: string) => api.post<T.ClaimResult>('/advent/claim', optionKey ? { day, optionKey } : { day }),
    },
    academy: {
      houses: (o?: Sig) => api.get<{ houses: T.House[] }>('/academy/houses', o),
      sorting: (o?: Sig) => api.get<{ questions: T.SortingQuestion[] }>('/academy/sorting', o),
      sort: (answers: number[], name?: string) => api.post<T.SortResult>('/academy/sort', { answers, name }),
      me: (o?: Sig) => api.get<T.AcademyMe>('/academy/me', o),
      shop: (o?: Sig) => api.get<{ products: T.ProductCard[] }>('/academy/shop', o),
    },
    wishes: {
      batch: (exclude: string[], limit = 24, o?: Sig) => api.get<{ items: T.Wish[]; total: number }>('/wishes', { ...o, query: { limit, exclude: exclude.length ? exclude.join(',') : undefined } }),
      recent: (page: number, o?: Sig) => api.get<{ items: T.Wish[]; total: number; page: number; pageSize: number }>('/wishes/recent', { ...o, query: { page } }),
      submit: (b: { authorName: string; recipientName?: string; message: string; category?: T.WishCategory; elapsedMs: number }) => api.post<{ ok: true; status: 'pending' }>('/wishes', b),
    },
    pioneer: {
      status: (o?: Sig) => api.get<T.PioneerStatus>('/pioneer/status', o),
      offers: (o?: Sig) => api.get<{ offers: T.PioneerOffer[] }>('/pioneer/offers', o),
      catalog: (o?: Sig) => api.get<{ items: T.PioneerReward[] }>('/pioneer/rewards', o),
      summary: (fresh: boolean, o?: Sig) => api.get<T.PioneerSummary>('/pioneer/summary', { ...o, query: { fresh: fresh ? '1' : undefined } }),
      transactions: (page: number, o?: Sig) => api.get<T.PioneerTxPage>('/pioneer/transactions', { ...o, query: { page } }),
      eligibility: (rewardId: string | number, o?: Sig) => api.get<T.PioneerEligibility>(`/pioneer/rewards/${rewardId}/eligibility`, o),
      link: (cardNumber: string, verificationCode: string) => api.post<T.LinkResponse>('/pioneer/link', { cardNumber, verificationCode }),
      unlink: () => api.del<{ ok: true }>('/pioneer/link', { confirm: true }),
      redeem: (offerId: string, requestId: string) => api.post<T.RedeemResponse>(`/pioneer/offers/${offerId}/redeem`, { requestId }),
    },
  };
}

export type Endpoints = ReturnType<typeof endpoints>;
