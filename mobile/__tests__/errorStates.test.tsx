// Error handling UI: friendly, localized copy for offline / timeout / server errors, and a working retry.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ApiError } from '@/api/client';
import { useLangStore } from '@/i18n';
import { ErrorState, errorMessage } from '@/components/ui/States';
import { translate } from '@/i18n';

const t = (k: string) => translate('en', k);

describe('error states', () => {
  beforeEach(() => useLangStore.setState({ lang: 'en' }));

  it('maps errors to user-facing messages', () => {
    expect(errorMessage(new ApiError(0, 'network', 'raw'), t)).toBe(t('m.offline'));
    expect(errorMessage(new ApiError(0, 'timeout', 'raw'), t)).toBe(t('m.timeout'));
    expect(errorMessage(new ApiError(500, 'error', 'stack trace…'), t)).toBe(t('m.serverDown'));
    expect(errorMessage(new ApiError(409, 'insufficient_stock', 'Only 2 left in stock.'), t)).toBe('Only 2 left in stock.');
    expect(errorMessage('weird', t)).toBe(t('common.error'));
  });

  it('shows the offline message and retries on demand', async () => {
    const onRetry = jest.fn();
    await render(<ErrorState error={new ApiError(0, 'network', 'x')} onRetry={onRetry} />);
    expect(screen.getByText(t('m.offline'))).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(t('m.retry')));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows Armenian copy when the app is in Armenian', async () => {
    useLangStore.setState({ lang: 'hy' });
    await render(<ErrorState error={new ApiError(0, 'network', 'x')} />);
    expect(screen.getByText(translate('hy', 'm.offline'))).toBeTruthy();
  });
});
