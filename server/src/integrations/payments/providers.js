// Shared helpers for payment adapters.
import { config } from '../../config.js';

export const apiUrl = (path) => `${config.PUBLIC_API_URL.replace(/\/$/, '')}/api/v1${path}`;
export const appUrl = (path) => `${config.APP_ORIGIN.split(',')[0].trim().replace(/\/$/, '')}${path}`;

/** URL the provider sends the shopper back to; the server verifies, then redirects to the order page. */
export const returnUrl = (provider, paymentId) => apiUrl(`/payments/${provider}/return?payment=${paymentId}`);

export class PaymentError extends Error {
  constructor(message, code = 'payment_error') {
    super(message);
    this.code = code;
  }
}

export async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new PaymentError(`Provider responded ${res.status}`);
  return data;
}
