// Runtime configuration from public build-time env vars (EXPO_PUBLIC_*). Nothing secret lives here.
import Constants from 'expo-constants';

const trimSlash = (s: string) => s.replace(/\/+$/, '');

/**
 * In development with no EXPO_PUBLIC_API_URL, talk to the computer running Expo: Metro's host (its LAN IP when a
 * physical phone loads the bundle) on the API port. "localhost" would point at the phone itself.
 */
export function resolveApiOrigin(env: Record<string, string | undefined> = process.env, hostUri: string | null | undefined = Constants.expoConfig?.hostUri): string {
  const explicit = env.EXPO_PUBLIC_API_URL?.trim();
  if (explicit) return trimSlash(explicit.replace(/\/api\/v1\/?$/, ''));
  const port = env.EXPO_PUBLIC_API_PORT?.trim() || '4000';
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:${port}`;
  return `http://localhost:${port}`;
}

export const config = {
  apiOrigin: resolveApiOrigin(),
  get apiBase() {
    return `${this.apiOrigin}/api/v1`;
  },
  webUrl: trimSlash(process.env.EXPO_PUBLIC_WEB_URL?.trim() || 'https://christmas-market.am'),
  timeoutMs: Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS) || 15000,
};

/** Absolute URL for server-relative media such as /uploads/… */
export const mediaUrl = (u: string | null | undefined): string | null => {
  if (!u) return null;
  if (/^https?:\/\//.test(u) || u.startsWith('data:')) return u;
  return `${config.apiOrigin}${u.startsWith('/') ? '' : '/'}${u}`;
};
