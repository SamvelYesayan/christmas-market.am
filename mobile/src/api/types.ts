// Response shapes of the Christmas Market API, mirrored from server/src/routes/*.js.

export interface Art {
  type?: string;
  c1?: string;
  c2?: string;
  [k: string]: unknown;
}

export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  price: number;
  salePrice: number | null;
  isFeatured: boolean;
  isLimited: boolean;
  isMagic: boolean;
  isPersonalizable: boolean;
  tags: string[];
  art: Art | null;
  image: string | null;
  stock: number;
  rating: string | number | null;
  category: { slug: string; name: string } | null;
  match?: number;
  reasons?: string[];
  inBudget?: boolean;
  isTopPick?: boolean;
}

export interface Variant { id: string; sku: string; name: string; options: Record<string, unknown> | null; priceDelta: number; stock: number }
export interface Review { author: string; city: string | null; rating: number; body: string; createdAt: string }

export interface ProductDetail extends ProductCard {
  description: string | null;
  story: string | null;
  attributes: Record<string, unknown> | null;
  variants: Variant[];
  images: { id: string; url: string; alt: string | null }[];
  reviews: Review[];
  wished: boolean;
}

export interface Category { slug: string; name: string; tagline: string | null; description: string | null; art: Art | null; color: string | null; productCount: number }

export interface ProductList { products: ProductCard[]; total: number; page: number; pages: number }

export interface House { slug: string; name: string; motto: string; animal: string; element?: string; color: string; accent: string; virtues?: string[]; description?: string; members?: number }

export interface Identity {
  magicalName: string;
  wand: { wood: string; core: string; length: string };
  familiar: string;
  constellation: string;
  signatureSpell: string;
  sigil: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: 'customer' | 'admin' | string;
  createdAt: string;
  consents: { marketing: boolean; personalization: boolean };
  profile: {
    displayName: string;
    atmosphere: Atmosphere | null;
    preferences: Record<string, unknown>;
    identity: Identity | null;
    house: (Pick<House, 'slug' | 'color' | 'accent' | 'name' | 'animal' | 'motto'>) | null;
  };
  pioneer: { cardMasked: string; holderName: string | null } | null;
}

export type Atmosphere = 'cozy' | 'grand' | 'enchanted' | 'nordic';

export interface MobileSession { token: string; expiresAt: string }
export interface AuthResponse { user: User | null; session?: MobileSession }

export interface Grant {
  id: string;
  source: string;
  kind: 'points' | 'coupon' | 'message' | string;
  title: string;
  points: number | null;
  couponCode: string | null;
  payload: Record<string, unknown> | null;
  pioneerSyncStatus: string | null;
  createdAt: string;
}

export interface Achievement { key: string; title: string; description: string; icon: string; earnedAt?: string | null }

export interface Coupon { code: string; description: string | null; type: 'percent' | 'fixed' | 'free_shipping' | string; value: number; minSubtotal: number | null; endsAt: string | null; pioneerOnly: boolean }

export interface Dashboard {
  orders: { number: string; status: string; paymentStatus: string; total: number; isTest: boolean; createdAt: string; itemCount: number }[];
  wishlistCount: number;
  rewards: Grant[];
  coupons: Coupon[];
  achievements: Achievement[];
  advent: { opened: number; total: number };
  stardust: number;
}

export interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  variantName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  total: number;
  personalization: string | null;
  art: Art | null;
  image: string | null;
  stock?: number;
  compareAt?: number | null;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  discount: number;
  pioneerDiscount: number;
  shipping: number;
  total: number;
  currency: string;
  coupon: { code: string; type?: string; value?: number; description?: string | null } | null;
  couponError?: string | null;
  pendingCoupon?: string | null;
  count: number;
  hasPioneer?: boolean;
  pioneerPercent?: number;
  freeShippingOver?: number | null;
}

export interface Zone { code: string; name: string; description: string | null; price: number; freeOver: number | null; eta: string | null; requiresAddress: boolean }
export interface PaymentMethod { code: string; label: string; description: string; kind: string; isTest: boolean; available: boolean }
export interface CheckoutOptions { zones: Zone[]; paymentMethods: PaymentMethod[]; upcomingPaymentMethods: string[]; currency: string }

export type PaymentInstruction =
  | { type: 'offline' }
  | { type: 'redirect'; url: string; paymentId?: string; isTest?: boolean }
  | { type: 'form'; action: string; fields: Record<string, string>; paymentId?: string; isTest?: boolean };

export interface Order {
  number: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  isTest: boolean;
  currency: string;
  subtotal: number;
  discount: number;
  pioneerDiscount: number;
  shipping: number;
  total: number;
  couponCode: string | null;
  customer: { name: string; email: string; phone: string };
  delivery: { zone: string; zoneName?: string; eta?: string; city?: string; address?: string; date?: string; notes?: string };
  giftMessage: string | null;
  trackingCode: string | null;
  createdAt: string;
  items: { name: string; variantName: string; sku: string; unitPrice: number; quantity: number; total: number; personalization: string | null; slug: string | null; art: Art | null; image: string | null }[];
  history: { status: string; note: string; created_at: string }[];
  payments: { provider: string; amount: number; status: string; isTest: boolean; createdAt: string }[];
}

export interface PlaceOrderResponse { order: Order; payment: PaymentInstruction; paymentError: string | null; achievement: Achievement | null; accessKey: string }

export interface HomeContent {
  blocks: Record<string, Record<string, unknown>>;
  banners: { id: string; placement: string; title: string; subtitle: string | null; ctaLabel: string | null; ctaLink: string | null; imageUrl: string | null; art: Art | null }[];
  campaigns: { id: string; name: string; headline: string; body: string | null; couponCode: string | null; pioneerOnly: boolean; art: Art | null; color: string | null; endsAt: string | null }[];
  featured: ProductCard[];
  bestsellers: ProductCard[];
  limited: ProductCard[];
  onSale: ProductCard[];
  events: { id: string; title: string; description: string | null; location: string | null; startsAt: string; endsAt: string | null }[];
}

export interface HighlightReview { author: string; city: string | null; rating: number; body: string; product: { name: string; slug: string; art: Art | null } | null }

// ───── Games ─────
export interface GameInfo { key: string; title: string; description: string; playsPerDay: number | null; playsToday: number }
export interface Challenge { id: number; title: string; description: string; kind: string; target: Record<string, unknown>; rewardPoints: number; complete: boolean; claimed: boolean }
export interface SessionStart { sessionId: string; seed: number; rules: { durationSeconds: number | null } }
export interface FinishResult { acceptedScore: number; flagged: boolean; reward: Grant | null; achievement: Achievement | null; message: string | null }
export interface QuizStart { sessionId: string; questions: { id: number; question: string; options: string[] }[] }
export interface QuizAnswer { correct: boolean; correctIndex: number; funFact: string | null; done: boolean; score: number; total: number; reward: Grant | null; bonus: Grant | null; achievement: Achievement | null }
export interface WheelState { segments: { id: number; label: string; color: string }[]; spunToday: boolean; lastReward: Grant | null }
export interface MysteryState { openedToday: boolean; lastReward: Grant | null }
export interface HiddenObject { key: string; name: string; hint: string; location: string; points: number; found: boolean }
export interface HiddenFind { name: string; alreadyFound: boolean; reward?: Grant | null; found?: number; total?: number; achievement?: Achievement | null }

// ───── Calendar ─────
export type DayStatus = 'available' | 'completed' | 'missed' | 'locked' | 'closed';
export interface GiftContent { kind: string; title: string; description: string | null; story?: string; text?: string; game?: string; product?: ProductCard; image?: string; reward?: Grant | null }
export interface CalendarDay {
  day: number;
  status: DayStatus;
  isGrand: boolean;
  isToday: boolean;
  art: string;
  configured?: boolean;
  title?: string;
  teaser?: string | null;
  description?: string | null;
  image?: string | null;
  options?: { key: string; title: string; description: string | null; image: string | null }[];
  giftsLeft?: number;
  received?: { outcome: string; claimedAt: string; content: GiftContent | null };
}
export interface GrandEligibility { status: 'entered' | 'qualified' | 'on_track' | 'lost'; eligible: boolean; missed: number[]; completed: number; required: number }
export interface CalendarState {
  year: number;
  today: string;
  todayDay: number | null;
  phase: 'before' | 'during' | 'over';
  startsIn: number | null;
  timezone: string;
  signedIn: boolean;
  progress: { completed: number; total: number };
  grand: GrandEligibility | null;
  days: CalendarDay[];
}
export interface ClaimResult { day: number; outcome: string; window: CalendarDay; progress: { completed: number; total: number }; grand: GrandEligibility; achievements: Achievement[] }

// ───── Academy ─────
export interface SortingQuestion { id: number; question: string; answers: string[] }
export interface SortResult { house: House; identity: Identity; saved: boolean; alreadySorted?: boolean; reward?: Grant | null; achievement?: Achievement | null; totals?: number[] }
export interface AcademyMe { sorted: boolean; house?: House; identity?: Identity; sortedAt?: string }

// ───── Wishes ─────
export type WishCategory = 'family' | 'friends' | 'love' | 'health' | 'success' | 'peace' | 'everyone';
export interface Wish { id: string; author: string; recipient: string | null; message: string; category: WishCategory | null; approvedAt: string }

// ───── Pioneer ─────
export interface PioneerStatus { available: boolean; discountPercent: number; pointsEarnable: boolean; pointsRedeemable: boolean }
export interface PioneerOffer { id: string; title: string; description: string | null; kind: 'redeem_gift' | 'discount' | 'exclusive' | string; pointsCost: number | null; discountPercent: number | null; product: ProductCard | null; stock: number | null; redeemable: boolean }
export interface PioneerTx { id: string | number; type: string; label?: string; description?: string | null; amount: number; createdAt: string }
export interface PioneerTxPage { items: PioneerTx[]; total?: number; page: number; pageSize?: number }
export interface PioneerReward {
  id: number | string;
  title: string;
  description?: string | null;
  pointsCost: number;
  eligible?: boolean;
  reasons?: string[];
  shortfall?: number;
  upcoming?: boolean;
  soldOut?: boolean;
  limitReached?: boolean;
}
export interface PioneerActivity { id: string; kind: 'credit' | 'debit'; source: string; points: number; title: string | null; status: 'done' | 'failed' | 'waiting'; errorCode: string | null; fulfilment: string | null; couponCode: string | null; createdAt: string; completedAt: string | null }
export interface PioneerCardInfo { masked: string; last4?: string; holderName: string | null; status: string | null; memberSince?: string | null; linkedAt?: string | null }
export type PioneerSummary = PioneerStatus & (
  | { linked: false; unlinkedRemotely?: boolean }
  | {
      linked: true;
      live: boolean;
      error?: string;
      card: PioneerCardInfo;
      balance: { points: number; live: boolean; asOf: string } | null;
      lastConfirmed?: { points: number; asOf: string } | null;
      transactions: PioneerTxPage | null;
      rewards: PioneerReward[];
      activity: PioneerActivity[];
      partialError?: string | null;
    }
);
export interface PioneerEligibility { eligible: boolean; reasons?: string[]; shortfall?: number; [k: string]: unknown }
export interface Redemption { id: string; status: 'processing' | 'completed' | 'failed' | string; points: number; title: string; fulfilment: string | null; couponCode: string | null; createdAt: string; completedAt: string | null; errorCode: string | null; balanceAfter: number | null }
export interface RedeemResponse { redemption: Redemption; repeated: boolean }
export interface LinkResponse { linked: true; card: PioneerCardInfo; balance: number | null; achievement: Achievement | null }
