// Ameriabank vPOS 3.x: InitPayment → redirect to Pay page → on return, GetPaymentDetails confirms the result.
// Amounts are in AMD (currency code 051). Confirm field names against the bank's current vPOS documentation.
import { config } from '../../config.js';
import { PaymentError, postJson, returnUrl } from './providers.js';

const creds = () => ({ ClientID: config.AMERIA_CLIENT_ID, Username: config.AMERIA_USERNAME, Password: config.AMERIA_PASSWORD });

export const ameriabank = {
  code: 'ameriabank',
  label: 'Card (Ameriabank)',
  description: 'Visa, Mastercard and ArCa cards via Ameriabank secure page.',
  kind: 'redirect',
  available: () => !!(config.AMERIA_CLIENT_ID && config.AMERIA_USERNAME && config.AMERIA_PASSWORD && config.AMERIA_API_URL),
  async createPayment({ order, payment }) {
    const base = config.AMERIA_API_URL.replace(/\/$/, '');
    const d = await postJson(`${base}/api/VPOS/InitPayment`, {
      ...creds(),
      Amount: order.total,
      Currency: '051',
      OrderID: Number(order.number.replace(/\D/g, '')),
      Description: `Christmas Market order ${order.number}`,
      BackURL: returnUrl('ameriabank', payment.id),
      Opaque: payment.id,
    });
    if (d.ResponseCode !== 1 || !d.PaymentID) throw new PaymentError(d.ResponseMessage || 'Ameriabank could not start the payment.');
    return { type: 'redirect', url: `${base}/Payments/Pay?id=${d.PaymentID}&lang=en`, providerRef: d.PaymentID };
  },
  async verify(payment) {
    const base = config.AMERIA_API_URL.replace(/\/$/, '');
    const d = await postJson(`${base}/api/VPOS/GetPaymentDetails`, { PaymentID: payment.provider_ref, Username: config.AMERIA_USERNAME, Password: config.AMERIA_PASSWORD });
    const paid = d.ResponseCode === '00' && Number(d.Amount) === payment.amount;
    return { status: paid ? 'succeeded' : 'failed', raw: { ResponseCode: d.ResponseCode, PaymentState: d.PaymentState } };
  },
};
