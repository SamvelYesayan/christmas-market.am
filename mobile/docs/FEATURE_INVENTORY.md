# Feature inventory — website → native app

The website (`client/src`, routes in `client/src/App.jsx`) is the source of truth. Every user-facing feature is
listed here with the native screen that delivers it, the API it uses, and its status.

Status: **Done** = implemented natively against the real API · **Adapted** = same feature, mobile-appropriate form
(explained) · **Web-only** = deliberately not ported, with the reason · **Blocked** = needs something the backend
does not have yet (see `KNOWN_LIMITATIONS.md`).

Paths below are app routes (`src/app/…`); the same paths work as deep links: `christmasmarket://<path>`.

## Shop

| Website feature | App screen | API | Status |
|---|---|---|---|
| Home: hero, greeting by time of day, personal name | `/` `(tabs)/index.tsx` | `GET /content/home` | Done |
| Home: banners / announcements | `/` | `/content/home` (`banners`) | Done |
| Home: today's Christmas Calendar door / countdown | `/` (TodayCard) | `GET /advent` | Done |
| Home: most wished-for / featured, bestsellers | `/` rails | `/content/home` | Done |
| Home: market stalls (categories) | `/` | `GET /categories` | Done |
| Home: limited editions, on-sale | `/` rails → filtered Shop | `/content/home` | Done |
| Home: campaigns with codes ("Sealed with wax", Pioneer-only badge) | `/` | `/content/home` (`campaigns`) | Done (code copyable) |
| Home: events at the pavilion | `/` | `/content/home` (`events`) | Done |
| Home: postcards (review highlights) | `/` | `GET /reviews/highlights` | Done |
| Home: newsletter ("Letters from the North") with consent | `/` | `POST /newsletter` | Done |
| Home: Christmas Wishes wall | `/` preview + `/wishes` | `GET /wishes`, `GET /wishes/recent`, `POST /wishes` | Done |
| Home: doors to Gift Finder / Academy / Pioneer / games | `/` "More Christmas magic" | — | Done |
| Home: Wishing Tree / 3-D ornament / clocktower decorations | `/` hero + snowfall | — | Adapted (decorative WebGL/three.js scenes replaced by native art + snowfall) |
| Shop: all products, paging | `/shop` `(tabs)/shop.tsx` | `GET /products?page&limit` | Done (infinite "Show more") |
| Shop: category stalls `/shop/:category` | `/shop?category=` (+ `/shop/[category]` redirect) | `GET /categories`, `/products?category` | Done |
| Shop: search | `/shop` search field (debounced) | `/products?q=` | Done |
| Shop: sort (popular, new, price ↑↓, A→Z) | `/shop` filter sheet | `/products?sort=` | Done |
| Shop: price ranges, magical, limited, special offers | `/shop` filter sheet | `/products?min&max&magic&limited&onSale` | Done |
| Product: gallery / procedural art | `/product/[slug]` | `GET /products/:slug` | Done (same original art, ported to react-native-svg) |
| Product: price, sale, save %, badges, rating, stock level | `/product/[slug]` | same | Done |
| Product: variants with price delta, sold-out variants | `/product/[slug]` | same | Done |
| Product: personalisation text | `/product/[slug]` | `POST /cart/items` (`personalization`) | Done |
| Product: quantity + add to cart | `/product/[slug]` | `POST /cart/items` | Done |
| Product: wishlist heart | everywhere products appear | `POST/DELETE /wishlist/:id` | Done (guests → sign in) |
| Product: story, description, delivery promises | `/product/[slug]` | same | Done |
| Product: guest book reviews + write review | `/product/[slug]` (sheet) | `POST /products/:slug/reviews` | Done |
| Product: related gifts | `/product/[slug]` | same (`related`) | Done |
| Cart drawer + cart page: lines, qty ±, remove | `/cart` | `GET /cart`, `PATCH/DELETE /cart/items/:id` | Done |
| Cart: discount / Advent code apply & remove, coupon errors | `/cart`, `/checkout` | `POST/DELETE /cart/coupon` | Done |
| Cart: Pioneer discount line, link-card hint | `/cart` | `GET /cart` (`pioneerDiscount`) | Done |
| Guest cart (no account) | everywhere | `X-Cart-Token` header (see ARCHITECTURE) | Done |
| Guest cart merged on sign-in | sign in / register | `POST /auth/login|register` | Done |
| Checkout: Who → Where → How → Review | `/checkout` | `GET /checkout/options`, `GET /checkout/quote`, `POST /orders` | Done (RHF + Zod) |
| Checkout: delivery zones, address, date, courier notes, gift card message | `/checkout` | same | Done |
| Checkout: "remember my details" | `/checkout` | — (SecureStore on the phone) | Done |
| Checkout: payment methods incl. "coming soon" list, TEST provider banner | `/checkout` | `/checkout/options` | Done |
| Payment: cash on delivery | `/checkout` → `/order/[number]` | `POST /orders` | Done |
| Payment: redirect providers (Ameriabank, ArCa, Telcell, Stripe) | in-app browser, order re-read on return | `POST /orders`, `/orders/:n/pay` | Adapted (provider page opens in the system in-app browser; result is read from the server, never assumed) |
| Payment: Idram (form POST) | website order page in the in-app browser | `/orders/:n/pay` via web | Adapted — see KNOWN_LIMITATIONS |
| Payment: TEST provider page (development) | `/pay/test/[id]` | `GET /payments/test/:id`, `POST …/decide` | Done |
| Order confirmation (fresh order, celebration) | `/order/[number]` | `GET /orders/:number?key=` | Done |
| Order tracking timeline, totals, delivery, tracking code | `/order/[number]` | same | Done |
| Complete an unpaid order's payment | `/order/[number]` | `POST /orders/:n/pay` | Done |
| Track an order (number + email, guests) | `/track` | `GET /orders/:number?email=` | Done |
| Guest order access key | stored in SecureStore | `accessKey` from `POST /orders` | Done |
| Gift Finder (Compass of Wishes), 6 questions, preset recipient | `/gift-finder` (`?for=`) | `POST /gift-finder` | Done |

## Account

| Website feature | App screen | API | Status |
|---|---|---|---|
| Sign in | `/login` (modal) | `POST /auth/login` | Done (bearer session in SecureStore) |
| Create account with consents (personalisation, letters) | `/register` (modal) | `POST /auth/register` | Done |
| Sign out | `/account/settings` | `POST /auth/logout` | Done |
| Session restore / expiry | app launch | `GET /auth/me` | Done |
| Account overview: identity/house, Stardust, Pioneer card, calendar progress, wishlist count | `/account` (Me tab) | `GET /me/dashboard` | Done |
| Codes waiting for you (coupons) | `/account`, `/account/rewards` | `/me/dashboard` (`coupons`) | Done |
| Picked for you (recommendations) | `/account` | `GET /me/recommendations` | Done |
| Orders list | `/account/orders` | `/me/dashboard` (`orders`) | Done |
| Wishlist | `/account/wishlist` | `GET /wishlist` | Done |
| Rewards: achievements, reward history, Pioneer sync status | `/account/rewards` | `/me/dashboard` | Done |
| Profile: name, phone, personalisation consent, display name, atmosphere, newsletter consent | `/account/settings` | `PUT /me/profile` | Done |
| Change password (other devices signed out) | `/account/settings` | `POST /auth/password` | Done (new session token stored) |
| Language switch (hy / en) | `/account/settings` | `X-Locale` on every request | Done (Armenian default, all content refetched on switch) |
| Welcome ritual (Lantern Gate: name, 3 questions, atmosphere, remember on device) | `/account/welcome` | `PUT /me/profile` when consented | Done |
| "Forget me on this device" | `/account/settings` | — | Done |
| Calm mode (reduced motion) | `/account/settings` | — | Done (also follows OS Reduce Motion) |
| Consent bar: anonymous visit counting | `/account/settings` toggle (off by default) | `POST /analytics` + `X-Visitor-Id` | Adapted (setting instead of a banner) |
| Opening intro (Santa intro, full/short/off) | — | — | Web-only (cinematic web intro; the app opens straight into Home with a native splash) |
| Ambient music player | — | — | Web-only (Web Audio synthesis; a background music player is not appropriate for a shopping app) |
| Cursor magic, sky canvas, snow accumulation | — | — | Web-only (pointer/canvas effects) — replaced by native snowfall, sparkle bursts and haptics |
| Admin "Elves' Office" (`/admin`) | — | — | Web-only (staff tool, not a customer feature; the app mentions it for admins) |
| Help: delivery & returns, privacy, terms | `/info/[topic]` | — (same texts) | Done |
| 404 page | `+not-found` | — | Done |

## Magical Pioneer Card

| Website feature | App screen | API | Status |
|---|---|---|---|
| Pioneer landing: benefits, how it works, card visual | `/pioneer` | `GET /pioneer/status` | Done |
| Member offers list (gift / discount / exclusive) | `/pioneer` | `GET /pioneer/offers` | Done |
| Redeem a gift with points (one `requestId` per confirmation) | `/pioneer` → RedeemSheet | `POST /pioneer/offers/:id/redeem` | Done (same idempotency as `RedeemDialog`, plus a synchronous double-tap guard) |
| Redemption outcomes: completed (code / collect), pending (202), refused (409/422/503) | RedeemSheet | same | Done |
| Connect card (8-digit number + 3-digit code, attempts left) | `/account/pioneer` | `POST /pioneer/link` | Done (code cleared after every attempt, nothing stored) |
| Live balance + "Live from the Pioneer system" | `/account/pioneer` | `GET /pioneer/summary` | Done |
| Refresh balance (read Magical again) | `/account/pioneer` + pull-to-refresh | `GET /pioneer/summary?fresh=1` | Done |
| Magical unavailable → no current balance, "last confirmed" labelled | `/account/pioneer` | same (`live:false`, `lastConfirmed`) | Done |
| Card facts: holder, number, member since, discount | `/account/pioneer` | same | Done |
| Available rewards with eligibility state & progress | `/account/pioneer` | same (`rewards`) | Done |
| Per-reward eligibility check | `/account/pioneer` ("Check eligibility") | `GET /pioneer/rewards/:id/eligibility` | Done (the website does not expose this button; the app adds it) |
| Store activity: game credits, gift redemptions, status, codes, collection | `/account/pioneer` | same (`activity`) | Done |
| Pioneer transaction history with paging | `/account/pioneer` | `GET /pioneer/transactions?page` | Done |
| Disconnect card (blocked while a debit is open) | `/account/pioneer` | `DELETE /pioneer/link` | Done |
| Unlinked by Magical notice | `/account/pioneer` | `summary.unlinkedRemotely` | Done |
| Public Magical reward catalog | — | `GET /pioneer/rewards` | Not used — the website does not show it either; customer rewards come from the summary |

## Christmas fun

| Website feature | App screen | API | Status |
|---|---|---|---|
| Christmas Calendar — 31 Days of Gifts: grid, legend, progress | `/advent` (from Home and More) | `GET /advent` | Done |
| Day window: reveal, options (choose a gift), claim | Calendar → day sheet | `POST /advent/claim` | Done (server decides "today") |
| Locked / missed / passed days (toast + shake) | Calendar | — | Done |
| Received gift: text, story, coupon, Stardust, product, game link | day sheet | `GET /advent` (`received`) | Done |
| Gifts left today, "still being wrapped" | day sheet | same | Done |
| Grand Prize (31 Dec): eligibility on track / qualified / lost / entered, missed days | Calendar + sheet | `grand` | Done |
| Before December / after the 31st | Calendar | `phase`, `startsIn` | Done |
| Games hub (Frost Fair): plays left today, rules | `/games` (Play tab) | `GET /games` | Done |
| Daily challenges + claim | `/games` | `GET /challenges/today`, `POST /challenges/:id/claim` | Done |
| Catch the Falling Gifts (45 s arcade) | `/games/catch` | `POST /games/catch/start|finish` | Done (same seeded RNG & scoring; server judges) |
| Decorate Your Tree | `/games/tree` | `POST /games/tree/start|finish` | Done |
| Winter Quiz (7 questions, fun facts, perfect-score coupon) | `/games/quiz` | `POST /games/quiz/start|answer` | Done |
| Christmas Wheel (daily spin) | `/games/wheel` | `GET /games/wheel`, `POST /games/wheel/spin` | Done (server picks segment) |
| Mystery Gift Box (daily, rarity) | `/games/mystery` | `GET /games/mystery`, `POST /games/mystery/open` | Done |
| Hidden Wonders list | `/games/hidden` | `GET /hidden` | Done |
| Hidden wonders placed on pages (golden-acorn, silver-key, sugar-quill, tiny-reindeer, moon-feather, compass-star) | Home, Shop, Play, Gift Finder, Academy, Pioneer | `POST /hidden/:key/find` | Done |
| Frostspire Academy: sorting ceremony (7 questions) | `/academy` | `GET /academy/sorting`, `POST /academy/sort` | Done |
| Academy: house reveal, magical identity, acceptance letter, signature spell | `/academy` | `GET /academy/me` | Done |
| Academy: guest sorting (not saved) & "take again" | `/academy` | `POST /academy/sort` (guest) | Done (result kept on the phone) |
| Academy: four houses, members | `/academy` | `GET /academy/houses` | Done |
| Academy: shop | `/academy` | `GET /academy/shop` | Done |
| Christmas Wishes: write a wish (moderated), categories | `/wishes` + Home | `POST /wishes` | Done (time-open sent as anti-spam signal; the hidden honeypot field is not needed in a native form) |
| Rewards celebrations (confetti / toasts) | global | server `reward` / `achievement` | Adapted (gold sparkle burst + toast + haptic) |

## Notifications

| Feature | App | API | Status |
|---|---|---|---|
| Calendar reminders | `/account/settings` toggle → local reminders 10:00 each remaining December day | — | Done (local, opt-in, honest wording) |
| Tapping a reminder opens the calendar | root layout | — | Done |
| Push from the server (order status, offers) | permission + Expo push token helper ready | none | **Blocked** — the backend has no device-token endpoint or sender |
