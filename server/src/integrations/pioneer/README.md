# Magical Pioneer Card — Christmas Store integration

Customers connect an existing Magical Pioneer Card in **Account → My Pioneer Card**. The store talks to the
official **Magical Pioneer Card Integration API v1** (server-to-server). Magical is the source of truth for card
links, balances, transactions and rewards; the store never invents or changes any of them.

Files: `magicalClient.js` (HTTP client), `index.js` (configuration + startup key check),
`../../routes/pioneer.js` (customer routes), `../../services/pioneer.js` (local link mirror),
`../../routes/admin/pioneer.js` (admin view). API contract: `magical-full/docs/PIONEER_CARD_API.md`.

## Configuration (`server/.env`, never committed)

| Variable | Value |
|---|---|
| `MAGICAL_PIONEER_API_URL` | `https://magical.am/api/integration/v1` (local Magical: `http://127.0.0.1:3000/api/integration/v1`). https is required in production. |
| `MAGICAL_PIONEER_API_KEY` | The `mgpc_…` key issued by Magical (`npm run integration -- create-key --name christmas-store --out <file>` on the Magical server). Needs scopes `cards:verify`, `cards:link`, `cards:read`, `rewards:read`. |
| `MAGICAL_PIONEER_TIMEOUT_MS` | Optional, default `10000`. |
| `PIONEER_MODE` | `auto` (default: on when URL and key are set) or `disabled`. |

On startup the server calls `GET /me` and logs either `Magical Pioneer API key OK (client "christmas-store", …)` or a
clear reason (invalid/revoked key, missing scopes, timeout, unreachable). It never crashes because Magical is down,
and it never prints the key. Admins see the same result under **Pioneer Card → Card connections** ("Check now"
re-runs it).

### Local development
1. Run Magical locally (`npm run server` in `magical-full`, port 3000) against a **development** database, and
   create a key there with `npm run integration -- create-key --name christmas-store --out <file>`.
2. Put `MAGICAL_PIONEER_API_URL=http://127.0.0.1:3000/api/integration/v1` and the key in `server/.env`.
3. `npm run dev`. Without a key the account shows "Card connection is coming soon".

## Magical endpoints used

| Store action | Magical endpoint |
|---|---|
| Startup / admin key check | `GET /me` |
| Connect a card (customer id from the session + card number + CVV) | `POST /links` |
| Card details and authoritative balance | `GET /customers/{id}/card` |
| History (20 per page, paged) | `GET /customers/{id}/transactions?page=&pageSize=20` |
| Reward catalog (public Pioneer page) | `GET /rewards` |
| Rewards with this card's eligibility | `GET /customers/{id}/rewards` |
| One reward's eligibility | `GET /customers/{id}/rewards/{rewardId}/eligibility` |
| Disconnect (customer or admin) | `DELETE /customers/{id}/link` |
| Card check without linking (client method, not used by the UI) | `POST /cards/verify` |

`{id}` is always the Christmas Store user id of the signed-in customer (UUID), never a value from the browser.
Reads are cached for at most 5 seconds per customer and never used for payments.

## Customer flow
1. Signed-in customer opens **My Pioneer Card** → **Connect Pioneer Card**.
2. Enters the 8-digit card number and the 3-digit security code; the store validates the format.
3. The store backend calls `POST /links` with the customer's own id. On success it records a local mirror row
   (`pioneer_links`: masked number, holder name, last seen balance — no card number, no CVV) and shows the
   card, live balance, transactions and rewards.
4. **Disconnect** asks for confirmation, calls `DELETE /customers/{id}/link`, then marks the local row unlinked (kept as history).
   If Magical unlinks a card on its side, the store notices on the next visit and updates its record.

## Error handling

| Magical code | Customer sees (HTTP / store code) |
|---|---|
| `invalid_card_credentials` | "The card number or security code is incorrect." + attempts left (400 `invalid_card`) |
| `card_already_linked` | "This Pioneer Card is already connected to another account." (409 `card_taken`) |
| `customer_already_linked` | "A Pioneer Card is already connected to your account." (409 `already_linked`; the existing card is then shown) |
| `card_inactive` | "This Pioneer Card is inactive." (400) |
| `too_many_attempts` | "Too many attempts. Please try again later." (429, `retryAfter`) |
| `card_locked` | "This card is locked … contact Magical support." (429) |
| `validation_failed` | "Please check the card number and security code." (400) |
| `rate_limited` | "The Pioneer Card service is busy …" (503 `pioneer_busy`, `retryAfter`) |
| `invalid_api_key`, `insufficient_scope`, `https_required`, `browser_requests_not_allowed` | Neutral "temporarily unavailable" (503 `pioneer_config`); details only in the server log, without the key |
| `server_error`, timeout, unreachable, unknown | "temporarily unavailable" (503 `pioneer_upstream`) |

If Magical is unavailable the dashboard still shows the last seen balance, clearly marked as not live.

## Security rules
- API key: server environment only; sent only in the `Authorization` header; not an enumerable property of the
  client object; redacted from logs; never in responses, the database, docs or Git.
- CVV and full card number: forwarded once to Magical, never stored, cached, logged or kept in a session
  (log redaction covers `cvv`, `cardNumber`, `verificationCode`).
- Requests go only from the backend (Node `fetch`, no `Origin` header, 10 s timeout).
- Link/verify attempts are rate limited per account and per IP in the store, on top of Magical's per-card lockout.

## Not supported by Magical API v1 (deliberately not implemented)
Spending points, earning/crediting points, paying for orders with points and redeeming rewards through the store.
`supportsCredit`/`supportsRedeem` stay `false`: Stardust earned in store games stays in the store, store offers
cannot be paid with points (`POST /pioneer/offers/:id/redeem` answers 501), and normal payment methods are unchanged.

## Data model
`pioneer_links` rows with `provider = 'magical_api'` mirror active Magical links (`external_card_id = customer:<user id>`).
Older rows from earlier integrations (`sandbox`, `magical`) are kept untouched as history. No migration was needed
for v1; the old encrypted-session columns stay but are no longer used.

## Tests
`npm test` (server) runs, without any real key:
- `test/pioneer-client.test.js` — client against an in-memory Magical mock (key check, invalid key, verify, link,
  every error code, rate limits, card/transactions/rewards/eligibility, unlink, timeout, outage).
- `test/pioneer-integration.test.js` — a real store server process against the mock: full customer flow, error
  mapping, outage/timeout, revoked key, unlinking (both sides), and checks that CVVs, keys and card numbers are not
  in the logs or the database.
