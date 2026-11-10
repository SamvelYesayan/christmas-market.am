// Pure Pioneer Card helpers (unit-tested). The server and Magical decide everything; these only describe it.
import type { PioneerActivity, PioneerReward, PioneerSummary } from '@/api/types';
import { points } from '@/lib/format';

type T = (k: string, v?: Record<string, string | number>) => string;

/** Magical's eligibility reasons → customer text, same rules as the website. */
export function rewardState(r: PioneerReward, t: T): { ok: boolean; text: string; short?: boolean } {
  if (r.eligible) return { ok: true, text: t('pc.rewardReady') };
  const reasons = r.reasons ?? [];
  if (reasons.includes('card_inactive')) return { ok: false, text: t('pc.cardInactive') };
  if (reasons.includes('not_yet_available') || r.upcoming) return { ok: false, text: t('pc.upcoming') };
  if (reasons.includes('sold_out') || r.soldOut) return { ok: false, text: t('pc.soldOut') };
  if (reasons.includes('per_card_limit_reached') || r.limitReached) return { ok: false, text: t('pc.limitReached') };
  if (reasons.includes('insufficient_points')) return { ok: false, text: t('pc.rewardNeed', { n: points(r.shortfall ?? 0) }), short: true };
  return { ok: false, text: '' };
}

export type BalanceView =
  | { kind: 'live'; points: number; asOf: string }
  | { kind: 'stale'; lastConfirmed: { points: number; asOf: string } | null; error?: string }
  | { kind: 'none' };

/**
 * What to show as the balance. A balance is only ever shown as CURRENT when Magical answered live; when Magical is
 * unavailable the last confirmed value is labelled as such (never as current), exactly like the website.
 */
export function balanceView(s: PioneerSummary | undefined): BalanceView {
  if (!s || !s.linked) return { kind: 'none' };
  if (s.live && s.balance && Number.isInteger(s.balance.points)) return { kind: 'live', points: s.balance.points, asOf: s.balance.asOf };
  return { kind: 'stale', lastConfirmed: s.lastConfirmed ?? null, error: s.error };
}

export function activityState(x: PioneerActivity, t: T, has: (k: string) => boolean): { tone: 'success' | 'muted' | 'danger'; text: string } {
  if (x.status === 'done') return { tone: 'success', text: t(x.kind === 'credit' ? 'pc.st_done_credit' : 'pc.st_done_debit') };
  if (x.status === 'waiting') return { tone: 'muted', text: t('pc.st_waiting') };
  const why = x.errorCode && has(`pc.err_${x.errorCode}`) ? ` · ${t(`pc.err_${x.errorCode}`)}` : '';
  return { tone: 'danger', text: t(x.kind === 'credit' ? 'pc.st_failed_credit' : 'pc.st_failed_debit') + why };
}

export const txLabel = (type: string, label: string | undefined, t: T, has: (k: string) => boolean) => (has(`pc.tx_${type}`) ? t(`pc.tx_${type}`) : label ?? type);

/** Card number field: digits only, 8 of them; code: exactly 3 digits. */
export const cardDigits = (v: string) => v.replace(/\D/g, '').slice(0, 8);
export const isValidCard = (v: string) => cardDigits(v).length === 8;
export const isValidCode = (v: string) => /^\d{3}$/.test(v);
