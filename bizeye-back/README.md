# BizEye Back

Hono + TypeScript API for BizEye.

The backend removes the frontend dependency on `VITE_YOUTUBE_API_KEY`, centralizes YouTube channel/live resolution, and stores cache/session/state in Postgres. Production uses Supabase through `supabase-js`; local/Codex development can use a direct Postgres driver plus deterministic YouTube fixtures.

## Stack

- Runtime: Node.js 20.19+ or 22.12+
- API framework: Hono
- Deploy target: Vercel project with Root Directory `bizeye-back`
- Production database: Supabase Postgres
- Local database: Compose Postgres on `localhost:54322`
- Migrations: `supabase/migrations`

## Local Setup

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

The default `.env.example` is prepared for local work:

```text
BIZEYE_DB_DRIVER=postgres
DATABASE_URL=postgresql://bizeye:bizeye_dev_password@localhost:54322/bizeye
YOUTUBE_API_MODE=mock
```

Start only Postgres and migrations from the repository root:

```powershell
npm run dev:db
```

Then run the backend locally:

```powershell
npm run dev:back
```

## Docker Compose

From the repository root:

```powershell
npm run dev:stack
```

The command starts the containers in the background. To follow logs:

```powershell
npm run dev:stack:logs
```

This starts:

- `db`: local Postgres on `localhost:54322`
- `migrate`: one-shot migration runner for `supabase/migrations/*.sql`
- `bizeye-back`: Hono API on `http://localhost:3000`
- `bizeye-front`: Vite app on `http://localhost:5190`

The Compose stack uses `BIZEYE_DB_DRIVER=postgres`, `YOUTUBE_API_MODE=mock`, and `VITE_FEATURE_BIZEYE_RESOLVE=true`, so it runs without Supabase service keys or a real YouTube API key.

Run migrations manually:

```powershell
npm run docker:migrate
```

Reset the local database volume:

```powershell
npm run docker:reset
```

## Debugging

Run the full stack with Node Inspector exposed:

```powershell
npm run dev:stack:debug
```

Backend debug port:

```text
127.0.0.1:9229
```

Use `.vscode/launch.json` configuration `BizEye Back: attach Docker/Codex` to attach to the Docker backend process. For local backend debugging without Docker, use:

```powershell
npm run dev:back:debug
```

## Environment

Local/Codex:

```text
BIZEYE_DB_DRIVER=postgres
DATABASE_URL=postgresql://bizeye:bizeye_dev_password@localhost:54322/bizeye
YOUTUBE_API_MODE=mock
```

Production/Vercel:

```text
BIZEYE_DB_DRIVER=supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
YOUTUBE_API_MODE=live
YOUTUBE_API_KEY=
```

Use `SUPABASE_SERVICE_ROLE_KEY` only in this backend. Never expose it to `bizeye-front`.

## Vercel Project

- Root Directory: `bizeye-back`
- Install Command: `npm ci`
- Build Command: none
- Serverless entrypoint: `api/index.ts`

## Cron

`vercel.json` uses a daily cron schedule because Vercel Hobby projects do not allow cron jobs more frequent than once per day. The intended live validation cadence is 10 minutes, but that requires either Vercel Pro or an external scheduler calling `GET /internal/cron/live-check` with the `CRON_SECRET` bearer token.

## Endpoints

- `GET /`
- `GET /health`
- `GET /ready`
- `GET /internal/cron/live-check`
- `GET /youtube/channels/search?q=ACF`
- `POST /youtube/channels/resolve`
- `POST /youtube/channels/live-status`
- `GET /youtube/channels/:channelId/live`
- `POST /youtube/channels/:channelId/live`
