# BizEye Codex Instructions

## Project

BizEye is a React + TypeScript + Vite app for managing embedded live-stream cards.

## Setup

- Use Node.js 20.19+ or 22.12+.
- Install dependencies with `npm ci`.
- Worktree setup is automated through `.codex/environments/environment.toml`, which runs `.codex/setup-worktree.ps1`.

## Common Commands

- Install and validate a fresh worktree: `powershell -NoProfile -ExecutionPolicy Bypass -File .\.codex\setup-worktree.ps1`
- Start dev server: `npm run dev -- --host 127.0.0.1`
- Lint: `npm run lint`
- Build: `npm run build`

## Validation

Before finishing code changes, run:

```powershell
npm run lint
npm run build
```

For UI changes, also open the Vite URL that the dev server prints and verify the changed flow in a browser.
