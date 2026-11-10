// The app's API instance, wired to the session (tokens), the language and device preferences.
import { config } from '@/lib/config';
import { useSession } from '@/state/session';
import { usePrefs } from '@/state/prefs';
import { currentLang, t } from '@/i18n';
import { createApiClient } from './client';
import { endpoints } from './endpoints';

export const http = createApiClient({
  baseUrl: () => config.apiBase,
  getToken: () => useSession.getState().token,
  getCartToken: () => useSession.getState().cartToken,
  onCartToken: (token) => useSession.getState().setCartToken(token),
  getLocale: () => currentLang(),
  getVisitorId: () => usePrefs.getState().visitorId,
  onUnauthorized: () => {
    void useSession.getState().clear();
  },
  timeoutMs: config.timeoutMs,
  messages: () => ({ network: t('m.offline'), timeout: t('m.timeout'), generic: t('common.error') }),
});

export const api = endpoints(http);
export { ApiError, isApiError } from './client';
export type * from './types';
