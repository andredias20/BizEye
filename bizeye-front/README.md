# BizEye

React + TypeScript + Vite app for keeping multiple live-stream embeds visible in one dashboard.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Local Setup

```powershell
npm ci
npm run dev -- --host 127.0.0.1
```

Vite prints the local URL in the terminal. If another worktree is already using port `5173`, Vite will choose the next available port.

## Feature Flags

The frontend reads the Vercel boolean flag `bizeye-resolve` through the serverless endpoint `api/flags.ts`.

- `bizeye-resolve=true`: YouTube channel search, channel resolution, and live lookup use `VITE_RESOLVER_BASE_URL`.
- `bizeye-resolve=false`: those flows fall back to direct Google APIs through `VITE_YOUTUBE_API_KEY`.
- Local Vite dev uses `VITE_FEATURE_BIZEYE_RESOLVE` as the fallback value because Vite does not run Vercel Functions.
- For local testing, override the value in the browser with `localStorage.setItem('bizeye-resolve', 'true')` or remove the key to use the environment/default value again.

## YouTube Live Resolution

The base Watch list is fixed to ACF, Tonimec, and EEBrasil. On page load/F5, the frontend asks the backend for cached live status for active YouTube channel IDs.

- Fresh `channelId -> videoId` cache is used without calling the YouTube API.
- Expired live cache is validated by the backend before being reused.
- If there is no usable cache, the player first tries the `live_stream?channel=` embed and records a discovered `videoId` when the IFrame API exposes one.
- If the channel embed fails, the backend falls back to YouTube API discovery and returns the active `videoId`.

## Codex Worktrees

This repo includes a Codex local environment at:

```text
.codex/environments/environment.toml
```

When creating a Codex worktree, select the `BizEye` local environment. The setup script runs:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\.codex\setup-worktree.ps1
```

That script validates Node/npm, installs dependencies with `npm ci`, and runs an initial production build.

Codex actions configured for this project:

- `Dev`: starts Vite on `127.0.0.1`, defaulting to port `5173`.
- `Lint`: runs `npm run lint`.
- `Build`: runs `npm run build`.

## Scripts

```powershell
npm run dev
npm run lint
npm run build
npm run preview
```

Use `npm run lint` and `npm run build` before finishing changes.
