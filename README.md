# BizEye

## Português

BizEye é um monorepo para organizar cards de lives no frontend e mover a resolução/cache de dados do YouTube para um backend próprio.

### Estrutura

```text
BizEye/
  bizeye-front/  React + TypeScript + Vite
  bizeye-back/   Hono + TypeScript API
```

### Recursos principais

- Dashboard de streams com suporte a YouTube, Twitch e Kick.
- Tela `Watch` para exibir embeds ativos sem rolagem.
- Backend resolver para busca de canais, cache de resoluções e futuras validações de live.
- Supabase Postgres como base para cache, sessões administrativas e histórico de chamadas.
- Docker Compose local com Postgres, migrations, backend e frontend.

### Requisitos

- Node.js 20.19+ ou 22.12+.
- npm.
- Docker Desktop para o ambiente local completo.

### Configuração local

Instale as dependências do projeto desejado:

```powershell
cd bizeye-front
npm ci

cd ..\bizeye-back
npm ci
```

Use os arquivos `.env.example` como referência para criar os `.env.local`. Arquivos locais de ambiente são ignorados pelo Git.

### Docker Compose

Suba a stack completa a partir da raiz:

```powershell
docker compose up --build
```

Serviços locais:

- Frontend: `http://localhost:5190`
- Backend: `http://localhost:3000`
- Postgres: `localhost:54322`

O serviço `migrate` aplica as migrations em:

```text
bizeye-back/supabase/migrations
```

### Comandos

```powershell
npm run dev:front
npm run dev:back
npm run build:front
npm run build:back
```

### Deploy

Use um único repositório GitHub com dois projetos na Vercel:

- Frontend
  - Root Directory: `bizeye-front`
  - Build Command: `npm run build`
  - Output Directory: `dist`

- Backend
  - Root Directory: `bizeye-back`
  - Framework: Hono
  - Banco/cache/sessões: Supabase Postgres

Não commite chaves, tokens, project IDs sensíveis, service-role keys ou `.env.local`.

## English

BizEye is a monorepo for organizing live-stream cards in the frontend while moving YouTube resolving/cache work to a dedicated backend.

### Structure

```text
BizEye/
  bizeye-front/  React + TypeScript + Vite
  bizeye-back/   Hono + TypeScript API
```

### Main Features

- Stream dashboard with YouTube, Twitch, and Kick support.
- `Watch` screen for active embeds without scrolling.
- Resolver backend for channel search, resolution cache, and future live validation.
- Supabase Postgres for cache, admin sessions, and API-call history.
- Local Docker Compose with Postgres, migrations, backend, and frontend.

### Requirements

- Node.js 20.19+ or 22.12+.
- npm.
- Docker Desktop for the full local stack.

### Local Setup

Install dependencies for the project you want to run:

```powershell
cd bizeye-front
npm ci

cd ..\bizeye-back
npm ci
```

Use `.env.example` files as the reference for local `.env.local` files. Local env files are ignored by Git.

### Docker Compose

Start the full stack from the repository root:

```powershell
docker compose up --build
```

Local services:

- Frontend: `http://localhost:5190`
- Backend: `http://localhost:3000`
- Postgres: `localhost:54322`

The `migrate` service applies migrations from:

```text
bizeye-back/supabase/migrations
```

### Commands

```powershell
npm run dev:front
npm run dev:back
npm run build:front
npm run build:back
```

### Deploy

Use one GitHub repository with two Vercel projects:

- Frontend
  - Root Directory: `bizeye-front`
  - Build Command: `npm run build`
  - Output Directory: `dist`

- Backend
  - Root Directory: `bizeye-back`
  - Framework: Hono
  - Database/cache/sessions: Supabase Postgres

Do not commit keys, tokens, sensitive project IDs, service-role keys, or `.env.local`.
