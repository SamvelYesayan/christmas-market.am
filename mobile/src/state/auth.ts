// Sign-in, registration, sign-out and session restore. The server decides; the app only stores the token.
import { api, isApiError } from '@/api';
import { queryClient } from '@/api/queries';
import { useSession } from './session';
import { usePrefs } from './prefs';
import type { User } from '@/api/types';

/** At launch: load tokens from SecureStore and ask the server who we are. */
export async function restoreSession(): Promise<void> {
  const s = useSession.getState();
  await s.hydrate();
  if (!useSession.getState().token) {
    useSession.setState({ status: 'signedOut' });
    return;
  }
  try {
    const { user } = await api.auth.me();
    if (user) useSession.setState({ user, status: 'signedIn' });
    else await useSession.getState().clear(); // token expired or revoked on the server
  } catch (e) {
    // Offline at launch: keep the token, treat as signed out until the server can confirm.
    useSession.setState({ status: 'signedOut' });
    if (!isApiError(e) || !e.isNetwork) await useSession.getState().clear();
  }
}

export async function signIn(email: string, password: string): Promise<User | null> {
  const res = await api.auth.login(email, password);
  if (!res.session?.token) throw new Error('The server did not return a mobile session. Is the API up to date?');
  await useSession.getState().setSession(res.session, res.user);
  queryClient.clear();
  return res.user;
}

export async function register(input: { name: string; email: string; password: string; marketingConsent: boolean; personalizationConsent: boolean }): Promise<User | null> {
  const persona = usePrefs.getState().persona;
  const profile = input.personalizationConsent && persona ? { displayName: persona.name, atmosphere: persona.atmosphere, preferences: persona.preferences } : undefined;
  const res = await api.auth.register({ ...input, profile });
  if (!res.session?.token) throw new Error('The server did not return a mobile session. Is the API up to date?');
  await useSession.getState().setSession(res.session, res.user);
  queryClient.clear();
  return res.user;
}

export async function signOut(): Promise<void> {
  try {
    await api.auth.logout();
  } catch {
    /* even offline, forget the session on this phone */
  }
  await useSession.getState().clear();
  queryClient.clear();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await api.auth.changePassword(currentPassword, newPassword);
  // The server signs out every other session and issues a new one for this phone.
  if (res.session?.token) await useSession.getState().setSession(res.session, useSession.getState().user);
}
