import { money } from '@/lib/format';
import type { Coupon } from '@/api/types';

/** "10% off over 20,000 ֏ · until 31 Dec" — same wording as the website's ticket. */
export function couponLabel(c: Coupon, t: (k: string, v?: Record<string, string | number>) => string): string {
  const what = c.type === 'percent' ? t('account.pctOff', { v: c.value }) : c.type === 'fixed' ? t('account.fixedOff', { v: money(c.value) }) : t('account.freeDelivery');
  return `${what}${c.minSubtotal ? t('account.over', { amount: money(c.minSubtotal) }) : ''}`;
}
