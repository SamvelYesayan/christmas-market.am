# Christmas Market — *The Midnight Snowglobe*

An immersive Christmas e-commerce universe for **christmas-market.am**: a real store (catalog, cart, checkout,
orders, admin) told as a night-time winter village — with a personalised welcome ritual, Frostspire Academy
(an original wizarding-school world), the Magical Pioneer Card lodge, an Advent clocktower, games and rewards.

- **Frontend:** React 18 · Vite · React Router · Framer Motion · GSAP · Three.js (lazy) · hand-written CSS
- **Backend:** Node 22 · Express · PostgreSQL · zod · bcrypt · pino
- **Concept, architecture, schema and endpoint list:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Pioneer Card integration contract:** [`server/src/integrations/pioneer/README.md`](server/src/integrations/pioneer/README.md)

### Language, intro and music
- **Armenian (hy) is the default language** for every first-time visitor; English is secondary. The switcher
  («Հայ / Eng») is in the top bar (and in the mobile compass menu). The choice is stored in `localStorage`
  and an `mc_lang` cookie, and is sent as `X-Locale` on every API call.
- UI strings live in `client/src/i18n/hy.js` and `en.js` (same keys); admin phrases in `client/src/admin/i18n.js`.
- **Database content is bilingual**: translatable tables have an `i18n` JSONB overlay (`{"hy": {...}}`) on top of
  the English base columns. Seeds ship complete Armenian content (`server/scripts/translations-hy.js`); admins edit it
  in every section ("Armenian translation (JSON)") and in the product editor's "Armenian content" card.
  Server-generated messages and errors are translated in `server/src/i18n/index.js`.
- **Cinematic Santa intro** (`client/src/effects/SantaIntro.jsx`): original SVG Santa, sleigh and reindeer crossing
  a night sky, then a snow burst and golden reveal. Full version (~8s) on the first visit, a short version (~4s) on
  later visits, at most once per browser session and never on in-app navigation. «Բաց թողնել» skips it (Esc too).
  It is skipped for reduced-motion/calm mode and when landing directly on cart, checkout, orders or sign-in.
  Visitors can choose full / short / off in the footer or account settings. Sound (sleigh bells and a
  a real, human-recorded Santa "Ho ho ho" timed to the sleigh crossing) only plays after the visitor presses
  «Միացնել ձայնը». The laugh is a CC0 studio recording by Joseph Sardin (BigSoundBank #2075); source and
  licence are recorded in `client/public/audio/CREDITS.md`. No synthetic or AI-generated voice is used.
- **Christmas music player** (nav, persistent across pages): play/pause, previous/next, mute, volume,
  playlist, live visualizer and automatic advance. It never autoplays: music starts only after a click
  («Միացնել ամանորյա երաժշտությունը»), and volume, mute and track are remembered.
  **Licensing:** no recordings are embedded. Tracks are public-domain melodies (Jingle Bells, We Wish You a Merry
  Christmas, Deck the Halls, Silent Night, Joy to the World), arranged by us and synthesized live with Web Audio
  (`client/src/effects/songs.js`, `audio.js`), plus an original waltz. To use licensed studio recordings
  later, add them as audio files you hold the rights to and extend the engine.

---

## 1. Quick start (development)

Requirements: Node 22+, PostgreSQL 14+ (local install or Docker).

```bash
npm install                                  # installs server + client workspaces
cp server/.env.example server/.env           # then edit DATABASE_URL etc.
```

### Database
Pick one:

- **Docker:** `docker compose up -d` and set
  `DATABASE_URL=postgres://christmas:christmas@localhost:5433/christmas_market`.
- **A throwaway cluster from an installed PostgreSQL** (what this repo was developed with; trust auth on localhost only):
  ```bash
  initdb -D .devdb -U christmas --auth=trust -E UTF8 --locale=C
  pg_ctl -D .devdb -o "-p 5433" -l .devdb/server.log start
  createdb -h localhost -p 5433 -U christmas christmas_market
  ```
  `DATABASE_URL=postgres://christmas@localhost:5433/christmas_market`

### Migrate, seed, run
```bash
npm run db:migrate        # applies server/migrations/*.sql
npm run db:seed:demo      # reference data + DEMO catalog/content (flagged is_demo)
npm run dev               # API on :4000, web on :5173 (proxied /api)
```
Open http://localhost:5173.

**Demo accounts** (created by `seed:demo`, development only):

| Role | Email | Password |
|---|---|---|
| Customer | `demo@christmas-market.test` | `snowflake-demo-2026` |
| Admin | `elf@christmas-market.test` | `north-pole-office-2026` |

Admin panel: http://localhost:5173/admin

**Development switches in `server/.env`:**
- `PAYMENTS_TEST_MODE=true` → a clearly labelled **TEST** payment method with an approve/decline page.
  Test orders are flagged `is_test`, show a TEST banner and are excluded from revenue analytics.
- `PIONEER_MODE=magical` + `PIONEER_API_BASE_URL` + `PIONEER_SESSION_KEY` → connect to the real Magical Pioneer Card system.
  For local testing run `magical-full` against a throwaway database (see the Pioneer integration README).
- `ADVENT_DATE_OVERRIDE=2026-12-08` → pretend it is that date so December doors can be opened (ignored in production).

---

## 2. Data: base vs demo

| Script | What it writes | Safe in production |
|---|---|---|
| `npm run db:seed` | Houses, categories, shipping zones, games, reward rules, achievements, hidden objects, default homepage texts | ✅ idempotent |
| `npm run db:seed:demo` | Products, reviews, Advent doors, quiz, wheel, mystery box, challenges, campaigns, banners, events, Pioneer offers, demo users | ❌ refuses unless `--force` |
| `npm run db:seed:demo -- --clean` | Removes every `is_demo` row (and wheel/mystery rows) | — |

All demo rows carry `is_demo = true`.

## 3. Creating an admin (production)
```bash
npm run admin:create -- --email you@company.am --name "Head Elf"
```
The password is asked interactively (hidden), or read from `ADMIN_PASSWORD` for automated provisioning.
Existing users with that email are promoted to admin. Admins can promote/demote others in **Customers**.

## 4. Environment variables
Everything is documented in [`server/.env.example`](server/.env.example). Key ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `DATABASE_SSL` | PostgreSQL connection |
| `APP_ORIGIN` | Allowed browser origin(s), comma-separated (CORS + CSRF origin check) |
| `PUBLIC_API_URL` | Public URL of the API (used in payment return URLs) |
| `TRUST_PROXY` | `1` behind one reverse proxy so rate limits see real IPs |
| `PAYMENTS_TEST_MODE` | Enables the TEST payment method (forced off in production) |
| `IDRAM_*`, `AMERIA_*`, `ARCA_*`, `STRIPE_*`, `TELCELL_*` | Payment provider credentials — a method appears at checkout only when configured |
| `PIONEER_MODE`, `PIONEER_API_BASE_URL`, `PIONEER_SESSION_KEY`, `PIONEER_PORTAL_URL` | Magical Pioneer Card connection |
| `PIONEER_DISCOUNT_PERCENT` | Automatic member discount (default 5) |
| `STORE_TIMEZONE` | Day boundaries for Advent, daily games and challenges (default Asia/Yerevan) |

Secrets live only in the server environment; the client bundle never contains keys.

## 5. Payments
- **Cash/card on delivery** — always available.
- **Idram, Ameriabank vPOS, ArCa, Stripe** — adapters implemented in `server/src/integrations/payments/`.
  They follow each provider's published flow (form post / redirect → server-side verification or signed callback).
  **Before going live, run each against the provider's test environment** and confirm field names, amounts
  (AMD vs minor units) and signature formats with your merchant documentation.
- **Telcell** — configuration contract only; never offered until implemented.
- Success is only recorded from a provider confirmation (callback or server-side verify). Amount mismatches are
  rejected. Unpaid online orders release their stock after 60 minutes.
- Callback URLs: `POST {PUBLIC_API_URL}/api/v1/payments/{provider}/callback`; return URLs
  `GET …/payments/{provider}/return?payment=…`.

## 6. Magical Pioneer Card
Customers connect their existing card in **Account → My Pioneer Card** with the 8-digit card number and 3-digit
verification code. The store verifies them with the real Pioneer system (`magical-full`) and then shows the
cardholder name, masked number, live points balance, rewards, announcements and history read from it. A card can be
connected to one account only; disconnecting asks for confirmation. Admins see connections (read-only) under
**Pioneer Card → Card connections**; points can only be changed in the Pioneer admin.

With `PIONEER_MODE=disabled` (default) the section shows "coming soon" — nothing is simulated.
**Before going live** (details in the integration README): deploy the Pioneer module, exempt the store server from the
Pioneer per-IP login limit (15 per 15 min / 60 per day), and set `PIONEER_MODE=magical`, `PIONEER_API_BASE_URL`
(https) and `PIONEER_SESSION_KEY`. Stardust earned in the store stays in the store until the Pioneer system offers a
credit endpoint.

## 7. Tests
With the API running against demo data (test mode + sandbox + an Advent date override in December):
```bash
npm test
```
15 end-to-end API tests cover origin checks, auth, admin protection, cart/stock, coupons, COD and TEST checkout,
order tracking privacy, Advent locking, wheel daily limit, catch-game anti-cheat, quiz answer secrecy,
Pioneer sandbox linking, sorting, dashboard and admin writes (including image upload validation).

## 8. Deployment
One Node process serves the API and the built client (single origin, so cookies stay first-party).

```bash
npm ci
npm run build                      # client → client/dist
NODE_ENV=production npm run db:migrate
NODE_ENV=production npm run db:seed
npm run admin:create -- --email …
NODE_ENV=production npm start      # serves /api, /uploads and the SPA
```
Production checklist:
- Run behind HTTPS (nginx/Caddy/Render/Fly) with `TRUST_PROXY=1`; cookies become `Secure` automatically.
- `APP_ORIGIN` and `PUBLIC_API_URL` = your public https origin. `PAYMENTS_TEST_MODE=false`, `PIONEER_API_BASE_URL` uses https
  (the server refuses to start with the sandbox in production).
- Persist `server/uploads/` (or mount object storage there) — product photos live there.
- Background jobs (expiring unpaid orders, Pioneer sync, session cleanup) run in-process; with multiple instances,
  run them in one instance or move them to a scheduler.
- Use a process manager (systemd/pm2/container restart policy). Logs are JSON (pino) on stdout.

### Backups
```bash
npm run backup -w server     # pg_dump custom format → ./backups, keeps the newest 14 (BACKUP_KEEP)
```
Schedule it daily (cron / Task Scheduler), copy `backups/` and `server/uploads/` off-site, and test a restore
regularly: `pg_restore --clean --no-owner -d "$DATABASE_URL" backups/christmas-….dump`. Managed PostgreSQL
providers' point-in-time recovery is a good complement.

## 9. Security summary
bcrypt (cost 12) passwords · random session tokens in HttpOnly SameSite cookies (only hashes stored, revocable) ·
Origin/Referer check on all writes · helmet CSP · rate limits (global, auth, games, Pioneer, writes) · zod validation
on every input · parameterised SQL · transactions with row locks for orders, stock, coupons and rewards ·
server-decided game outcomes with plausibility checks and daily caps · upload magic-byte checks · admin audit log ·
sensitive fields redacted from logs.

## 10. Known gaps / next steps
- **Transactional email** (order confirmations, password reset) is not wired — add an SMTP/ESP provider.
- **Pioneer Card production setup** — see §6 (Pioneer per-IP login limit, credit/redeem endpoints).
- **Russian translation** — Armenian (default) and English are complete.
- **Lottie** is not used (no licensed Lottie files); SVG/CSS/Canvas/Three.js cover the motion design.
- Payment adapters need verification against each provider's sandbox before launch (see §5).
- Product photos: demo products use original procedural SVG illustrations; upload real photos in the admin.
- Legal texts in `/info/*` are placeholders for reviewed copy.
