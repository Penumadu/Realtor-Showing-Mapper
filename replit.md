# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.
This is the **Showings Route Mapper** — a real-estate agent tool that geocodes property addresses, optimises the driving route (nearest-neighbour TSP + OSRM), displays an interactive Leaflet map, and produces a timed itinerary. Routes can be shared via a unique URL, sent by SMS or email.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React 19 + Vite 7 + Tailwind 4 + Leaflet (`artifacts/route-mapper`)
- **API framework**: Express 5 (`artifacts/api-server`)
- **Validation**: Zod (via `lib/api-zod`)
- **API codegen**: Orval (OpenAPI → React Query hooks + Zod schemas)
- **Build**: esbuild bundle for api-server; Vite static build for frontend
- **Geocoding**: Nominatim (primary) → Photon/komoot (fallback)
- **Routing**: OSRM public router for polyline + travel times
- **Route sharing**: in-memory UUID store on the API server

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Vercel Deployment

Three files configure Vercel deployment:

| File | Purpose |
|------|---------|
| `vercel.json` | Install/build commands, output dir, rewrites, function settings |
| `api/index.ts` | Vercel serverless function — re-exports the Express app |
| `artifacts/route-mapper/vite.config.ts` | PORT & BASE_PATH are optional (default `3000` / `/`) |

**Steps to deploy on Vercel:**
1. Push the repo to GitHub / GitLab
2. Import the repo in the [Vercel dashboard](https://vercel.com/new)
3. Vercel auto-detects `vercel.json` — no extra configuration needed
4. Click **Deploy**

**Notes:**
- The `api/` serverless function is compiled by Vercel's Node.js runtime; no manual esbuild step needed
- Shared routes (in-memory store) reset on cold starts — acceptable for a demo / MVP
- All external APIs (Nominatim, Photon, OSRM) are public and require no keys
- Replit-specific Vite plugins (`runtime-error-modal`, `cartographer`, `dev-banner`) are guarded by `REPL_ID` env var and are never loaded on Vercel

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
