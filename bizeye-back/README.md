# BizEye Back

Hono + TypeScript API for BizEye.

The backend removes the frontend dependency on `VITE_YOUTUBE_API_KEY`, centralizes YouTube channel/live resolution, and stores cache/session/state in Supabase Postgres.

## Stack

- Runtime: Node.js 20.19+ or 22.12+
- API framework: Hono
- Deploy target: Vercel project with Root Directory `bizeye-back`
- Database: Supabase Postgres
- Migrations: `supabase/migrations`

## Vercel Project

- Root Directory: `bizeye-back`
- Install Command: `npm ci`
- Build Command: none
- Serverless entrypoint: `api/index.ts`

## Cron

`vercel.json` uses a daily cron schedule because Vercel Hobby projects do not allow cron jobs more frequent than once per day. The intended live validation cadence is 10 minutes, but that requires either Vercel Pro or an external scheduler calling `GET /internal/cron/live-check` with the `CRON_SECRET` bearer token.

## Supabase Project

Configure project URL, ref, service-role key, and API keys through local `.env.local` or the hosting provider environment settings. Do not commit project IDs, service-role keys, API keys, or database passwords.

## Migrations

The migrations folder is:

```text
C:\Users\Admin\Documents\Projects\BizEye\bizeye-back\supabase\migrations
```

Initial migration:

```text
supabase/migrations/202606130001_init.sql
```

## Local Setup

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

The dev server listens on `http://localhost:3000` by default.

## Docker Compose

From the repository root:

```powershell
docker compose up --build
```

This starts:

- `db`: local Postgres on `localhost:54322`
- `migrate`: one-shot migration runner for `supabase/migrations/*.sql`
- `bizeye-back`: Hono API on `http://localhost:3000`
- `bizeye-front`: Vite app on `http://localhost:5190`

Run migrations manually:

```powershell
docker compose run --rm migrate
```

The local compose database is plain Postgres, not the full Supabase local stack. It is enough for schema, cache/session tables, and backend integration work that uses Postgres directly. Hosted Supabase remains the target production database.

## Environment

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_REF=
DATABASE_URL=
YOUTUBE_API_KEY=
BIZEYE_FRONTEND_ORIGIN=
SESSION_COOKIE_NAME=
CRON_SECRET=
```

Use `SUPABASE_SERVICE_ROLE_KEY` only in this backend. Never expose it to `bizeye-front`.

## Current Endpoints

- `GET /health`
- `GET /ready`
- `GET /internal/cron/live-check`
- `GET /youtube/channels/search`
- `POST /youtube/channels/resolve`
- `GET /youtube/channels/:channelId/live`

The YouTube endpoints are scaffolded and return `501` until the resolver service is implemented.
