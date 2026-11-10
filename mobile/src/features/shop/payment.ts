// Payments after an order is placed. The phone never decides that something is paid: providers confirm to the
// server (callback / verify), and the app re-reads the order afterwards.
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { config } from '@/lib/config';
import { KEYS, getJson, setJson } from '@/lib/secureStorage';
import type { PaymentInstruction } from '@/api/types';

/** Guest orders are opened with the access key the server returned at checkout. Kept in SecureStore. */
export async function rememberOrderKey(number: string, key: string) {
  const all = await getJson<Record<string, string>>(KEYS.orderKeys, {});
  all[number] = key;
  const entries = Object.entries(all).slice(-30);
  await setJson(KEYS.orderKeys, Object.fromEntries(entries));
}
export async function orderKey(number: string): Promise<string | null> {
  const all = await getJson<Record<string, string>>(KEYS.orderKeys, {});
  return all[number] ?? null;
}

/** The development-only TEST provider page has a native screen; detect its URL. */
export function testPaymentId(url: string): string | null {
  const m = /\/pay\/test\/([0-9a-f-]{36})/i.exec(url);
  return m ? m[1] : null;
}

export type PaymentOutcome = 'offline' | 'test' | 'browser' | 'web';

/**
 * Starts the provider step:
 *  • offline (cash on delivery) → nothing to do
 *  • TEST provider → native test page (development only)
 *  • redirect providers → the provider's secure page in an in-app browser; the order is re-read on return
 *  • form-post providers (Idram) → the website's order page, which submits the provider form
 */
export async function startPayment(payment: PaymentInstruction, order: { number: string }, accessKey: string | null): Promise<PaymentOutcome> {
  if (payment.type === 'offline') return 'offline';
  if (payment.type === 'redirect') {
    const testId = testPaymentId(payment.url);
    if (testId) {
      router.push({ pathname: '/pay/test/[id]', params: { id: testId, number: order.number } });
      return 'test';
    }
    await WebBrowser.openBrowserAsync(payment.url, { dismissButtonStyle: 'done', presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
    return 'browser';
  }
  const url = `${config.webUrl}/order/${encodeURIComponent(order.number)}${accessKey ? `?key=${encodeURIComponent(accessKey)}` : ''}`;
  await WebBrowser.openBrowserAsync(url, { dismissButtonStyle: 'done' });
  return 'web';
}
