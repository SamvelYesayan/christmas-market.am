// Payment provider registry.
// Each provider: { code, label, description, kind, isTest, available(), createPayment(ctx), verify?(payment, req), handleCallback?(req) }
//   createPayment returns one of:
//     { type: 'offline' }                       – nothing to pay online (cash on delivery)
//     { type: 'redirect', url, providerRef? }   – send the browser to url
//     { type: 'form', action, fields }          – browser auto-submits a POST form (Idram)
// Payment success is only ever recorded from a provider confirmation (callback or server-side verify),
// or — for the TEST provider — from the explicit test approval page, and those orders are flagged is_test.
import { cashOnDelivery } from './cod.js';
import { testProvider } from './test.js';
import { idram } from './idram.js';
import { ameriabank } from './ameriabank.js';
import { arca } from './arca.js';
import { telcell } from './telcell.js';
import { stripe } from './stripe.js';
import { currentLocale } from '../../i18n/index.js';

const all = [cashOnDelivery, idram, ameriabank, arca, telcell, stripe, testProvider];

export const providers = Object.fromEntries(all.map((p) => [p.code, p]));

const HY = {
  cash_on_delivery: ['Կանխիկ կամ քարտով՝ առաքման պահին', 'Վճարեք առաքիչին կանխիկ կամ քարտով, երբ սահնակը հասնի։'],
  idram: ['Idram', 'Վճարեք Idram դրամապանակով կամ դրան կցված քարտով։'],
  ameriabank: ['Քարտ (Ամերիաբանկ)', 'Visa, Mastercard և ArCa քարտեր Ամերիաբանկի անվտանգ էջում։'],
  arca: ['ArCa քարտ', 'Վճարեք ցանկացած հայկական ArCa քարտով։'],
  telcell: ['Telcell դրամապանակ', 'Վճարեք Telcell դրամապանակից կամ ցանկացած Telcell տերմինալից։'],
  stripe: ['Միջազգային քարտ (Stripe)', 'Visa, Mastercard, Amex, Apple Pay և Google Pay՝ արտերկրում թողարկված քարտերի համար։'],
  test: ['ՓՈՐՁՆԱԿԱՆ վճարում (առանց իրական գումարի)', 'Միայն մշակման համար․ նմանակում է վճարային էջը, որտեղ ընտրում եք՝ հաստատել, թե մերժել։'],
};

export function listPaymentMethods({ includeUnavailable = false } = {}) {
  const hy = currentLocale() === 'hy';
  return all
    .filter((p) => includeUnavailable || p.available())
    .map((p) => ({
      code: p.code,
      label: hy ? HY[p.code]?.[0] ?? p.label : p.label,
      description: hy ? HY[p.code]?.[1] ?? p.description : p.description,
      kind: p.kind,
      isTest: !!p.isTest,
      available: p.available(),
    }));
}

export function getProvider(code) {
  const p = providers[code];
  return p && p.available() ? p : null;
}
