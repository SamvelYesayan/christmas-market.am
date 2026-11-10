// Session handling: tokens live only in SecureStore, the server decides who is signed in.
import * as SecureStore from 'expo-secure-store';
import { KEYS } from '@/lib/secureStorage';
import { useSession } from '@/state/session';

jest.mock('@/api', () => {
  const actual = jest.requireActual('@/api/client');
  return {
    ...actual,
    api: {
      auth: { me: jest.fn(), login: jest.fn(), register: jest.fn(), logout: jest.fn(), changePassword: jest.fn() },
    },
  };
});
jest.mock('@/api/queries', () => ({ queryClient: { clear: jest.fn(), invalidateQueries: jest.fn() } }));

// eslint-disable-next-line import/first
import { api, ApiError } from '@/api';
// eslint-disable-next-line import/first
import { changePassword, register, restoreSession, signIn, signOut } from '@/state/auth';

const mocked = api as unknown as { auth: Record<string, jest.Mock> };
const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const user = { id: 'u1', email: 'demo@christmas-market.test', name: 'Demo', profile: {}, consents: {}, pioneer: null };

beforeEach(() => {
  store.clear();
  Object.values(mocked.auth).forEach((m) => m.mockReset());
  useSession.setState({ status: 'booting', token: null, cartToken: null, user: null });
});

describe('auth', () => {
  it('sign-in stores the session token only in SecureStore and drops the spent guest cart token', async () => {
    store.set(KEYS.cartToken, 'cart_guest_token_123456789');
    useSession.setState({ cartToken: 'cart_guest_token_123456789' });
    mocked.auth.login.mockResolvedValue({ user, session: { token: 'sess_token_abcdefghijklmnopqrstuvwxyz', expiresAt: '2027-01-01' } });
    await signIn('demo@christmas-market.test', 'pw');
    expect(store.get(KEYS.session)).toBe('sess_token_abcdefghijklmnopqrstuvwxyz');
    expect(store.has(KEYS.cartToken)).toBe(false);
    expect(useSession.getState()).toMatchObject({ status: 'signedIn', token: 'sess_token_abcdefghijklmnopqrstuvwxyz', cartToken: null, user });
  });

  it('refuses a login answer without a mobile session (old server)', async () => {
    mocked.auth.login.mockResolvedValue({ user });
    await expect(signIn('a@b.c', 'pw')).rejects.toThrow(/mobile session/);
    expect(store.has(KEYS.session)).toBe(false);
  });

  it('a wrong password leaves the phone signed out', async () => {
    mocked.auth.login.mockRejectedValue(new ApiError(401, 'unauthorized', 'That email and password do not match.'));
    await expect(signIn('a@b.c', 'bad')).rejects.toMatchObject({ status: 401 });
    expect(useSession.getState().token).toBeNull();
  });

  it('registration returns a session as well', async () => {
    mocked.auth.register.mockResolvedValue({ user, session: { token: 'sess_new_abcdefghijklmnopqrstuvwxyz', expiresAt: 'x' } });
    await register({ name: 'Demo', email: 'demo@x.am', password: '0123456789', marketingConsent: false, personalizationConsent: false });
    expect(store.get(KEYS.session)).toBe('sess_new_abcdefghijklmnopqrstuvwxyz');
    expect(mocked.auth.register.mock.calls[0][0].profile).toBeUndefined();
  });

  it('restores a valid session at launch', async () => {
    store.set(KEYS.session, 'sess_saved_abcdefghijklmnopqrstuvwxyz');
    mocked.auth.me.mockResolvedValue({ user });
    await restoreSession();
    expect(useSession.getState()).toMatchObject({ status: 'signedIn', user });
  });

  it('forgets an expired or revoked token at launch', async () => {
    store.set(KEYS.session, 'sess_old_abcdefghijklmnopqrstuvwxyz');
    mocked.auth.me.mockResolvedValue({ user: null });
    await restoreSession();
    expect(store.has(KEYS.session)).toBe(false);
    expect(useSession.getState().status).toBe('signedOut');
  });

  it('keeps the token when the phone is offline at launch', async () => {
    store.set(KEYS.session, 'sess_keep_abcdefghijklmnopqrstuvwxyz');
    mocked.auth.me.mockRejectedValue(new ApiError(0, 'network', 'offline'));
    await restoreSession();
    expect(store.get(KEYS.session)).toBe('sess_keep_abcdefghijklmnopqrstuvwxyz');
  });

  it('sign-out clears the token even if the server cannot be reached', async () => {
    store.set(KEYS.session, 'sess_x_abcdefghijklmnopqrstuvwxyz');
    useSession.setState({ token: 'sess_x_abcdefghijklmnopqrstuvwxyz', user: user as never, status: 'signedIn' });
    mocked.auth.logout.mockRejectedValue(new ApiError(0, 'network', 'offline'));
    await signOut();
    expect(store.has(KEYS.session)).toBe(false);
    expect(useSession.getState()).toMatchObject({ status: 'signedOut', token: null, user: null });
  });

  it('changing the password swaps in the new session the server issued', async () => {
    useSession.setState({ token: 'sess_old_abcdefghijklmnopqrstuvwxyz', user: user as never, status: 'signedIn' });
    mocked.auth.changePassword.mockResolvedValue({ ok: true, session: { token: 'sess_rotated_abcdefghijklmnopqrstuv', expiresAt: 'x' } });
    await changePassword('old-password', 'new-password-123');
    expect(store.get(KEYS.session)).toBe('sess_rotated_abcdefghijklmnopqrstuv');
    expect(useSession.getState().status).toBe('signedIn');
  });
});
