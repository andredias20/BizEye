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
npm run dev:stack
```

O comando sobe os containers em background. Para acompanhar logs:

```powershell
npm run dev:stack:logs
```

Serviços locais:

- Frontend: `http://localhost:5190`
- Backend: `http://localhost:3000`
- Postgres: `localhost:54322`

O serviço `migrate` aplica as migrations em:

```text
bizeye-back/supabase/migrations
```

Por padrão, o Compose usa `BIZEYE_DB_DRIVER=postgres`, `YOUTUBE_API_MODE=mock` e `VITE_FEATURE_BIZEYE_RESOLVE=true`. Isso permite rodar front, backend e banco sem `SUPABASE_SERVICE_ROLE_KEY` nem chave real do YouTube.

Para depurar o backend com Node Inspector:

```powershell
npm run dev:stack:debug
```

Porta de debug: `127.0.0.1:9229`.

### Comandos

```powershell
npm run dev:db
npm run dev:front
npm run dev:back
npm run dev:back:debug
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
npm run dev:stack
```

The command starts the containers in the background. To follow logs:

```powershell
npm run dev:stack:logs
```

Local services:

- Frontend: `http://localhost:5190`
- Backend: `http://localhost:3000`
- Postgres: `localhost:54322`

The `migrate` service applies migrations from:

```text
bizeye-back/supabase/migrations
```

By default, Compose uses `BIZEYE_DB_DRIVER=postgres`, `YOUTUBE_API_MODE=mock`, and `VITE_FEATURE_BIZEYE_RESOLVE=true`. This lets the frontend, backend, and database run without `SUPABASE_SERVICE_ROLE_KEY` or a real YouTube API key.

To debug the backend with Node Inspector:

```powershell
npm run dev:stack:debug
```

Debug port: `127.0.0.1:9229`.

### Commands

```powershell
npm run dev:db
npm run dev:front
npm run dev:back
npm run dev:back:debug
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
