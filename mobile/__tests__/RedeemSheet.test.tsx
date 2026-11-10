// Gift redemption with Pioneer points: one requestId per confirmation, duplicate taps never send twice,
// retries reuse the same requestId, and nothing is decided on the phone.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLangStore } from '@/i18n';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true } }));
jest.mock('@/api', () => {
  const actual = jest.requireActual('@/api/client');
  return { ...actual, api: { pioneer: { redeem: jest.fn() } } };
});

// eslint-disable-next-line import/first
import { api, ApiError } from '@/api';
// eslint-disable-next-line import/first
import { RedeemSheet } from '@/features/pioneer/RedeemSheet';

const redeem = (api as unknown as { pioneer: { redeem: jest.Mock } }).pioneer.redeem;
const offer = { id: '7b0c5ba6-0000-4000-8000-000000000001', title: 'Glass pomegranate', description: null, kind: 'redeem_gift', pointsCost: 1500, discountPercent: null, product: null, stock: 3, redeemable: true };
const completed = { id: 'r1', status: 'completed', points: 1500, title: 'Glass pomegranate', fulfilment: 'awaiting_handover', couponCode: null, createdAt: '', completedAt: '', errorCode: null, balanceAfter: 250 };

beforeEach(() => {
  redeem.mockReset();
  useLangStore.setState({ lang: 'en' });
});

describe('RedeemSheet', () => {
  it('sends one redemption even when the button is tapped twice quickly', async () => {
    let resolve!: (v: unknown) => void;
    redeem.mockImplementation(() => new Promise((r) => { resolve = r; }));
    await render(<RedeemSheet offer={offer} onClose={jest.fn()} />);
    const btn = screen.getByTestId('redeem-confirm');
    // Taps while the first request is still in flight (synchronous ref guard + disabled button).
    await fireEvent.press(btn);
    await fireEvent.press(btn);
    await fireEvent.press(btn);
    expect(redeem).toHaveBeenCalledTimes(1);
    expect(redeem.mock.calls[0][0]).toBe(offer.id);
    await act(async () => { resolve({ redemption: completed, repeated: false }); });
    expect(await screen.findByText('Points left: 250')).toBeTruthy();
  });

  it('retries after a failure with the SAME requestId (server returns the same redemption, no double debit)', async () => {
    redeem.mockRejectedValueOnce(new ApiError(0, 'timeout', 'The request took too long.'));
    redeem.mockResolvedValueOnce({ redemption: completed, repeated: true });
    await render(<RedeemSheet offer={offer} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('redeem-confirm'));
    expect(await screen.findByText('The request took too long. Please try again.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('redeem-confirm'));
    await waitFor(() => expect(redeem).toHaveBeenCalledTimes(2));
    expect(redeem.mock.calls[1][1]).toBe(redeem.mock.calls[0][1]);
    expect(redeem.mock.calls[0][1]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('a new confirmation (new sheet) gets a new requestId', async () => {
    redeem.mockResolvedValue({ redemption: completed, repeated: false });
    const first = await render(<RedeemSheet offer={offer} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('redeem-confirm'));
    await waitFor(() => expect(redeem).toHaveBeenCalledTimes(1));
    await first.unmount();
    await render(<RedeemSheet offer={offer} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('redeem-confirm'));
    await waitFor(() => expect(redeem).toHaveBeenCalledTimes(2));
    expect(redeem.mock.calls[1][1]).not.toBe(redeem.mock.calls[0][1]);
  });

  it('shows "waiting for confirmation" when Magical has not confirmed yet (202)', async () => {
    redeem.mockResolvedValue({ redemption: { ...completed, status: 'processing', balanceAfter: null }, repeated: false });
    await render(<RedeemSheet offer={offer} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('redeem-confirm'));
    expect(await screen.findByText('Waiting for confirmation')).toBeTruthy();
    expect(screen.queryByText(/Points left/)).toBeNull();
  });

  it('shows the server refusal (e.g. insufficient points) and deducts nothing on the phone', async () => {
    redeem.mockRejectedValue(new ApiError(409, 'insufficient_points', 'Your Pioneer Card does not have enough points for this gift. Nothing was deducted.'));
    await render(<RedeemSheet offer={offer} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('redeem-confirm'));
    expect(await screen.findByText(/Nothing was deducted/)).toBeTruthy();
  });
});
