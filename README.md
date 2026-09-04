# SIFT — Stock Insight Filtering & Tracking

## Problem

A normal watchlist shows the current state of the market. It has no memory
of the user. Every time someone opens the app, they have to manually scan
every price and mentally work out what's actually different from the last
time they looked, and whether it's worth their attention. That comparison
work should belong to the product, not the user.

## Solution

SIFT is a watchlist with memory. It stores a checkpoint of what each user
last saw for every symbol they track, and on each visit computes what's
different — filtering that down to changes that are actually meaningful,
not just changes that exist.

"Meaningful" is defined relative to a stock's own recent volatility, not a
flat global percentage: a 2% move on a historically stable stock is unusual;
the same 2% on a volatile one is normal. The system never claims to know
*why* something moved — only that a detectable, quantified signal occurred —
which is the appropriate level of confidence for a financial product.

SIFT is a context-aware stock watchlist built around one question: what
changed since I last looked? Instead of showing raw prices, SIFT stores a
per-user checkpoint for every tracked symbol and, on each visit, computes
price movement relative to that stock's own recent volatility — so
significance is contextual, not a flat threshold. A shared per-symbol cache
keeps the system efficient as watchlists and users grow, and a provider
abstraction with an explicit staleness flag means the product is always
honest about how fresh its data is, even when the underlying market feed is
delayed or unavailable.

## System architecture

```
              React + TS (Vite) — Auth + Dashboard
                              │
                    Bearer <supabase_access_token>
                              │ REST (HTTPS)
                              ▼
                          FastAPI
                    (verifies JWT locally
                     against Supabase JWT secret)
              ┌───────────────┼───────────────┐
      Watchlist Service  Significance    Market Data
      (CRUD, checkpoint    Engine        Service
       diffing)                        (adapter pattern)
              │                               │
              ▼                               ▼
        PostgreSQL (Supabase)         MarketDataProvider (interface)
        - watchlist_items                    │
        - user_checkpoints            ┌──────┴──────┐
        - detected_changes      TwelveDataProvider CachedFallbackProvider
                (live data)      (shared TTL cache +
                                                    last-known-good fallback)

        The backend issues the access token the frontend attaches to every
        request and verifies it locally, so auth adds no per-request network
        dependency.
```

### Why this shape

- **Single service, not microservices** — nothing here needs independent
  scaling or deployment yet; splitting now would be complexity without
  justification.
- **Cache is per-symbol, shared across users** — the answer to "how does
  this scale for larger watchlists and more users": upstream calls scale
  with unique symbols watched, not with user count.
- **Provider is an interface, not a hard dependency** — this is the direct
  answer to "how do you handle stale, delayed or conflicting data." Swapping
  or stacking providers (real → cached fallback → eventually a second real
  provider for redundancy) never touches the checkpoint/significance logic.
- **Checkpoints advance only on explicit acknowledgment** — refreshing the
  page must never silently erase the diff being shown to the user.

## What we deliberately did not build

Multiple watchlists, personalized threshold sliders, portfolio/brokerage
features, Redis, microservices. Each is a reasonable next step, not a gap we
missed — see the backend README for the reasoning behind each.

## Repo structure

```
SIFT/
├── backend/     FastAPI service — see backend/README.md
├── frontend/    React + TS dashboard — see frontend/README.md
└── README.md    this file
```

## Running locally

1. `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload`
2. `cd frontend && npm install && npm run dev`
3. Open `http://localhost:5173`

See each subfolder's README for environment variables and deployment notes.
