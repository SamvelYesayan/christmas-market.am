# Known limitations & open decisions

## Blocked by the backend

- **Remote push notifications.** The API has no endpoint to register a device push token and no sender (order
  status changes, offers, Pioneer confirmations). The app asks for notification permission only for its local
  calendar reminders and has `getPushTokenForFutureUse()` ready; nothing is sent to the server and no notification
  is ever faked. Needed: `POST /me/devices` (store Expo push token per session), a sender on order/redemption
  events, an EAS project id, and a development/production build (Expo Go on Android cannot receive remote push).
- **Idram payments** use an auto-submitting HTML form POST. A native app cannot POST a form into the system
  browser, so the app opens the website's order page (with the order's access key) in the in-app browser, where the
  website submits the form. Redirect-based providers (Ameriabank, ArCa, Telcell, Stripe) open directly.
- **Provider return lands on the website.** After paying, providers return to the API, which verifies and
  redirects to the website's `/order/:number`. The app re-reads the order when the in-app browser closes or the app
  returns to the foreground, so the status shown always comes from the server; the user may briefly see the
  website's order page inside the in-app browser before closing it. A future `returnUrl` to `christmasmarket://`
  would make this seamless.

## Deliberately not ported (web-only)

- Admin "Elves' Office" (`/admin`) — a staff tool, not a customer feature. Admins are pointed to the website.
- Cinematic Santa intro, ambient Web Audio music player, cursor magic, WebGL/three.js 3-D ornament, sky canvas and
  snow accumulation — browser effects. The app uses a native splash, snowfall, sparkle bursts and haptics instead,
  all disabled by calm mode / OS Reduce Motion.
- Consent banner → replaced by an off-by-default "Anonymous visit counting" setting (same `/analytics` call).

## Verification gaps (this environment)

- No Android emulator image, connected device, JDK or macOS was available, so the app was **not run on a device or
  simulator** here. Verified instead: TypeScript, ESLint (incl. React Compiler rules), 98 Jest tests with mocked
  APIs, an opt-in live test of the app's API layer against the running local backend (4/4), `expo export
  --platform android` (full Metro/Hermes bundle of every route) and `expo-doctor` (20/20). A first device run
  should check visual polish, keyboard behaviour on small screens and the catch game's frame rate on low-end
  Android (it re-renders an SVG scene per frame).
- iOS was not built (no macOS). Nothing in the code is Android-specific.

## Open decisions

- **Bundle identifiers** `am.christmasmarket.app` (iOS & Android) are placeholders — confirm before the first store
  upload.
- **Universal / App Links** (`https://christmas-market.am/...` opening the app) are not enabled: they need
  `apple-app-site-association` and `assetlinks.json` served by the website plus the final ids. The custom scheme
  `christmasmarket://` works now.
- **App icon** is generated placeholder artwork (gold star on midnight). Replace with final brand artwork.
- **EAS project** (`extra.eas.projectId`) not created — needed for cloud builds and push tokens.
- **Mobile session lifetime** equals the website's `SESSION_TTL_DAYS`. A separate, longer mobile TTL or refresh
  tokens could be considered later; today the user signs in again after expiry.
- **Pioneer "Check eligibility"** per reward is exposed in the app (the API existed; the website does not show a
  button). Keep or remove for parity.
- The public Magical reward catalog (`GET /pioneer/rewards`) is not shown (the website does not show it either).

## Smaller notes

- Checkout's preferred delivery date is a validated `YYYY-MM-DD` text field (no native date picker dependency).
- The website dictionaries are copied into the app (`src/i18n/*.web.ts`); re-copy after text changes.
- `src/components/art/drawings.tsx` is generated (`scripts/port-art.mjs`) and excluded from type checking with
  `@ts-nocheck`; its typed boundary is `src/components/Art.tsx`.
