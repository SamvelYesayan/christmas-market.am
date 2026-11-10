// Pioneer balance display, eligibility wording and card validation (pure logic, no network).
import { activityState, balanceView, cardDigits, isValidCard, isValidCode, rewardState, txLabel } from '@/features/pioneer/logic';
import { translate, hasKey } from '@/i18n';
import type { PioneerSummary } from '@/api/types';

const t = (k: string, v?: Record<string, string | number>) => translate('en', k, v);
const has = (k: string) => hasKey('en', k);
const base = { available: true, discountPercent: 5, pointsEarnable: true, pointsRedeemable: true };
const card = { masked: '•••• 5678', holderName: 'Ani', status: 'active' };

describe('Pioneer balance view', () => {
  it('shows a live balance only when Magical answered live', () => {
    const s = { ...base, linked: true, live: true, card, balance: { points: 1250, live: true, asOf: '2026-12-01T10:00:00Z' }, transactions: null, rewards: [], activity: [] } as PioneerSummary;
    expect(balanceView(s)).toEqual({ kind: 'live', points: 1250, asOf: '2026-12-01T10:00:00Z' });
  });

  it('never presents the last confirmed balance as current when Magical is unavailable', () => {
    const s = { ...base, linked: true, live: false, error: 'temporarily unavailable', card, balance: null, lastConfirmed: { points: 900, asOf: '2026-11-30T00:00:00Z' }, transactions: null, rewards: [], activity: [] } as PioneerSummary;
    const v = balanceView(s);
    expect(v.kind).toBe('stale');
    expect(v).toMatchObject({ lastConfirmed: { points: 900 } });
    expect(v).not.toHaveProperty('points');
  });

  it('has no balance when no card is linked', () => {
    expect(balanceView({ ...base, linked: false } as PioneerSummary)).toEqual({ kind: 'none' });
    expect(balanceView(undefined)).toEqual({ kind: 'none' });
  });
});

describe('reward eligibility wording', () => {
  const r = { id: 1, title: 'Hot cocoa', pointsCost: 500 };
  it('eligible', () => expect(rewardState({ ...r, eligible: true }, t)).toMatchObject({ ok: true }));
  it('insufficient points shows the shortfall', () => {
    const st = rewardState({ ...r, eligible: false, reasons: ['insufficient_points'], shortfall: 1200 }, t);
    expect(st.ok).toBe(false);
    expect(st.short).toBe(true);
    expect(st.text).toContain('1,200');
  });
  it('maps Magical reasons in the same priority as the website', () => {
    expect(rewardState({ ...r, reasons: ['card_inactive', 'sold_out'] }, t).text).toBe(t('pc.cardInactive'));
    expect(rewardState({ ...r, reasons: ['sold_out'] }, t).text).toBe(t('pc.soldOut'));
    expect(rewardState({ ...r, reasons: ['per_card_limit_reached'] }, t).text).toBe(t('pc.limitReached'));
    expect(rewardState({ ...r, upcoming: true }, t).text).toBe(t('pc.upcoming'));
  });
});

describe('store activity and history labels', () => {
  const x = { id: '1', kind: 'debit' as const, source: 'gift_redemption', points: 300, title: 'Gift', fulfilment: null, couponCode: null, createdAt: '', completedAt: null };
  it('waiting / done / failed with reason', () => {
    expect(activityState({ ...x, status: 'waiting', errorCode: null }, t, has).tone).toBe('muted');
    expect(activityState({ ...x, status: 'done', errorCode: null }, t, has).text).toBe(t('pc.st_done_debit'));
    const f = activityState({ ...x, status: 'failed', errorCode: 'insufficient_points' }, t, has);
    expect(f.tone).toBe('danger');
    expect(f.text).toContain(t('pc.err_insufficient_points'));
  });
  it('known transaction types are translated, unknown ones keep Magical label', () => {
    expect(txLabel('initial_bonus', 'x', t, has)).toBe(t('pc.tx_initial_bonus'));
    expect(txLabel('mystery_type', 'Magical label', t, has)).toBe('Magical label');
  });
});

describe('card connection input', () => {
  it('accepts exactly 8 digits for the card and 3 for the code', () => {
    expect(cardDigits('1234 5678 99')).toBe('12345678');
    expect(isValidCard('1234 5678')).toBe(true);
    expect(isValidCard('1234 567')).toBe(false);
    expect(isValidCode('123')).toBe(true);
    expect(isValidCode('12a')).toBe(false);
    expect(isValidCode('1234')).toBe(false);
  });
});
