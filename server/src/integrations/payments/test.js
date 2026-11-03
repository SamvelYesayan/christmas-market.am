// TEST payments: available only when PAYMENTS_TEST_MODE=true and never in production.
// No money moves. The shopper is sent to a page that clearly says TEST, where they approve or decline.
import { config, isProd } from '../../config.js';
import { appUrl } from './providers.js';

export const testProvider = {
  code: 'test',
  label: 'TEST payment (no real money)',
  description: 'Development only — simulates a provider page where you choose approve or decline.',
  kind: 'redirect',
  isTest: true,
  available: () => config.PAYMENTS_TEST_MODE && !isProd,
  async createPayment({ payment }) {
    return { type: 'redirect', url: appUrl(`/pay/test/${payment.id}`) };
  },
};
