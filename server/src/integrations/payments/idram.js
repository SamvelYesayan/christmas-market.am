// Idram merchant integration (https://banking.idram.am). The shopper's browser POSTs a form to Idram;
// Idram calls our RESULT_URL twice: a pre-check (EDP_PRECHECK=YES) and the final confirmation with a checksum.
// Verify the field list and checksum order against the current Idram merchant documentation before going live.
import crypto from 'node:crypto';
import { config } from '../../config.js';

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

export const idram = {
  code: 'idram',
  label: 'Idram',
  description: 'Pay with your Idram wallet or Idram-linked card.',
  kind: 'form',
  available: () => !!(config.IDRAM_REC_ACCOUNT && config.IDRAM_SECRET_KEY),
  async createPayment({ order, payment }) {
    return {
      type: 'form',
      action: 'https://banking.idram.am/Payment/GetPayment',
      fields: {
        EDP_LANGUAGE: 'EN',
        EDP_REC_ACCOUNT: config.IDRAM_REC_ACCOUNT,
        EDP_DESCRIPTION: `Christmas Market order ${order.number}`,
        EDP_AMOUNT: String(order.total),
        EDP_BILL_NO: payment.id,
      },
    };
  },
  /** Returns { paymentId, status, providerRef, respond } — respond is the plain-text body Idram expects. */
  async handleCallback(req, { findPayment }) {
    const b = req.body ?? {};
    const payment = await findPayment(b.EDP_BILL_NO);
    if (!payment) return { respond: 'NOT_FOUND' };
    if (b.EDP_PRECHECK === 'YES') {
      const ok = b.EDP_REC_ACCOUNT === config.IDRAM_REC_ACCOUNT && Number(b.EDP_AMOUNT) === payment.amount;
      return { respond: ok ? 'OK' : 'WRONG_AMOUNT' };
    }
    const expected = md5(
      [b.EDP_REC_ACCOUNT, b.EDP_AMOUNT, config.IDRAM_SECRET_KEY, b.EDP_BILL_NO, b.EDP_PAYER_ACCOUNT, b.EDP_TRANS_ID, b.EDP_TRANS_DATE].join(':'),
    );
    if (!b.EDP_CHECKSUM || expected.toUpperCase() !== String(b.EDP_CHECKSUM).toUpperCase()) return { respond: 'BAD_CHECKSUM' };
    if (Number(b.EDP_AMOUNT) !== payment.amount) return { respond: 'WRONG_AMOUNT' };
    return { paymentId: payment.id, status: 'succeeded', providerRef: b.EDP_TRANS_ID, raw: { ...b, EDP_CHECKSUM: undefined }, respond: 'OK' };
  },
};
