import { Router } from 'express';
import { z } from 'zod';
import { one } from '../db.js';
import { ah, badRequest, forbidden, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { validate } from '../middleware/validate.js';
import { providers } from '../integrations/payments/index.js';
import { appUrl } from '../integrations/payments/providers.js';
import { applyPaymentResult } from '../services/orders.js';
import { config, isProd } from '../config.js';

const r = Router();
const findPayment = (id) => (z.string().uuid().safeParse(id).success ? one('SELECT * FROM payments WHERE id=$1', [id]) : null);

// Server-to-server notifications (Idram result URL, Stripe webhook). Verified by each provider's signature.
r.post('/:provider/callback', ah(async (req, res) => {
  const provider = providers[req.params.provider];
  if (!provider?.handleCallback || !provider.available()) throw notFound();
  const result = await provider.handleCallback(req, { findPayment });
  if (result.paymentId && result.status) {
    await applyPaymentResult(result.paymentId, result);
    logger.info({ provider: provider.code, payment: result.paymentId, status: result.status }, 'payment callback');
  }
  res.status(result.httpStatus ?? 200).type('text/plain').send(result.respond ?? 'OK');
}));

// Shopper returns from a provider page: verify server-side, then send them to the order page.
r.get('/:provider/return', ah(async (req, res) => {
  const provider = providers[req.params.provider];
  const payment = await findPayment(req.query.payment);
  if (!provider || !payment) throw notFound();
  if (provider.verify && payment.status !== 'succeeded') {
    try {
      const v = await provider.verify(payment);
      await applyPaymentResult(payment.id, v);
    } catch (err) {
      logger.error({ err: err.message, payment: payment.id }, 'payment verify failed');
    }
  }
  const order = await one('SELECT number FROM orders WHERE id=$1', [payment.order_id]);
  res.redirect(appUrl(`/order/${order.number}?returned=1`));
}));

// ───────── TEST payment page (development only) ─────────
const testEnabled = () => config.PAYMENTS_TEST_MODE && !isProd;

r.get('/test/:id', ah(async (req, res) => {
  if (!testEnabled()) throw forbidden('Test payments are disabled.');
  const p = await findPayment(req.params.id);
  if (!p || p.provider !== 'test') throw notFound();
  const order = await one('SELECT number, total, customer FROM orders WHERE id=$1', [p.order_id]);
  res.json({ payment: { id: p.id, status: p.status, amount: p.amount, isTest: true }, order: { number: order.number, total: order.total } });
}));

r.post('/test/:id/decide', validate({ body: z.object({ decision: z.enum(['approve', 'decline']) }) }), ah(async (req, res) => {
  if (!testEnabled()) throw forbidden('Test payments are disabled.');
  const p = await findPayment(req.params.id);
  if (!p || p.provider !== 'test' || !p.is_test) throw notFound();
  if (p.status === 'succeeded') throw badRequest('This test payment was already approved.');
  const { order } = await applyPaymentResult(p.id, {
    status: req.body.decision === 'approve' ? 'succeeded' : 'failed',
    providerRef: `TEST-${Date.now()}`,
    raw: { test: true, decision: req.body.decision },
  });
  res.json({ orderNumber: order.number, status: order.status, paymentStatus: order.payment_status });
}));

export default r;
