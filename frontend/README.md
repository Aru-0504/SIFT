# SIFT Frontend

React + TypeScript + Vite + Tailwind dashboard for SIFT.

## Setup

```bash
cd frontend
npm install
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
npm run dev
```

Authentication is handled by the SIFT backend. The access token returned by
signup/signin is attached to every watchlist request as a Bearer token.

Runs on `http://localhost:5173` by default, expects the backend at
`http://localhost:8000` unless `VITE_API_URL` is overridden.

## Structure

```
src/api.ts            → fetch wrappers for the SIFT backend
src/types.ts          → TS types mirroring backend Pydantic schemas
src/components/
  Auth.tsx              → email/password sign in & sign up
  Dashboard.tsx         → main screen: watchlist + "changes since last visit"
  StockCard.tsx         → per-symbol card, significance-based visual hierarchy
  AddStock.tsx          → symbol input
```

`App.tsx` checks the backend access token and switches between `Auth` and
`Dashboard` accordingly — no separate router is needed for two states.

React Query handles polling (45s, matching the backend cache TTL), caching,
and loading/error states — deliberately chosen so staleness/error handling
didn't need to be hand-rolled, leaving more time for the significance logic
that's actually being evaluated.
