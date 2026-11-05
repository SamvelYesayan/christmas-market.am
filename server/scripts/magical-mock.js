// Local stand-in for the Magical Pioneer Integration API, for development (npm run magical:mock).
// Same contract as magical.am (docs: magical-full/docs/PIONEER_CARD_API.md), in memory, on 127.0.0.1 only.
// Nothing here can touch real Pioneer cards or balances. Its key is a public, fake test key.
//
// Use it from server/.env:
//   MAGICAL_PIONEER_API_URL=http://127.0.0.1:3900/api/integration/v1
//   MAGICAL_PIONEER_API_KEY=mgpc_test_mock_key_0123456789abcdefghijklmnopqrstu
// Test cards: 4815 1623 / code 904 (220 points) · 4242 4242 / 111 (40 points) · 1313 1313 / 222 (inactive)
import { createMagicalMock, MOCK_KEY } from '../test/helpers/magicalMock.js';

const port = Number(process.env.MAGICAL_MOCK_PORT ?? 3900);
const mock = createMagicalMock({ scopes: ['cards:verify', 'cards:link', 'cards:read', 'rewards:read', 'points:credit', 'points:debit'] });
const url = await mock.start(port);

console.log(`Local Magical mock (test data only) listening on ${url}`);
console.log(`Test key (public, fake): ${MOCK_KEY}`);
console.log('Test cards: 4815 1623 / 904 · 4242 4242 / 111 · 1313 1313 / 222 (inactive). Data is lost when this process stops.');
const stop = () => mock.stop().then(() => process.exit(0));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
