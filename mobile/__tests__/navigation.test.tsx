// Navigation: every website path has a native route (deep links `christmasmarket://<path>` mirror the website),
// and the tab bar switches between the five real sections.
import fs from 'node:fs';
import path from 'node:path';
import { Text } from 'react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { useLangStore } from '@/i18n';
import TabsLayout from '@/app/(tabs)/_layout';

// The tab bar only needs the cart count here; no network in this test.
jest.mock('@/api/queries', () => ({ ...jest.requireActual('@/api/queries'), useCart: () => ({ data: { count: 0 } }) }));

const APP = path.join(__dirname, '..', 'src', 'app');
const exists = (rel: string) => ['.tsx', '.ts'].some((ext) => fs.existsSync(path.join(APP, rel + ext)));

// Website route (client/src/App.jsx) → file that serves it in the app.
const PARITY: Record<string, string> = {
  '/': '(tabs)/index',
  '/shop': '(tabs)/shop',
  '/shop/:category': 'shop/[category]',
  '/product/:slug': 'product/[slug]',
  '/gift-finder': 'gift-finder',
  '/advent': '(tabs)/advent',
  '/games': '(tabs)/games',
  '/games/catch': 'games/catch',
  '/games/tree': 'games/tree',
  '/games/quiz': 'games/quiz',
  '/games/wheel': 'games/wheel',
  '/games/mystery': 'games/mystery',
  '/games/hidden': 'games/hidden',
  '/academy': 'academy',
  '/pioneer': '(tabs)/pioneer',
  '/cart': '(tabs)/cart',
  '/checkout': 'checkout',
  '/order/:number': 'order/[number]',
  '/track': 'track',
  '/pay/test/:id': 'pay/test/[id]',
  '/account': '(tabs)/account',
  '/account/orders': 'account/orders',
  '/account/wishlist': 'account/wishlist',
  '/account/rewards': 'account/rewards',
  '/account/pioneer': 'account/pioneer',
  '/account/settings': 'account/settings',
  '/login': 'login',
  '/register': 'register',
  '/info/:topic': 'info/[topic]',
  '*': '+not-found',
};

describe('route parity with the website', () => {
  it.each(Object.entries(PARITY))('%s is served by src/app/%s', (_web, file) => {
    expect(exists(file)).toBe(true);
  });
});

describe('tab navigation', () => {
  beforeEach(() => useLangStore.setState({ lang: 'en' }));
  const stub = (label: string) => function Stub() { return <Text>{label} screen</Text>; };

  it('shows the five sections and switches between them', async () => {
    await renderRouter({
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': stub('Home'),
      '(tabs)/shop': stub('Shop'),
      '(tabs)/cart': stub('Cart'),
      '(tabs)/pioneer': stub('Pioneer'),
      '(tabs)/advent': stub('Calendar'),
      '(tabs)/games': stub('Play'),
      '(tabs)/account': stub('Account'),
    }, { initialUrl: '/' });
    expect(await screen.findByText('Home screen')).toBeTruthy();
    for (const [label, pathname] of [['Shop', '/shop'], ['Cart', '/cart'], ['Pioneer', '/pioneer'], ['Account', '/account']] as const) {
      await fireEvent.press(screen.getByLabelText(label));
      expect(await screen.findByText(`${label} screen`)).toBeTruthy();
      expect(screen).toHavePathname(pathname);
    }
  });

  it('opens Calendar by deep link even though it is not on the tab bar', async () => {
    await renderRouter({
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': stub('Home'),
      '(tabs)/shop': stub('Shop'),
      '(tabs)/cart': stub('Cart'),
      '(tabs)/pioneer': stub('Pioneer'),
      '(tabs)/advent': stub('Calendar'),
      '(tabs)/games': stub('Play'),
      '(tabs)/account': stub('Account'),
    }, { initialUrl: '/advent' });
    expect(await screen.findByText('Calendar screen')).toBeTruthy();
    expect(screen).toHavePathname('/advent');
  });
});
