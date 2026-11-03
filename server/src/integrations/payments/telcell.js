// Telcell Wallet — configuration contract only. Telcell issues merchant documentation on contract;
// implement createPayment/handleCallback here once it is available. Until then it is never offered at checkout.
import { config } from '../../config.js';
import { PaymentError } from './providers.js';

export const telcell = {
  code: 'telcell',
  label: 'Telcell Wallet',
  description: 'Pay from your Telcell wallet or at any Telcell terminal.',
  kind: 'redirect',
  implemented: false,
  configured: () => !!(config.TELCELL_SHOP_ID && config.TELCELL_SHOP_KEY),
  available: () => false, // flip to `telcell.configured()` once createPayment is implemented
  async createPayment() {
    throw new PaymentError('Telcell integration is not implemented yet.', 'not_implemented');
  },
};
