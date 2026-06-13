# BizEye Codex Instructions

## Project

BizEye is organized as a two-project repository:

- `bizeye-front`: React + TypeScript + Vite app for managing embedded live-stream cards.
- `bizeye-back`: Hono + TypeScript API for resolving YouTube channels/lives, hiding the YouTube API key, and using Supabase Postgres for cache/session/state.

## Setup

- Use Node.js 20.19+ or 22.12+.
- Frontend dependencies live under `bizeye-front`.
- Backend dependencies live under `bizeye-back`.
- Supabase SQL migrations live under `bizeye-back/supabase/migrations`.

## Common Commands

Frontend:

```powershell
cd .\bizeye-front
npm ci
npm run dev -- --host 127.0.0.1
npm run lint
npm run build
```

Backend:

```powershell
cd .\bizeye-back
npm ci
npm run dev
npm run build
```

Root helpers:

```powershell
npm run dev:front
npm run dev:back
npm run build:front
npm run build:back
```

## Validation

Before finishing frontend code changes, run:

```powershell
cd .\bizeye-front
npm run lint
npm run build
```

Before finishing backend code changes, run:

```powershell
cd .\bizeye-back
npm run build
```

For UI changes, also open the Vite URL that the dev server prints and verify the changed flow in a browser.

