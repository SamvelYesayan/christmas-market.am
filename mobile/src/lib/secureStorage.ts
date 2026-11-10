// Small key/value persistence in the platform keychain/keystore (expo-secure-store).
// The session token and guest-cart token are secrets and live ONLY here. Preferences use it too, for simplicity.
import * as SecureStore from 'expo-secure-store';

export const KEYS = {
  session: 'cm.session',
  cartToken: 'cm.cartToken',
  prefs: 'cm.prefs',
  persona: 'cm.persona',
  checkout: 'cm.checkout',
  orderKeys: 'cm.orderKeys',
  visitorId: 'cm.visitorId',
  guestHouse: 'cm.guestHouse',
} as const;

export async function getItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string | null): Promise<void> {
  try {
    if (value == null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    /* storage unavailable — keep working in memory */
  }
}

export async function getJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const setJson = (key: string, value: unknown) => setItem(key, value == null ? null : JSON.stringify(value));
