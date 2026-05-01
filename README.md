# Expense Tracker

A small full-stack personal expense tracker. Backend is an Express + SQLite API; the frontend is a Vite + React app.

## Repo layout

```
backend/   Express API (TypeScript), SQLite via better-sqlite3, vitest
frontend/  React + Vite app (TypeScript)
```

## Running locally

Two terminals:

```bash
# Terminal 1 — API on http://localhost:4000
cd backend
npm install
npm run dev

# Terminal 2 — UI on http://localhost:5173
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/expenses` and `/health` to the API, so the UI works out of the box with no extra config.

For a production build:

```bash
cd backend  && npm run build && npm start          # serves API
cd frontend && npm run build && npm run preview    # serves built UI
```

Set `VITE_API_BASE` at frontend build time to point at a non-proxied API origin (e.g. `https://api.example.com`).

## API

| Method | Path                       | Notes                                          |
|--------|----------------------------|------------------------------------------------|
| POST   | `/expenses`                | Create. Honours `Idempotency-Key` header.      |
| GET    | `/expenses`                | List. Optional `?category=` and `?sort=date_desc\|date_asc`. Returns `{ expenses, total, count }`. |
| GET    | `/expenses/:id`            | Fetch one.                                     |
| GET    | `/expenses/categories`     | Distinct categories present in the DB.         |
| GET    | `/health`                  | Liveness check.                                |

`POST /expenses` body:

```json
{ "amount": "123.45", "category": "Food", "description": "Lunch", "date": "2026-04-30" }
```

Amounts are decimal **strings** in rupees with up to 2 fractional digits. The server stores them as integer paise.

### Idempotency

To make retries safe, the client sends a `Idempotency-Key: <uuid>` header on `POST /expenses`. The server records the key plus its response on first write, in the same DB transaction as the insert. On a replay it returns the cached response with `Idempotent-Replay: true`. So a double-click, network retry, or page reload mid-submit will never create duplicates.

The frontend generates one key per pending submission and rotates it after success.

## Design notes

**Money.** Stored as integer paise in a SQLite `INTEGER` column. JSON exposes amounts as decimal strings (`"123.45"`) so the wire format never depends on JS `Number` precision. Conversion is in [backend/src/lib/money.ts](backend/src/lib/money.ts) and round-trip-tested.

**Persistence.** SQLite via `better-sqlite3`. It is a real DB with transactions, indexes, and constraints — closer to production behaviour than an in-memory map or JSON file — while staying a single-file dependency. WAL mode is on. The schema is declared idempotently at boot; for a real product I'd swap this for a migrations tool.

**Idempotency at the data layer.** The idempotency key write happens inside the same transaction as the expense insert, so partial failures can't desync the two. The route also handles the race where two concurrent retries with the same key arrive — whichever loses the unique-constraint replay reads the cached response.

**Server-authoritative totals.** The list endpoint returns `total` summed in paise on the server. The UI re-fetches when filters change rather than computing totals client-side, so the displayed total is always consistent with the rows shown.

**Validation.** Zod at the route boundary; amounts are then run through the money parser which enforces `≤ 2` fractional digits and a positive value. Dates must be `YYYY-MM-DD`. The frontend mirrors the basic checks for fast feedback but treats the server as the source of truth.

**Retries.** The frontend retries `GET` requests with exponential backoff on 5xx / network errors, but never retries `POST`s on 4xx. POSTs are protected by the idempotency key instead, so a retry on transient failure is safe.

**UX.** Loading state on initial fetch, a quieter "refreshing" indicator on subsequent fetches, optimistic insert after a successful create (then reconciled with the server), inline error with a Retry button. The submit button is disabled while a request is in flight.

## Trade-offs / things deliberately skipped

- **No auth, no users.** Single-user assumption — adding auth was outside scope.
- **No edit / delete endpoints.** The acceptance criteria didn't ask for them and they would have doubled the surface area.
- **No idempotency-key TTL/cleanup job.** In production these rows should expire (24h is typical).
- **No frontend tests.** Backend has vitest coverage of the contract (validation, idempotency, totals, sort, filter); for the UI I relied on manual testing within the timebox.
- **No pagination.** Fine for a personal tracker; would be a `LIMIT/OFFSET` or cursor change when needed.
- **Categories are free text** with autocomplete from past entries, not a fixed enum. The simpler choice; trivial to constrain later.
- **Currency is INR only.** No multi-currency support; amounts are rendered with `₹`.
- **Styling is intentionally plain CSS** — no Tailwind, no UI kit. Focus was on correctness.

## Tests

```bash
cd backend && npm test
```

Covers money round-tripping, validation (negatives, zero, malformed dates), idempotency replay, category filter + total, and sort order.
