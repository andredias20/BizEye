set search_path = public, extensions;

create table if not exists public.recommended_streams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  platform text not null
    check (platform in ('youtube', 'twitch', 'kick')),
  stream_id text not null,
  title text not null,
  description text not null default '',
  handle text,
  chat_identifier text,
  thumbnail_url text,
  display_order integer not null default 100,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, stream_id)
);

comment on table public.recommended_streams is
  'Backend-managed recommendations used to seed and display BizEye live stream cards.';

comment on column public.recommended_streams.stream_id is
  'Normalized player identifier: YouTube channel/video ID, Twitch channel login, or Kick slug. The API also accepts simple Twitch/Kick/YouTube watch/channel URLs and normalizes them before returning.';

create index if not exists recommended_streams_active_order_idx
on public.recommended_streams(display_order, title)
where is_active = true;

drop trigger if exists recommended_streams_set_updated_at on public.recommended_streams;
create trigger recommended_streams_set_updated_at
before update on public.recommended_streams
for each row execute function public.set_updated_at();

insert into public.recommended_streams (
  slug,
  platform,
  stream_id,
  title,
  handle,
  description,
  display_order,
  is_active
)
values
  (
    'acf',
    'youtube',
    'UCvgSmIdI92W4KnP15fJwfwA',
    'ACF',
    'UCvgSmIdI92W4KnP15fJwfwA',
    'Canal inicial para acompanhar lives e conteudo recorrente.',
    10,
    true
  ),
  (
    'tonimec',
    'youtube',
    'UCwRM1SXROyxSSJqrOTQzILw',
    'Tonimec',
    'UCwRM1SXROyxSSJqrOTQzILw',
    'Exemplo pronto para entrar na tela Watch sem configurar nada.',
    20,
    true
  ),
  (
    'eebrasil',
    'youtube',
    'UCP9uupJdJnpOEJzTtigLPOg',
    'EEBrasil',
    '@enriedu',
    'Canal fixo para resolver live ativa pelo backend quando necessario.',
    30,
    true
  ),
  (
    'cazetv',
    'youtube',
    'UCZiYbVptd3PVPf4f6eR6UaQ',
    'CazeTV',
    '@CazeTV',
    'Canal sugerido para acompanhar transmissoes ao vivo via resolver do backend.',
    40,
    true
  )
on conflict (slug) do update
set
  platform = excluded.platform,
  stream_id = excluded.stream_id,
  title = excluded.title,
  handle = excluded.handle,
  description = excluded.description,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = now();

alter table public.recommended_streams enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.recommended_streams from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.recommended_streams from authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.recommended_streams to service_role;
  end if;
end;
$$;
