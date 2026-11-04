# Magical Pioneer Card integration

Customers connect an existing **Magical Pioneer Card** to their store account under **Account → My Pioneer Card**.
The store never invents card validity, owners, balances or transactions: everything comes from the real
Pioneer system (`magical-full`, module `server/pioneer.js`).

| `PIONEER_MODE` | Behaviour |
|---|---|
| `disabled` (default) | Connecting is unavailable; the account shows "coming soon". Nothing is simulated. |
| `magical` | Uses the real Pioneer system at `PIONEER_API_BASE_URL` (needs `PIONEER_SESSION_KEY`). |

The former `http` (invented API contract) and `sandbox` (simulated cards) modes were removed.

## What the store calls (existing Pioneer endpoints only)
| Store action | Pioneer endpoint |
|---|---|
| Verify card number (8 digits) + verification code (3 digits) | `POST /api/pioneer/login {cardNumber, cvv}` → HttpOnly session cookie `mg_pioneer` |
| Card owner name, card number, **balance** | `GET /api/pioneer/me` |
| History (last 10) | `GET /api/pioneer/transactions?pageSize=10` |
| Available rewards | `GET /api/pioneer/rewards` |
| Announcements | `GET /api/pioneer/announcements` |
| End session on disconnect | `POST /api/pioneer/logout` (with `X-CSRF-Token` from `/me`) |

Failures are mapped to clear customer messages: wrong number/code (with "attempts left" from Pioneer),
inactive card, card locked, Pioneer busy (its per-IP limit), Pioneer unreachable.

## Rules enforced by the store backend
- A card is connected only after the Pioneer system accepts number + code; the code is passed through once and
  never stored or logged (`*.verificationCode` is redacted).
- One **active** connection per card and per account (partial unique indexes in migration `004`); a second
  account gets `409 card_taken` (checked after verification, so card numbers cannot be probed).
- Unknown request fields are refused (`.strict()`), so a client cannot send a balance or owner.
- Disconnecting requires `{confirm: true}`; staff disconnects require a reason. Every connect, re-verify,
  failed attempt, refusal and disconnect is written to `pioneer_link_events`.
- Rate limits: 8 card attempts per account and 30 per IP per 15 minutes in the store, plus the Pioneer
  system's own per-card lockout.

## Data the store keeps (`pioneer_links`)
User ↔ 8-digit card number (needed to re-verify; never sent to the browser — the UI gets `•••• 1234`),
cardholder name, last known balance + time, and the Pioneer cardholder session encrypted with
AES-256-GCM (`PIONEER_SESSION_KEY`, bound to account + card). The live balance is always re-read from Pioneer;
the stored one is shown only as "last checked …" when Pioneer cannot be asked.

## Still required before going live
1. **Deploy the Pioneer module to production.** The `magical-deploy/pioneer-card-2553f0a` package states it has not
   been applied to production yet. `PIONEER_API_BASE_URL` must point at a host where `POST /api/pioneer/login` works.
2. **Pioneer login rate limit (blocking).** The Pioneer system allows 15 card logins per 15 minutes and 60 per day
   **per IP**. Every verification from the store comes from the store server's IP, so the whole store shares that
   budget (customers then see "Pioneer is busy"). On the Pioneer side, either exempt the store server's IP from
   `pc-login-ip` / `pc-login-ip-day` (the per-card lockout still protects each card) or add a partner endpoint.
3. **Session length.** Pioneer cardholder sessions last `PIONEER_SESSION_TTL_HOURS` (default 4). After that the
   customer re-enters the 3-digit code to see the live balance. A read-only server-to-server endpoint
   (e.g. `GET /api/partner/cards/{number}` with an API key) would remove this step.
4. **Points earned in the store.** The Pioneer system has no endpoint to credit or debit points from another system,
   so Stardust earned in store games stays recorded in the store (`reward_grants`, status `pending`) and store offers
   cannot be paid with points. Adding Pioneer partner endpoints `credit` / `redeem` (idempotent by reference) would
   enable both; `services/rewards.js#syncPioneerPoints` already does idempotent, retried pushes once
   `supportsCredit` is true.
5. Generate `PIONEER_SESSION_KEY` once (64 hex) and keep it stable; changing it only forces customers to re-enter
   their code.

## Testing locally against the real code
Run `magical-full` with a **throwaway** database (never its real one), create test cards through its admin API
(`POST /api/admin/pioneer/cards` returns the CVV once), point `PIONEER_API_BASE_URL` at it, and run
`PIONEER_TEST_CARDS=cards.json npm test` (file: `[{ "number": "…", "cvv": "…", "expectedBalance": 200 }, …]`).
