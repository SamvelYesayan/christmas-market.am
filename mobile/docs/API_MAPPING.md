# API mapping

All calls go through one client (`src/api/client.ts`) and typed functions (`src/api/endpoints.ts`), base
`<origin>/api/v1`. Every request sends `Accept: application/json`, `X-Locale: hy|en` and
`X-Christmas-Client: mobile`; signed-in requests add `Authorization: Bearer <session token>`; a guest cart adds
`X-Cart-Token`; with analytics consent, `X-Visitor-Id`.

Retries: only `GET`/`HEAD`, only for network errors, timeouts and 502/503/504, at most 2 retries (400 ms, 800 ms).
Writes are never retried automatically. Default timeout 15 s (`EXPO_PUBLIC_API_TIMEOUT_MS`).
Errors: the server's `{ error: { code, message, details } }` becomes `ApiError(status, code, message, details,
retryAfter)`; network failures are `code: 'network' | 'timeout' | 'aborted'` with localized messages.

| Endpoint | Function | Used by |
|---|---|---|
| `GET /auth/me` | `api.auth.me` | launch (`restoreSession`), `refreshUserData` |
| `POST /auth/login` | `api.auth.login` → `{ user, session }` | `/login` |
| `POST /auth/register` | `api.auth.register` → `{ user, session }` | `/register` |
| `POST /auth/logout` | `api.auth.logout` | settings |
| `POST /auth/password` | `api.auth.changePassword` → `{ ok, session }` | settings |
| `PUT /me/profile` | `api.me.updateProfile` | settings, welcome ritual |
| `GET /me/dashboard` | `api.me.dashboard` | Me tab, orders, rewards |
| `GET /me/recommendations` | `api.me.recommendations` | Me tab |
| `GET /categories` | `api.catalog.categories` | Home, Shop |
| `GET /products` | `api.catalog.products` | Shop |
| `GET /products/:slug` | `api.catalog.product` | Product |
| `POST /products/:slug/reviews` | `api.catalog.review` | Product |
| `POST /gift-finder` | `api.catalog.giftFinder` | Gift Finder |
| `GET /reviews/highlights` | `api.catalog.reviewHighlights` | Home |
| `GET /content/home` | `api.content.home` | Home |
| `POST /newsletter` | `api.content.newsletter` | Home |
| `POST /analytics` | `api.content.analyticsVisit` | launch (only with consent) |
| `GET /wishlist` | `api.wishlist.list` | Wishlist |
| `POST /wishlist/:productId` / `DELETE` | `api.wishlist.add/remove` | heart buttons |
| `GET /cart` | `api.cart.get` | cart badge, Cart, Checkout |
| `POST /cart/items` | `api.cart.add` | Product |
| `PATCH /cart/items/:id`, `DELETE /cart/items/:id` | `api.cart.setQuantity/remove` | Cart |
| `POST /cart/coupon`, `DELETE /cart/coupon` | `api.cart.applyCoupon/removeCoupon` | Cart, Checkout |
| `GET /checkout/options` | `api.checkout.options` | Checkout |
| `GET /checkout/quote?zone=` | `api.checkout.quote` | Checkout |
| `POST /orders` | `api.checkout.placeOrder` | Checkout |
| `GET /orders` | `api.orders.mine` | (live test; dashboard is used in UI) |
| `GET /orders/:number?key=|email=` | `api.orders.get` | Order, Track |
| `POST /orders/:number/pay` | `api.orders.pay` | Order (complete payment) |
| `GET /payments/test/:id`, `POST /payments/test/:id/decide` | `api.orders.testPayment/decideTestPayment` | TEST payment page (dev) |
| `GET /games` | `api.games.list` | Play tab |
| `POST /games/:game/start` (catch, tree) | `api.games.start` | Catch, Tree |
| `POST /games/:game/finish` | `api.games.finish` | Catch, Tree |
| `POST /games/quiz/start`, `POST /games/quiz/answer` | `api.games.quizStart/quizAnswer` | Quiz |
| `GET /games/wheel`, `POST /games/wheel/spin` | `api.games.wheel/spin` | Wheel |
| `GET /games/mystery`, `POST /games/mystery/open` | `api.games.mystery/openMystery` | Mystery box |
| `GET /hidden`, `POST /hidden/:key/find` | `api.games.hidden/findHidden` | Hidden Wonders, glimmers |
| `GET /challenges/today`, `POST /challenges/:id/claim` | `api.games.challenges/claimChallenge` | Play tab |
| `GET /advent` | `api.calendar.get` | Calendar, Home |
| `POST /advent/claim` (`{ day, optionKey? }`, strict) | `api.calendar.claim` | Calendar day sheet |
| `GET /academy/houses`, `/sorting`, `/me`, `/shop`; `POST /academy/sort` | `api.academy.*` | Academy |
| `GET /wishes?limit&exclude`, `GET /wishes/recent?page`, `POST /wishes` | `api.wishes.*` | Home, Wishes |
| `GET /pioneer/status` | `api.pioneer.status` | Pioneer landing, Home |
| `GET /pioneer/offers` | `api.pioneer.offers` | Pioneer landing |
| `GET /pioneer/summary[?fresh=1]` | `api.pioneer.summary` | My Pioneer Card |
| `GET /pioneer/transactions?page` | `api.pioneer.transactions` | My Pioneer Card history |
| `GET /pioneer/rewards/:id/eligibility` | `api.pioneer.eligibility` | My Pioneer Card rewards |
| `POST /pioneer/link`, `DELETE /pioneer/link` | `api.pioneer.link/unlink` | My Pioneer Card |
| `POST /pioneer/offers/:id/redeem` (`{ requestId }`) | `api.pioneer.redeem` | RedeemSheet |
| `GET /pioneer/rewards` | `api.pioneer.catalog` | defined, not used (as on the website) |

Not used by the app: `/admin/*` (staff panel), `/payments/:provider/callback|return` (provider ↔ server only).

## Server additions for the app (backward compatible)

| Request | Behaviour |
|---|---|
| any request with `X-Christmas-Client: mobile` + `Authorization: Bearer <token>` | `req.user` is loaded from that session token (cookie still wins if present) |
| `POST /auth/login|register|password` with the app header | response body adds `session: { token, expiresAt }`; no `mc_session` cookie is set |
| guest cart writes with the app header | `X-Cart-Token` response header instead of the `mc_cart` cookie; read back from the `X-Cart-Token` request header |
| writes with the app header and no `Origin`/`Referer` | Origin check skipped (bearer auth, no ambient cookies). With any Origin, the normal allow-list applies. |

Covered by `server/test/mobile-auth.test.js`.
