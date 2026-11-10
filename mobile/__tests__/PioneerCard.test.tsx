// Connecting a Pioneer Card and displaying its balance.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLangStore } from '@/i18n';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true } }));
jest.mock('@/api', () => {
  const actual = jest.requireActual('@/api/client');
  return { ...actual, api: { pioneer: { link: jest.fn() } } };
});

// eslint-disable-next-line import/first
import { api, ApiError } from '@/api';
// eslint-disable-next-line import/first
import { ConnectForm } from '@/features/pioneer/ConnectForm';
// eslint-disable-next-line import/first
import { BalancePanel } from '@/features/pioneer/Dashboard';
// eslint-disable-next-line import/first
import type { PioneerSummary } from '@/api/types';

const link = (api as unknown as { pioneer: { link: jest.Mock } }).pioneer.link;
type Linked = Extract<PioneerSummary, { linked: true }>;

beforeEach(() => {
  link.mockReset();
  useLangStore.setState({ lang: 'en' });
});

describe('Connect Pioneer Card', () => {
  it('validates locally and does not call the server for incomplete input', async () => {
    await render(<ConnectForm onDone={jest.fn()} />);
    await fireEvent.changeText(screen.getByTestId('pc-number'), '1234 56');
    await fireEvent.changeText(screen.getByTestId('pc-code'), '12');
    await fireEvent.press(screen.getByTestId('pc-submit'));
    expect(link).not.toHaveBeenCalled();
    expect(screen.getByText('Enter all 8 digits of the card number.')).toBeTruthy();
    expect(screen.getByText('Enter the 3-digit verification code.')).toBeTruthy();
  });

  it('sends digits only (8 + 3) and reports success', async () => {
    link.mockResolvedValue({ linked: true, card: { masked: '•••• 5678', holderName: 'Ani', status: 'active' }, balance: 120, achievement: null });
    const onDone = jest.fn();
    await render(<ConnectForm onDone={onDone} />);
    await fireEvent.changeText(screen.getByTestId('pc-number'), '1234-5678');
    await fireEvent.changeText(screen.getByTestId('pc-code'), '9a87');
    await fireEvent.press(screen.getByTestId('pc-submit'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(link).toHaveBeenCalledWith('12345678', '987');
  });

  it('shows the server error with attempts left and clears the code', async () => {
    link.mockRejectedValue(new ApiError(400, 'invalid_card', 'The card number or security code is incorrect.', { attemptsLeft: 2 }));
    await render(<ConnectForm onDone={jest.fn()} />);
    await fireEvent.changeText(screen.getByTestId('pc-number'), '12345678');
    await fireEvent.changeText(screen.getByTestId('pc-code'), '111');
    await fireEvent.press(screen.getByTestId('pc-submit'));
    expect(await screen.findByText(/incorrect\. 2 attempts left/)).toBeTruthy();
    expect(screen.getByTestId('pc-code').props.value).toBe('');
  });
});

describe('Pioneer balance display', () => {
  const base = { available: true, discountPercent: 5, pointsEarnable: true, pointsRedeemable: true, linked: true as const, card: { masked: '•••• 5678', holderName: 'Ani', status: 'active' }, transactions: null, rewards: [], activity: [] };

  it('shows the live balance from Magical', async () => {
    const s: Linked = { ...base, live: true, balance: { points: 12500, live: true, asOf: '2026-12-01T10:00:00Z' } };
    await render(<BalancePanel s={s} refreshing={false} onRefresh={jest.fn()} />);
    expect(screen.getByTestId('pc-balance').props.children).toBe('12,500');
    expect(screen.queryByTestId('pc-stale')).toBeNull();
  });

  it('when Magical is unavailable: no current balance, last confirmed value labelled as such', async () => {
    const s: Linked = { ...base, live: false, balance: null, lastConfirmed: { points: 900, asOf: '2026-11-30T00:00:00Z' } };
    await render(<BalancePanel s={s} refreshing={false} onRefresh={jest.fn()} />);
    expect(screen.getByTestId('pc-balance').props.children).toBe('—');
    expect(screen.getByTestId('pc-stale')).toBeTruthy();
    expect(screen.getByText(/Last confirmed: 900 points/)).toBeTruthy();
  });

  it('refresh asks the server again', async () => {
    const onRefresh = jest.fn();
    const s: Linked = { ...base, live: true, balance: { points: 1, live: true, asOf: '2026-12-01T10:00:00Z' } };
    await render(<BalancePanel s={s} refreshing={false} onRefresh={onRefresh} />);
    await fireEvent.press(screen.getByTestId('pc-refresh'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
