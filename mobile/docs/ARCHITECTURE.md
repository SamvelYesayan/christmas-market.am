# Mobile architecture

## Stack

Expo SDK 58 (React Native 0.88, React 19.3, New Architecture, Hermes) · TypeScript strict · Expo Router (file
routes in `src/app`) · TanStack Query (server state) · Zustand (session, preferences, toasts — nothing else) ·
React Hook Form + Zod (forms) · Expo SecureStore · Reanimated 4 · Gesture Handler · react-native-svg ·
Expo Haptics · Expo Notifications · Expo Image · Expo Web Browser.

## Layout

```
mobile/
  src/app/                 screens (Expo Router). (tabs)/ = Home, Shop, Cart, Pioneer, Account on the bar (same five as the website); Calendar (advent) and Games are in the group but opened from Home and More
  src/api/                 client.ts (HTTP), endpoints.ts (typed calls), types.ts (response shapes), queries.ts (TanStack)
  src/state/               session.ts, auth.ts, prefs.ts (Zustand + SecureStore)
  src/features/            feature logic & composite UI (pioneer, calendar, games, shop, wishes, auth, account)
  src/components/          Art (ported product illustrations), Product, Common, Celebration, ui/ (design system)
  src/theme/tokens.ts      design tokens
  src/i18n/                hy.web.ts + en.web.ts (verbatim website dictionaries) + mobile.ts (app-only strings)
  src/lib/                 config, secureStorage, haptics, notifications, format
  __tests__/               Jest (jest-expo) tests with mocked APIs; live.integration.test.ts is opt-in
  scripts/                 port-art.mjs (regenerates art from the website), generate-icons.mjs (icons/splash)
```

`mobile/` is isolated: its own `package.json`/lockfile, not part of the root npm workspaces. `metro.config.js`
blocks the repository's root `node_modules` (the website's React 18) so the app can never resolve a web copy.

## Data flow

- **Server is the authority.** Prices, stock, coupons, Pioneer discount, rewards, game results, calendar "today",
  Grand Prize eligibility, Pioneer balance and redemptions are all decided by the API (and Magical). The app shows
  what the server answered and never computes a reward or balance.
- **TanStack Query** caches reads; keys include the language (server content is localized) and the user id where
  data is personal. Switching language invalidates all queries. Mutations that return a cart write it into the cache.
  Query-level retries are off — the HTTP client already retries safe reads.
- **Zustand** holds only cross-cutting client state: `useSession` (token, guest cart token, user), `usePrefs`
  (language, calm mode, haptics, analytics consent, reminders, guest persona), `useToasts`, celebration burst,
  and `useLangStore`.

## Authentication (session reuse)

The website uses an httpOnly `mc_session` cookie with Origin checks. Cookies are unreliable and invisible in a native
app, so the server got a **minimal, backward-compatible** addition (see `docs/ARCHITECTURE.md` at the repo root):

1. The app sends `X-Christmas-Client: mobile` on every request.
2. `POST /auth/login|register|password` then return `session: { token, expiresAt }` in the body (no cookie).
   It is the *same* session row/TTL/revocation as the website's — no new token type.
3. The app keeps the token **only** in Expo SecureStore (`cm.session`) and sends `Authorization: Bearer`.
4. Logout deletes the session server-side; a 401 on an authenticated request clears it locally.
5. Guest carts use `X-Cart-Token` (SecureStore `cm.cartToken`) instead of the `mc_cart` cookie; sign-in merges and
   spends it, as on the website.
6. Writes with the app header and *no* Origin skip the Origin check — there are no ambient cookies to forge, and a
   browser cannot add the header cross-site without a preflight that CORS refuses. Browser behaviour is unchanged.

Passwords and Pioneer card numbers/codes are sent once and never stored.

## Pioneer Card rules (mirrors the website)

- Balance shown as current **only** when `summary.live` and `balance.points` is an integer; otherwise "—", an
  "unavailable" notice and the last confirmed value with its date (`features/pioneer/logic.ts#balanceView`).
- "Refresh balance" = `GET /pioneer/summary?fresh=1` (server reads Magical without cache).
- Redemption (`RedeemSheet`): one `requestId` (`expo-crypto.randomUUID`) per opened sheet, reused on retry; a
  synchronous ref guard blocks a second tap before re-render; the button is disabled while in flight; the sheet
  cannot be dismissed mid-request. 201 → completed (code / collect), 202 → "waiting for confirmation", 4xx/503 →
  the server's message ("Nothing was deducted"). Writes are never auto-retried by the client.
- Card connection: 8 + 3 digits validated locally for UX only; the server/Magical decide; attempts left shown;
  the code field is cleared after every attempt.

## Games (anti-cheat preserved)

Session games (`catch`, `tree`) start on the server (seed, plays-per-day lock) and finish there (duration and
score plausibility, daily caps). The catch game uses the website's exact seeded RNG, speeds and scoring
(`features/games/catchEngine.ts`), so phone rounds are judged like browser rounds. Quiz answers are checked one by
one on the server; the wheel animates to the segment the server drew; the mystery box reveals what the server drew.

## Design system

`src/theme/tokens.ts` + `src/components/ui/*`:
- Palette from the website's night market: midnight surfaces (solid, layered — no glassmorphism), one warm accent
  (gold), ember red reserved for purchase / danger, and a cream **paper** surface for letters, tickets, calendar
  gifts and redemption sheets.
- Type: Fraunces (display) + Instrument Sans (UI) for English; Noto Serif / Noto Sans Armenian for Armenian (Latin
  faces have no Armenian glyphs — `Text` picks the family per language). Only the used weights are bundled.
- Spacing (4-pt), radius, elevation, motion tokens; 44-pt minimum touch targets; `maxFontSizeMultiplier` 1.6.
- Components: Text, Button (primary/ember/secondary/ghost/paper/paperOutline/danger, press spring + haptic),
  IconButton, Icon (own SVG line set, no emoji), Card, Badge, SectionHeader, OrnamentRule, Field, Toggle, Check,
  Chip, Segmented, Sheet (modal bottom sheet, Android back aware, lockable), Screen (safe areas, header, pull to
  refresh, pinned footer, keyboard avoidance), Loading (swinging lantern) / Empty / Error / Skeleton states, Toasts,
  Celebration burst, CouponTicket, Crest, Snowfall, HiddenWonder.
- Product imagery: uploaded photos via expo-image, otherwise the website's original procedural illustrations,
  ported to react-native-svg by `scripts/port-art.mjs` (`src/components/art/drawings.tsx` is generated).
- Motion respects calm mode and the OS "Reduce motion" setting (snowfall, bursts, spins are skipped).

## Navigation

Root stack (`src/app/_layout.tsx`) over a custom bottom tab bar with the five tabs shared with the website (Home, Shop, Cart, Pioneer, Account); everything else is listed in `more.tsx`. Detail screens are
stack routes; login/register are modals; the catch game disables the iOS back swipe while playing. Android back is
handled by the stack and by `Sheet` (`onRequestClose`). Deep links: scheme `christmasmarket://` with the website's
paths (`/product/:slug`, `/order/:number`, `/advent`, `/games/quiz`, `/shop/:category`, …); tapped calendar
reminders open `/advent`.

## Notifications

Local, opt-in calendar reminders (`lib/notifications.ts`). Remote push is prepared (permission + Expo push token
helper) but not wired: the backend has no device registration endpoint or sender — see KNOWN_LIMITATIONS.
