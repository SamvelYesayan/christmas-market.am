# Magical Pioneer Card integration

The store never invents card validity or balances. All card data comes from a `PioneerClient`:

| `PIONEER_MODE` | Behaviour |
|---|---|
| `disabled` (default) | Linking is unavailable; the UI shows the lodge as "opening soon". |
| `http` | `httpClient.js` calls the real Pioneer API with `PIONEER_API_KEY` (server-side only). |
| `sandbox` | Dev-only card system (refused when `NODE_ENV=production`), labelled SANDBOX in API and UI. Cards: 12 digits starting `9999`, verification code `1225`. |

## What the real API must expose
Paths are configurable (`PIONEER_PATH_*`, `{cardId}` is substituted). Auth: `Authorization: Bearer <key>`.
Write calls send `Idempotency-Key: <reference>`; the API must treat repeats as no-ops.

| Operation | Default route | Request | Expected response |
|---|---|---|---|
| verify | `POST /cards/verify` | `{cardCode, verificationCode}` | `{cardId, maskedNumber?, tier?, holderName?}`; 404/422 when invalid |
| balance | `GET /cards/{cardId}/balance` | – | `{points, tier?}` |
| history | `GET /cards/{cardId}/transactions` | – | `[{id, date, type, points, description}]` or `{items:[…]}` |
| credit | `POST /cards/{cardId}/credit` | `{points, reference, description}` | `{balance?}` |
| redeem | `POST /cards/{cardId}/redeem` | `{points, reference, description}` | `{balance?}`; 409 `{error:"insufficient_points"}` |

If the real API differs, only `httpClient.js` needs to change.

## Data we store
`pioneer_links`: user ↔ `external_card_id`, masked number, tier, status. The verification code is never stored or
logged (the logger redacts it). Stardust earned in games is recorded in `reward_grants` and pushed with
`creditPoints` using the grant id as the idempotency reference; failures stay `pioneer_sync_status = failed`
and are retried by the background sync and on the next card link.
