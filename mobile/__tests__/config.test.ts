import { resolveApiOrigin } from '@/lib/config';

describe('API base URL', () => {
  it('uses EXPO_PUBLIC_API_URL when set (and tolerates a trailing /api/v1)', () => {
    expect(resolveApiOrigin({ EXPO_PUBLIC_API_URL: 'https://christmas-market.am/api/v1/' }, null)).toBe('https://christmas-market.am');
    expect(resolveApiOrigin({ EXPO_PUBLIC_API_URL: 'http://10.0.2.2:4000' }, null)).toBe('http://10.0.2.2:4000');
  });

  it('defaults to the LAN host of the computer running Expo, not the phone itself', () => {
    expect(resolveApiOrigin({}, '192.168.1.20:8081')).toBe('http://192.168.1.20:4000');
    expect(resolveApiOrigin({ EXPO_PUBLIC_API_PORT: '4100' }, '192.168.1.20:8081')).toBe('http://192.168.1.20:4100');
  });

  it('falls back to localhost when nothing is known (simulators, tests)', () => {
    expect(resolveApiOrigin({}, null)).toBe('http://localhost:4000');
  });
});
