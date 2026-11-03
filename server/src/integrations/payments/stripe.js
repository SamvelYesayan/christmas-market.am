// Stripe Checkout for international cards (REST API, no SDK). Confirmation comes from the signed webhook
// `checkout.session.completed`; the return URL only shows status.
import crypto from 'node:crypto';
import { config } from '../../config.js';
import { PaymentError, returnUrl } from './providers.js';

export const stripe = {
  code: 'stripe',
  label: 'International card (Stripe)',
  description: 'Visa, Mastercard, Amex, Apple Pay and Google Pay for cards issued abroad.',
  kind: 'redirect',
  available: () => !!(config.STRIPE_SECRET_KEY && config.STRIPE_WEBHOOK_SECRET),
  async createPayment({ order, payment }) {
    const body = new URLSearchParams({
      mode: 'payment',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'amd',
      'line_items[0][price_data][unit_amount]': String(order.total * 100),
      'line_items[0][price_data][product_data][name]': `Christmas Market order ${order.number}`,
      client_reference_id: payment.id,
      'metadata[payment_id]': payment.id,
      success_url: returnUrl('stripe', payment.id),
      cancel_url: returnUrl('stripe', payment.id),
    });
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.STRIPE_SECRET_KEY}`, 'Idempotency-Key': payment.id },
      body,
      signal: AbortSignal.timeout(15000),
    });
    const d = await res.json();
    if (!res.ok) throw new PaymentError(d.error?.message || 'Stripe could not start the payment.');
    return { type: 'redirect', url: d.url, providerRef: d.id };
  },
  async handleCallback(req) {
    const sig = req.get('stripe-signature') ?? '';
    const parts = Object.fromEntries(sig.split(',').map((kv) => kv.split('=')));
    const payload = req.rawBody?.toString('utf8') ?? '';
    const expected = crypto.createHmac('sha256', config.STRIPE_WEBHOOK_SECRET).update(`${parts.t}.${payload}`).digest('hex');
    const valid = parts.v1 && expected.length === parts.v1.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
    if (!valid || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return { respond: 'invalid signature', httpStatus: 400 };
    const event = JSON.parse(payload);
    if (event.type !== 'checkout.session.completed') return { respond: 'ignored' };
    const s = event.data.object;
    return {
      paymentId: s.metadata?.payment_id,
      status: s.payment_status === 'paid' ? 'succeeded' : 'pending',
      providerRef: s.id,
      amount: Math.round(s.amount_total / 100),
      raw: { id: s.id, payment_status: s.payment_status },
      respond: 'ok',
    };
  },
};
