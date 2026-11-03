// ArCa iPay (register.do → formUrl → getOrderStatusExtended.do). Amount is in minor units (×100), currency 051.
import { config } from '../../config.js';
import { PaymentError, returnUrl } from './providers.js';

async function call(method, params) {
  const body = new URLSearchParams({ userName: config.ARCA_MERCHANT_USER, password: config.ARCA_MERCHANT_PASSWORD, ...params });
  const res = await fetch(`${config.ARCA_API_URL.replace(/\/$/, '')}/${method}`, { method: 'POST', body, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new PaymentError(`ArCa responded ${res.status}`);
  return res.json();
}

export const arca = {
  code: 'arca',
  label: 'ArCa card',
  description: 'Pay with any Armenian ArCa card.',
  kind: 'redirect',
  available: () => !!(config.ARCA_MERCHANT_USER && config.ARCA_MERCHANT_PASSWORD && config.ARCA_API_URL),
  async createPayment({ order, payment }) {
    const d = await call('register.do', {
      orderNumber: payment.id.replace(/-/g, '').slice(0, 32),
      amount: String(order.total * 100),
      currency: '051',
      returnUrl: returnUrl('arca', payment.id),
      description: `Christmas Market order ${order.number}`,
      language: 'en',
    });
    if (!d.formUrl) throw new PaymentError(d.errorMessage || 'ArCa could not start the payment.');
    return { type: 'redirect', url: d.formUrl, providerRef: d.orderId };
  },
  async verify(payment) {
    const d = await call('getOrderStatusExtended.do', { orderId: payment.provider_ref });
    const paid = Number(d.orderStatus) === 2 && Number(d.amount) === payment.amount * 100;
    return { status: paid ? 'succeeded' : 'failed', raw: { orderStatus: d.orderStatus, actionCode: d.actionCode } };
  },
};
