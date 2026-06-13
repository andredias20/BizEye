# BizEye

## Português

BizEye é uma aplicação React + TypeScript + Vite para organizar cards de lives em um painel de visualização. A proposta é facilitar o acompanhamento de vários criadores ao mesmo tempo, com uma tela `Watch` dedicada para exibir embeds ativos sem rolagem.

### Recursos principais

- Dashboard de streams com suporte a YouTube, Twitch e Kick.
- Página inicial com criadores sugeridos e busca de canais do YouTube.
- Modal para adicionar canais por URL, handle ou ID.
- Tela `Watch` com modos de layout para priorizar equilíbrio, largura, altura, mais colunas ou mais linhas.
- Persistência local das streams e do layout escolhido via `localStorage`.

### Requisitos

- Node.js 20.19+ ou 22.12+.
- npm.

### Configuração local

Instale as dependências:

```powershell
npm ci
```

Inicie o servidor de desenvolvimento:

```powershell
npm run dev -- --host 127.0.0.1
```

O Vite exibirá a URL local no terminal. Se a porta `5173` já estiver em uso, outra porta disponível será escolhida automaticamente.

Para habilitar a busca de canais do YouTube, configure a variável de ambiente abaixo em um arquivo `.env` local:

```text
VITE_YOUTUBE_API_KEY=sua_chave_aqui
```

### Comandos básicos

```powershell
npm ci                         # instala as dependências
npm run dev                    # inicia o Vite em modo desenvolvimento
npm run lint                   # executa o ESLint
npm run build                  # gera o build de produção
npm run preview                # abre uma prévia local do build
```

### Validação

```powershell
npm run lint
npm run build
```

## English

BizEye is a React + TypeScript + Vite application for organizing live-stream cards in a viewing dashboard. Its goal is to make it easier to monitor multiple creators at the same time, with a dedicated `Watch` screen for active embeds without scrolling.

### Main features

- Stream dashboard with YouTube, Twitch, and Kick support.
- Home page with suggested creators and YouTube channel search.
- Modal for adding channels by URL, handle, or ID.
- `Watch` screen with layout modes that prioritize balance, width, height, more columns, or more rows.
- Local persistence for selected streams and the chosen layout through `localStorage`.

### Requirements

- Node.js 20.19+ or 22.12+.
- npm.

### Local setup

Install dependencies:

```powershell
npm ci
```

Start the development server:

```powershell
npm run dev -- --host 127.0.0.1
```

Vite will print the local URL in the terminal. If port `5173` is already in use, Vite will automatically choose another available port.

To enable YouTube channel search, set the following environment variable in a local `.env` file:

```text
VITE_YOUTUBE_API_KEY=your_key_here
```

### Basic commands

```powershell
npm ci                         # install dependencies
npm run dev                    # start Vite in development mode
npm run lint                   # run ESLint
npm run build                  # create a production build
npm run preview                # preview the production build locally
```

### Validation

```powershell
npm run lint
npm run build
```
