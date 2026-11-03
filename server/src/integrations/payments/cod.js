export const cashOnDelivery = {
  code: 'cash_on_delivery',
  label: 'Cash or card on delivery',
  description: 'Pay the courier in cash or by card when your sleigh arrives.',
  kind: 'offline',
  available: () => true,
  async createPayment() {
    return { type: 'offline' };
  },
};
