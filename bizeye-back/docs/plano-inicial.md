# BizEye-Resolver - plano inicial

## Resumo

O plano e viavel e faz sentido para o BizEye. Hoje o frontend chama o YouTube Data API diretamente em pelo menos tres pontos: busca de canais na Home, resolucao de URL/handle no modal de adicionar stream e fallback de live no player. Isso expoe `VITE_YOUTUBE_API_KEY`, espalha regra de resolucao pelo React e dificulta cache, quota, logs e controle de acesso.

O BizEye-Resolver deve ser um backend pequeno, dedicado ao BizEye, que guarda a chave do YouTube no servidor, resolve canais/lives, aplica cache e limita os endpoints que consomem quota ao administrador autenticado.

## Fontes oficiais consultadas

- YouTube `search.list`: https://developers.google.com/youtube/v3/docs/search/list
- YouTube `channels.list`: https://developers.google.com/youtube/v3/docs/channels/list
- YouTube `videos.list`: https://developers.google.com/youtube/v3/docs/videos/list
- YouTube quota e auditoria: https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits
- YouTube API Services Developer Policies: https://developers.google.com/youtube/terms/developer-policies
- Google API key restrictions e boas praticas: https://docs.cloud.google.com/docs/authentication/api-keys e https://docs.cloud.google.com/docs/authentication/api-keys-best-practices

## Diagnostico do BizEye atual

Arquivos relevantes no BizEye:

- `src/pages/HomePage.tsx`: busca canais via `search.list` usando `VITE_YOUTUBE_API_KEY`.
- `src/components/AddStreamModal.tsx`: resolve URL, `@handle`, nome e `UC...` no frontend; usa `channels.list?forHandle=...` e fallback para `search.list`.
- `src/components/players/YouTubePlayer.tsx`: quando o embed por `channelId` falha, faz `search.list` com `eventType=live` para encontrar o `videoId`.

Problemas atuais:

- chave de API exposta no bundle Vite;
- regras de YouTube espalhadas pela UI;
- sem controle de quota ou rate limit;
- sem cache compartilhado;
- sem auditoria de erros/quota;
- cada cliente pode repetir buscas iguais;
- fallback de live so acontece apos erro do player, nao por uma regra previsivel.

## Arquitetura recomendada

Primeira versao:

- Runtime: Node.js 20.19+ ou 22.12+.
- Linguagem: TypeScript.
- Framework API: Hono.
- Validacao de entrada: Zod.
- HTTP client: `undici`/`fetch` nativo, usando header `x-goog-api-key` em vez de query string.
- Storage inicial: Supabase Postgres.
- Acesso a dados: Supabase JS no backend, com migrations SQL versionadas.
- Auth: sessao server-side com cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- Hash de senha: Argon2id.
- Logs: Pino com request id.
- Testes: Vitest para servicos e rotas.

Deploy recomendado para o MVP:

- Vercel para o projeto `bizeye-back`;
- Supabase Postgres como storage duravel externo;
- Vercel Cron para o job de validacao de live;
- HTTPS na borda;
- mesma origem ou reverse proxy para expor a API ao BizEye como `/resolver`.

Evitar no MVP:

- storage local em filesystem, porque Vercel Functions sao stateless;
- Redis obrigatorio logo no inicio, porque Supabase Postgres resolve cache, sessoes e auditoria do MVP;
- OAuth YouTube, porque as features propostas usam dados publicos e API key de servidor e mais simples. OAuth so deve entrar se surgirem features em nome de uma conta YouTube.

## Escopo funcional

### 1. Busca de canais por string

Endpoint admin:

```http
GET /youtube/channels/search?q=<texto>&limit=6
```

Comportamento:

- normaliza a query;
- consulta cache de busca por `youtube:channel-search:<hash(query,limit)>`;
- se cache valido existir, retorna sem chamar YouTube;
- se nao existir, chama `search.list` com `part=snippet`, `type=channel`, `maxResults`;
- salva resultado com TTL curto/medio, por exemplo 12h;
- registra custo estimado de quota.

Critica: esta feature e a mais sensivel a quota. A documentacao atual separa `search.list` como uma cota diaria pequena de 100 chamadas por dia, alem do controle geral. Portanto, busca livre por texto deve ser admin-only e cacheada agressivamente.

### 2. Resolucao de entrada para channelId

Endpoint admin:

```http
POST /youtube/channels/resolve
Content-Type: application/json

{ "input": "@canal | UC... | youtube.com/@canal | youtube.com/channel/UC... | nome" }
```

Ordem recomendada:

1. se for `UC...`, validar formato e retornar direto;
2. se for URL `/channel/UC...`, extrair direto;
3. se for `@handle`, chamar `channels.list` com `forHandle`, que custa pouco e evita busca textual;
4. se for custom URL/nome sem handle confiavel, usar `search.list` como fallback;
5. salvar `channels` localmente com `channelId`, `title`, `handle`, `thumbnail`, `lastFetchedAt`.

### 3. Cache KV channelId -> videoId

Endpoint admin para resolver live:

```http
GET /youtube/channels/:channelId/live
```

Resposta sugerida:

```json
{
  "channelId": "UC...",
  "videoId": "abc123",
  "status": "live",
  "source": "cache|youtube|stale-cache",
  "checkedAt": "2026-06-13T00:00:00.000Z",
  "expiresAt": "2026-06-13T00:01:15.000Z"
}
```

Modelo de cache:

- `live_resolutions.channel_id`
- `live_resolutions.video_id`
- `live_resolutions.status`: `live`, `offline`, `unknown`, `quota_limited`, `error`
- `live_resolutions.checked_at`
- `live_resolutions.expires_at`
- `live_resolutions.last_live_at`
- `live_resolutions.next_discovery_at`
- `live_resolutions.failure_count`

Regras:

- se `channelId -> videoId` estiver valido, retornar cache;
- se expirado e a chamada for admin/autorizada, validar ou redescobrir;
- se nao houver live, gravar cache negativo (`offline`) por 1 a 5 minutos;
- nao armazenar audio/video/conteudo audiovisual, apenas identificadores e metadados minimos.

### 4. Validacao de live a cada minuto

Processo interno:

- a cada 60s, selecionar somente canais ativos/monitorados;
- agrupar `videoId`s conhecidos e chamar `videos.list` com `part=snippet,liveStreamingDetails,status`;
- considerar live ativa quando:
  - `snippet.liveBroadcastContent` indica `live`, ou
  - `liveStreamingDetails.actualStartTime` existe e `actualEndTime` nao existe;
- se continuar live, atualizar `checked_at` e `expires_at`;
- se terminou, esta indisponivel ou deixou de ser live, chamar `search.list` com `channelId`, `type=video`, `eventType=live`, `maxResults=1`;
- se encontrar novo `videoId`, substituir cache;
- se nao encontrar, marcar `offline` e aplicar backoff.

Critica importante: "a cada um minuto" deve valer para lives ja conhecidas/ativas. Nao e uma boa ideia rodar descoberta por `search.list` a cada minuto para todos os canais offline, porque isso consome quota rapidamente. Para offline, usar backoff progressivo e refresh manual/admin.

### 5. Monitoramento por uso real

Para nao validar canais que ninguem esta vendo:

```http
POST /youtube/monitors/heartbeat
Content-Type: application/json

{ "channelIds": ["UC..."], "screen": "watch" }
```

Regra:

- o BizEye envia heartbeat a cada 30-60s enquanto a Watch esta aberta;
- o resolver considera ativo apenas canal com `last_seen_client_at` recente, por exemplo ultimos 3 minutos;
- o scheduler valida somente esses canais e os favoritos fixados pelo admin.

Isso reduz quota e evita trabalho inutil.

## Autenticacao e seguranca

O login oculto na UI e aceitavel como detalhe de experiencia, mas nao e seguranca. A protecao real precisa estar no backend.

Plano recomendado:

- rota escondida no BizEye, por exemplo uma combinacao de gesto/atalho ou path nao destacado;
- `POST /auth/login` com email/senha do admin;
- senha nunca em env em texto puro depois do bootstrap; usar hash Argon2id no banco;
- sessao em cookie `HttpOnly`, `Secure`, `SameSite=Lax`, com token aleatorio armazenado hashado no banco;
- `POST /auth/logout`;
- `GET /auth/me`;
- rate limit em `/auth/login`;
- lockout temporario apos tentativas falhas;
- CORS restrito ao dominio do BizEye;
- endpoints que chamam YouTube exigem admin autenticado;
- endpoints publicos, se existirem, so podem ler cache ja existente e nunca acionar chamada ao YouTube.

Segredos:

- `YOUTUBE_API_KEY` apenas no backend;
- usar restricao de API para YouTube Data API;
- usar restricao de aplicacao por IP do servidor quando o deploy permitir;
- separar chaves de desenvolvimento e producao;
- rotacionar chave se ela ja foi exposta publicamente.

## Endpoints propostos

Auth:

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

YouTube admin:

- `GET /youtube/channels/search?q=&limit=`
- `POST /youtube/channels/resolve`
- `GET /youtube/channels/:channelId/live`
- `POST /youtube/channels/:channelId/refresh`
- `POST /youtube/monitors/heartbeat`

Interno/operacional:

- `GET /health`
- `GET /ready`
- `GET /admin/quota` para resumo local de chamadas feitas
- `GET /admin/cache` para inspecao controlada

Opcional publico:

- `GET /public/youtube/channels/:channelId/live-cache`

Esse endpoint publico, se existir, deve retornar apenas cache e nunca chamar YouTube. Caso contrario, ele vira um proxy publico de quota.

## Modelo de dados inicial

```sql
admin_users (
  id text primary key,
  email text unique not null,
  password_hash text not null,
  created_at text not null,
  updated_at text not null
);

sessions (
  id text primary key,
  admin_user_id text not null,
  token_hash text not null,
  expires_at text not null,
  created_at text not null,
  revoked_at text
);

channels (
  channel_id text primary key,
  title text,
  handle text,
  thumbnail_url text,
  last_fetched_at text,
  created_at text not null,
  updated_at text not null
);

live_resolutions (
  channel_id text primary key,
  video_id text,
  status text not null,
  checked_at text,
  expires_at text,
  last_live_at text,
  next_discovery_at text,
  failure_count integer not null default 0,
  updated_at text not null
);

api_cache (
  key text primary key,
  value_json text not null,
  expires_at text not null,
  created_at text not null,
  updated_at text not null
);

youtube_api_calls (
  id text primary key,
  endpoint text not null,
  quota_bucket text,
  estimated_cost integer not null,
  status_code integer,
  created_at text not null
);
```

## Integracao com o BizEye

Mudancas futuras no frontend:

- substituir `VITE_YOUTUBE_API_KEY` por `VITE_RESOLVER_BASE_URL` ou usar path relativo `/resolver`;
- mover `resolveYoutubeId` do `AddStreamModal.tsx` para chamadas ao resolver;
- mover busca da Home para `GET /youtube/channels/search`;
- no `YouTubePlayer.tsx`, preferir `videoId` resolvido pelo backend;
- quando o stream salvo for `channelId`, pedir ao resolver o `videoId` atual antes de renderizar;
- enviar heartbeat da Watch para manter validacao ativa.

Contrato esperado para cards:

- armazenar no BizEye o `channelId` como identidade estavel do canal;
- usar `videoId` como estado resolvido/transiente para o embed atual;
- quando o resolver informar `offline`, mostrar card com estado "sem live ativa" ou manter fallback para embed por canal, dependendo da decisao de UX.

## Riscos e criticas

1. Busca textual consome a quota mais delicada.
   Mitigacao: admin-only, cache por query, debounce no frontend, limite pequeno de resultados e fallback para handle/UC ID.

2. Validar todos os canais a cada minuto nao escala.
   Mitigacao: validar apenas lives ativas e canais com heartbeat recente; usar batch em `videos.list`; usar backoff para offline.

3. Login oculto pode dar falsa sensacao de seguranca.
   Mitigacao: autenticacao server-side real, cookies seguros, rate limit, CORS restrito e endpoints publicos sem efeito colateral.

4. Backend nao pode virar API publica de YouTube.
   Mitigacao: escopo dedicado ao BizEye, auth admin para chamadas que consomem quota e endpoint publico apenas de leitura de cache se realmente necessario.

5. Cache precisa respeitar as politicas do YouTube.
   Mitigacao: armazenar identificadores/metadados minimos, nao armazenar conteudo audiovisual, usar TTLs, permitir purga e revisar politicas antes de producao.

6. Cron serverless pode ter limitacoes de plano e concorrencia.
   Mitigacao: usar Supabase Postgres como estado duravel, proteger o cron com `CRON_SECRET`, manter o job idempotente e revisar o plano da Vercel se precisar de execucao a cada minuto em producao.

7. Chave exposta anteriormente pode continuar em risco.
   Mitigacao: criar nova chave para producao, restringir por API e aplicacao, e remover a chave do frontend.

## Plano de execucao sugerido

### Fase 0 - Decisao de produto

- Definir se BizEye sera admin-only ou se tera leitores publicos.
- Definir deploy alvo inicial.
- Definir se o resolver fica no mesmo dominio do BizEye por reverse proxy.
- Definir comportamento visual quando canal estiver offline.

### Fase 1 - Scaffold do resolver

- Criar projeto Node + TypeScript + Fastify.
- Configurar ESLint, build, dev e test.
- Criar `.env.example`.
- Criar healthcheck.
- Criar cliente YouTube com API key no servidor.
- Criar camada de storage Supabase Postgres.
- Criar migrations em `bizeye-back/supabase/migrations`.

### Fase 2 - Auth admin

- Criar bootstrap de admin.
- Implementar login/logout/me.
- Implementar sessao segura em cookie.
- Adicionar rate limit e logs de tentativa.
- Proteger rotas admin.

### Fase 3 - YouTube resolver

- Implementar parsing de URL/handle/UC ID.
- Implementar `channels.list?forHandle`.
- Implementar fallback `search.list`.
- Implementar busca textual de canais.
- Implementar cache de busca e de canal.
- Registrar chamadas/quota localmente.

### Fase 4 - Live cache

- Implementar `channelId -> videoId`.
- Implementar `videos.list` para validacao.
- Implementar descoberta com `search.list eventType=live`.
- Implementar cache negativo/offline.
- Implementar scheduler de 60s para canais ativos.
- Implementar heartbeat vindo do BizEye.

### Fase 5 - Integracao BizEye

- Remover usos de `VITE_YOUTUBE_API_KEY`.
- Trocar busca e resolucao para o resolver.
- Ajustar player para usar `videoId` resolvido.
- Enviar heartbeat da Watch.
- Tratar estados `live`, `offline`, `quota_limited` e `error`.

### Fase 6 - Producao

- Deploy com HTTPS.
- Configurar CORS/origin.
- Restringir API key no Google Cloud.
- Separar ambiente dev/prod.
- Criar logs e alertas basicos para quota e erros 403/429.
- Documentar runbook de rotacao de chave e limpeza de cache.

## Criterios de aceite do MVP

- O frontend BizEye nao usa mais `VITE_YOUTUBE_API_KEY`.
- Busca de canais funciona apenas autenticada como admin.
- Adicionar canal por `@handle`, URL e `UC...` funciona.
- `channelId -> videoId` e cacheado.
- Live ativa e revalidada a cada 60s enquanto esta em uso.
- Quando a live termina, o resolver tenta encontrar nova live e atualiza o cache.
- Quando nao ha live, o resolver retorna `offline` sem disparar busca infinita.
- Quota usada fica visivel em log/admin.
- Rotas que chamam YouTube negam acesso sem sessao admin.

## Decisoes pendentes

- Onde hospedar a API inicialmente.
- Se Supabase Postgres sera suficiente para cache/cron em producao ou se Redis sera necessario depois para locks e rate limit.
- Se o BizEye tera usuarios nao-admin.
- Qual UX exata para login oculto.
- Qual UX para canal offline.
- Se havera tela admin de cache/quota ou so logs no MVP.
