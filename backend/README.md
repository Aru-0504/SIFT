# SIFT Backend

FastAPI service for SIFT (Stock Insight Filtering & Tracking).

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # fill in DATABASE_URL and SUPABASE_JWT_SECRET
uvicorn app.main:app --reload --port 8000
```

Set `APP_ENV=production` and `CORS_ORIGINS` to the deployed frontend origin
before deployment. Keep `DATABASE_URL` empty for local SQLite development; for
production, use the current Supabase connection string from the dashboard.

Run the backend contract tests from the `backend` directory:

```bash
pytest
```

Local dev without Supabase Postgres: leave `DATABASE_URL` empty or unset in
`.env` and it falls back to a local `sift_dev.db` SQLite file automatically —
useful for testing the watchlist/significance logic before wiring up Postgres. Auth
still requires a real Supabase project either way, since token verification
needs the project's actual JWT secret.

For Supabase Postgres, copy the current connection string from the project's
Database settings. Do not reuse a stale `db.<project-ref>.supabase.co` host if
DNS does not resolve it; Supabase may provide a pooler hostname instead. URL-
encode special characters in the database password before placing the URL in
`.env`.

## Authentication

Every `/watchlist/*` endpoint requires a valid Supabase-issued access token
as a Bearer token (`Authorization: Bearer <token>`). The backend verifies
the token's signature locally using `SUPABASE_JWT_SECRET` (Project Settings
> API > JWT Secret) — no network call to Supabase is made per-request, so
auth verification doesn't add latency or an extra point of failure. The
user's id is taken from the token's `sub` claim, so it lines up exactly with
`auth.users.id` in Supabase.

API docs (auto-generated): `http://localhost:8000/docs`

## Architecture

```
routers/watchlist.py      → HTTP layer, request/response only
services/watchlist_service.py → checkpoint diffing, orchestration
services/significance.py  → "meaningful change" calculation
market_data/base.py       → MarketDataProvider interface (Quote, exceptions)
market_data/twelve_data_provider.py → live data via Twelve Data
market_data/cache.py      → shared TTL cache + last-known-good fallback
models.py / schemas.py    → SQLAlchemy models / Pydantic contracts
```

The service layer only depends on `MarketDataProvider` (the interface), never
on `TwelveDataProvider` directly — swapping data sources means writing one new
class, not touching business logic.

## Key design decisions

- **Checkpoint-based diffing, not global "market movers".** Every user has a
  `last_seen_price` per symbol (`user_checkpoints`). "What changed" is always
  relative to what *that user* last saw, not a generic feed.
- **Checkpoints only advance on explicit `/watchlist/ack`.** A page refresh
  or `GET /watchlist` never silently erases the diff being shown — only an
  explicit acknowledgment does.
- **Significance is relative to a stock's own volatility**, not a flat
  percentage threshold. See `services/significance.py`.
- **Cache is shared per-symbol, not per-user.** 500 users watching the same
  stock costs one upstream call, not 500 — this is the scalability answer.
- **Staleness is explicit, never hidden.** Every quote carries `is_stale` and
  `stale_reason`. If the live provider fails and no cache exists, the API
  returns a clear per-symbol error state rather than fabricating a number or
  failing the entire watchlist.
- **Real Supabase Auth, verified locally.** Tokens are checked against the
  project's JWT secret in-process (`app/auth.py`), not by calling out to
  Supabase on every request — keeps auth fast and doesn't couple every
  watchlist read to Supabase's own availability.

## What we deliberately did not build

- Microservices, message queues, Kubernetes — no scaling need exists yet to
  justify the operational complexity.
- Redis — the in-memory TTL cache is correct for a single backend process;
  Redis is the obvious next step if this runs across multiple processes.
- Multiple watchlists per user, personalized threshold sliders, portfolio/
  brokerage features — out of scope for the core thesis ("what changed since
  I last looked"), noted as future work.
