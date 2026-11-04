# Magical Christmas — Concept & Architecture

## 1. Creative concept: "The Midnight Snowglobe"

The site is not a shop with Christmas decoration on top. It is a **night-time winter village seen through
a snowglobe**, and every page is a place in that village:

| Place in the world        | Page / feature                         |
|---------------------------|----------------------------------------|
| The Lantern Gate          | First-visit welcome ritual             |
| The Village Square        | Homepage — a scroll-driven story in chapters |
| The Market Stalls         | Shop & categories                      |
| The Workshop Window       | Product detail                         |
| The Compass of Wishes     | Smart Gift Finder                      |
| The Clocktower Calendar   | Advent Calendar                        |
| The Frost Fair            | Games                                  |
| Frostspire Academy        | Original wizarding-school section      |
| The Pioneer Lodge         | Magical Pioneer Card VIP area          |
| The Sleigh                | Cart & checkout                        |
| Your Cottage              | Account dashboard                      |
| The Elves' Office         | Admin panel                            |

### Visual language
- **Palette tokens**: midnight `#0b1430` → deep `#060b1d`, ember red `#c8102e`, emerald `#0f6b4f`,
  lantern gold `#f2c46d`, snow `#f6f8ff`, frost `#a9c7ff`.
- **Type**: *Fraunces* (soft, characterful display serif), *Instrument Sans* (UI/body),
  *Pinyon Script* (letters, signatures, names). Armenian falls back to *Noto Serif Armenian*.
- **No generic cards**: products are **gift tags hung on a ribbon**, **shop-window arches**, and
  **ledger rows** depending on context; collections are **market stalls** with awnings; the nav is a
  **garland** (desktop) with bulbs that light on hover and a **lantern compass** radial menu (mobile).
- **Illustration**: every product ships with an original, procedurally drawn SVG illustration
  (`client/src/art`) so the store looks finished without stock photos. Uploaded photos override art.

### Motion system (`client/src/effects`)
- **One shared sky canvas** (snow in 3 depth layers, twinkling stars, drifting embers) driven by a single
  `requestAnimationFrame` loop. Particle budget scales by viewport, `hardwareConcurrency` and
  `deviceMemory`; the loop pauses when the tab is hidden.
- **Snow accumulation**: SVG snow caps on section edges that grow as the visitor stays.
- **Cursor magic**: sparkle trail only on `pointer: fine` devices.
- **Scroll storytelling**: GSAP ScrollTrigger (lazy-loaded) for chapter reveals and parallax.
- **Page & product transitions**: Framer Motion `AnimatePresence` + shared-layout "unwrap" when a gift tag
  opens into the product page.
- **3D**: a Three.js glass ornament in the hero, lazy-loaded only on capable, non-reduced-motion devices,
  with an SVG fallback.
- **Rewards**: a single `celebrate()` API (confetti of snowflakes/stars + toast) used by advent, games, sorting.
- **Accessibility**: `prefers-reduced-motion` and an in-app "Calm mode" toggle turn every continuous
  animation into static art; all interactive art has keyboard equivalents.
- Lottie: not used — no licensed Lottie files exist for this project; SVG/CSS covers the same needs with
  smaller payloads.

## 2. Technical architecture

```
christmas-market.am/
├─ server/                  Node 22 · Express · PostgreSQL (pg) · zod
│  ├─ migrations/           ordered SQL files, tracked in schema_migrations
│  ├─ scripts/              migrate · seed-demo · create-admin · backup
│  └─ src/
│     ├─ app.js             express app, security middleware, routers
│     ├─ config.js          validated env config
│     ├─ db.js              pool + withTransaction()
│     ├─ middleware/        auth, validate, rateLimit, errors, csrf-origin
│     ├─ services/          pricing, orders, rewards, gamesValidator, recommendations
│     ├─ integrations/
│     │   ├─ pioneer/       magicalClient (Magical Integration API v1) + disabled client
│     │   └─ payments/      PaymentProvider registry: cash, test, idram, ameriabank, arca, stripe
│     └─ routes/            REST routers (public, account, admin)
└─ client/                  React 18 · Vite · React Router · Framer Motion · GSAP · Three.js
   └─ src/
      ├─ api/               fetch wrapper (cookies, errors)
      ├─ state/             auth, cart, personalization, calm-mode contexts
      ├─ effects/           sky canvas, cursor, snow caps, celebrate, ornament3d
      ├─ art/               procedural product & scene illustrations (SVG)
      ├─ components/        garland nav, gift tag, stall, etc.
      ├─ pages/             one folder per place in the world
      └─ admin/             lazy-loaded admin bundle
```

### Security model
- Passwords: bcrypt (cost 12). Sessions: 256-bit random token in an `HttpOnly; SameSite=Lax; Secure(prod)`
  cookie, only its SHA-256 stored in `sessions` → revocable, nothing sensitive in JS.
- CSRF: SameSite cookies + Origin/Referer check on every mutating request.
- `helmet` (CSP), CORS allow-list, `express-rate-limit` (global, auth, games, pioneer tiers).
- All input validated with zod; all SQL parameterised; uploads restricted by magic bytes and size.
- Admin routes: `requireAuth` + `requireRole('admin')`, every admin write recorded in `audit_log`.
- Money: integers in AMD (no floats). Orders, stock, coupons and rewards change inside DB transactions with
  row locks (`SELECT … FOR UPDATE`).
- Games/rewards: the client never decides a reward. Server issues signed game sessions, checks duration and
  score plausibility, enforces daily caps, and picks wheel/mystery outcomes itself.
- Secrets (payment keys, Pioneer API key) live only in server env.

### Payments
`PaymentProvider` interface: `createPayment(order) → {redirectUrl|instructions}`, `handleCallback(req)`,
`verify(payment)`. Implemented:
- **cash_on_delivery** — real, no online charge.
- **test** — enabled only when `PAYMENTS_TEST_MODE=true`; orders are flagged `is_test`, the UI shows a
  TEST banner, and a manual "approve/decline" test page is used. Never presented as a real transaction.
- **idram, ameriabank (vPOS), arca, telcell, stripe** — adapters with configuration contracts; they report
  `configured: false` and are hidden from checkout until credentials are provided. Callback signature
  verification hooks are in place; the provider-specific request/response mapping must be completed against
  each provider's merchant documentation.

### Magical Pioneer Card integration
The store uses the official Magical Pioneer Card Integration API v1 (server-to-server, Bearer key):
- Without `MAGICAL_PIONEER_API_URL`/`MAGICAL_PIONEER_API_KEY` (or with `PIONEER_MODE=disabled`) the account shows "coming soon".
- Links are made with `POST /links` using the signed-in user's id; card, balance, transactions and rewards are read
  from `/customers/{id}/…`. Magical owns the links; `pioneer_links` (provider `magical_api`) is the local mirror and
  `pioneer_link_events` the event log.
Full details and the production checklist: `server/src/integrations/pioneer/README.md`.

Points earned in store games are recorded in `reward_grants` (`pioneer_sync_status=pending`); they are pushed to the
card only if the Pioneer system adds a credit endpoint (it has none today).

## 3. Database schema
See `server/migrations/001_init.sql` (authoritative). Main groups:
- **Identity**: users, sessions, user_profiles (personalization + magical identity), houses
- **Catalog**: categories, products, product_variants, product_images, reviews
- **Commerce**: carts, cart_items, wishlists, coupons, coupon_redemptions, shipping_zones, orders,
  order_items, order_status_history, payments
- **Experiences**: advent_doors, advent_openings, game_sessions, quiz_questions, wheel_segments,
  mystery_rewards, hidden_objects, hidden_finds, challenges, challenge_completions, reward_grants,
  achievements, user_achievements, reward_rules
- **Pioneer**: pioneer_links, pioneer_offers, pioneer_redemptions
- **Marketing & content**: campaigns, banners, content_blocks, newsletter_subscribers, christmas_events
- **Ops**: audit_log, analytics_events, schema_migrations
- Demo rows carry `is_demo = true` and are removed with `npm run seed:demo -- --clean`.

## 4. REST API (prefix `/api/v1`)
Auth: `POST /auth/register|login|logout`, `GET /auth/me`
Personalization: `GET|PUT /me/profile`, `GET /me/recommendations`, `GET /me/dashboard`
Catalog: `GET /categories`, `GET /products`, `GET /products/:slug`, `POST /products/:slug/reviews`,
`POST /gift-finder`
Wishlist: `GET /wishlist`, `POST|DELETE /wishlist/:productId`
Cart: `GET /cart`, `POST /cart/items`, `PATCH|DELETE /cart/items/:id`, `POST|DELETE /cart/coupon`
Checkout: `GET /checkout/options`, `POST /checkout/quote`, `POST /orders`, `POST /orders/:number/pay`,
`GET /orders`, `GET /orders/:number`, `GET /orders/track?number=&email=`
Payments: `POST /payments/:provider/callback`, `GET /payments/test/:id`, `POST /payments/test/:id/decide`
Pioneer: `GET /pioneer/status`, `POST|DELETE /pioneer/link`, `GET /pioneer/summary`, `GET /pioneer/transactions`, `GET /pioneer/rewards`, `GET /pioneer/rewards/:id/eligibility`,
`GET /pioneer/offers`, `POST /pioneer/offers/:id/redeem`
Academy: `GET /academy/houses`, `GET /academy/sorting`, `POST /academy/sort`, `GET /academy/me`
Advent: `GET /advent`, `POST /advent/:day/open`
Games: `GET /games`, `POST /games/:game/start`, `POST /games/:game/finish`, `GET /games/quiz`,
`POST /games/quiz/answer`, `POST /games/wheel/spin`, `POST /games/mystery/open`,
`POST /hidden/:key/find`, `GET /challenges/today`, `POST /challenges/:id/claim`
Content: `GET /content/home`, `POST /newsletter`, `POST /analytics`
Admin (`/admin/*`, role admin): products, variants, images upload, categories, orders, customers, coupons,
campaigns, banners, advent, challenges, quiz, wheel, mystery, reward-rules, content, reviews, events,
pioneer links, analytics.
