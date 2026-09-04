# SIFT Frontend

React + TypeScript + Vite + Tailwind dashboard for SIFT.

## Setup

```bash
cd frontend
npm install
cp .env.example .env      # set VITE_API_BASE_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run dev
```

The Supabase URL and anon key are the *public* project values (Project
Settings > API), safe to ship in frontend code — they identify the project,
they don't grant privileged access. Auth is email/password via Supabase
Auth; the access token from the session is attached to every backend
request as a Bearer token (see `src/api.ts`).

Runs on `http://localhost:5173` by default, expects the backend at
`http://localhost:8000` unless `VITE_API_BASE_URL` is overridden.

## Structure

```
src/api.ts            → fetch wrappers for the SIFT backend
src/types.ts          → TS types mirroring backend Pydantic schemas
src/supabaseClient.ts  → Supabase client singleton
src/components/
  Auth.tsx              → email/password sign in & sign up
  Dashboard.tsx         → main screen: watchlist + "changes since last visit"
  StockCard.tsx         → per-symbol card, significance-based visual hierarchy
  AddStock.tsx          → symbol input
```

`App.tsx` tracks the Supabase session and switches between `Auth` and
`Dashboard` accordingly — no separate router needed for two states.

React Query handles polling (45s, matching the backend cache TTL), caching,
and loading/error states — deliberately chosen so staleness/error handling
didn't need to be hand-rolled, leaving more time for the significance logic
that's actually being evaluated.
