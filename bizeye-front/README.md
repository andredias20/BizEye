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

The frontend reads Vercel flags through the serverless endpoint `api/flags.ts`.

- `bizeye-resolve=true`: YouTube live lookup and observation use `VITE_RESOLVER_BASE_URL`.
- `bizeye-resolve=false`: backend YouTube resolution is disabled; the frontend does not call Google APIs directly.
- `bizeye-chat-merge=true`: Watch opens the merged chat panel for streams with chat identifiers.
- `bizeye-chat-merge=false`: the merged chat panel stays hidden.
- `bizeye-chat-transport=sse`: Watch uses `EventSource` against `/stream/chat/merge/stream`.
- `bizeye-chat-transport=websocket`: Watch uses the local WebSocket route `/stream/chat/merge/ws`.
- Local Vite dev uses `VITE_FEATURE_BIZEYE_RESOLVE` as the fallback value because Vite does not run Vercel Functions.
- For local testing, override the values in the browser with `localStorage.setItem('bizeye-resolve', 'true')`, `localStorage.setItem('bizeye-chat-merge', 'true')`, and `localStorage.setItem('bizeye-chat-transport', 'websocket')`, or remove the keys to use the environment/default values again.

## Recommended Streams

The Home recommendations and first-run Watch list are loaded from the backend route `GET /recommended-lives` when `VITE_RESOLVER_BASE_URL` is configured. The frontend keeps a local fallback with the original starter streams so the app remains usable if the backend is unavailable.

The backend returns only public rendering fields. Admin management is available at `#/admin/login` and `#/admin/lives`, backed by HTTP-only cookie sessions.

## YouTube Live Resolution

On page load/F5, the frontend asks the backend for cached live status for active YouTube channel IDs.

- Fresh `channelId -> videoId` cache is used without calling the YouTube API.
- Expired live cache is validated by the backend before being reused.
- If there is no usable cache, the player first tries the `live_stream?channel=` embed and records a discovered `videoId` when the IFrame API exposes one.
- If the channel embed fails, the backend falls back to YouTube API discovery and returns the active `videoId`.
- When chat merge is enabled, the Watch page sends `{ platform, identifier }` sources to `/stream/chat/merge/stream` or `/stream/chat/merge/ws`, according to `bizeye-chat-transport`, and renders individual chat messages from the backend queue.
- Kick cards can be added as `username` for normal lookup, or as `username|chatroomId` when Kick blocks backend chatroom lookup but the numeric chatroom id was captured from the browser Network tab.

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
