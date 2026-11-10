# Christmas Market — native app

The native Android / iOS app for **Christmas Market** (christmas-market.am): the gift shop with cart, checkout and
order tracking, the 31-day Christmas Calendar with its Grand Prize, the Frost Fair games and daily challenges,
Frostspire Academy, the Christmas Wishes wall, the Gift Finder, and the Magical Pioneer Card (live balance,
rewards, history, gift redemption). Armenian first, English second — the same texts as the website.

Built with Expo SDK 58 + TypeScript + Expo Router, TanStack Query, Zustand, React Hook Form + Zod, Expo
SecureStore, Reanimated, Expo Haptics/Notifications/Image. Real native UI — no WebView.

```bash
cd mobile
npm install
cp .env.example .env.local     # optional — empty API URL = your computer's LAN IP on port 4000
npx expo start                 # scan the QR code with Expo Go, or press a / i
```

The backend must be running (`npm run dev -w server` at the repo root). Details for phones, emulators and builds:
[docs/BUILD_GUIDE.md](docs/BUILD_GUIDE.md).

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Expo dev server |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint (Expo config + React Compiler rules) |
| `npm test` | Jest with mocked APIs |
| `npm run validate:android` | Bundles every route for Android (Metro + Hermes) |
| `npm run doctor` | expo-doctor |

## Docs

- [Feature inventory](docs/FEATURE_INVENTORY.md) — every website feature → app screen → API → status
- [API mapping](docs/API_MAPPING.md) — endpoints, headers, retries, the server additions for the app
- [Architecture](docs/ARCHITECTURE.md) — structure, auth, Pioneer rules, games anti-cheat, design system
- [Build guide](docs/BUILD_GUIDE.md) — install, Expo Go vs dev build, Android, iOS, physical phone, backend URL
- [Known limitations](docs/KNOWN_LIMITATIONS.md) — what is blocked, web-only, unverified, and open decisions

## Principles

- The server decides: prices, stock, rewards, game results, calendar days, Pioneer balances and redemptions.
- Secrets never live in the app: the session token is kept only in SecureStore; card numbers/codes and passwords
  are sent once and never stored; `EXPO_PUBLIC_*` values are public.
- No fake data: every screen shows real API data with designed loading, empty and error states.
