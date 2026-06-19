set search_path = public, extensions;

create table if not exists public.recommended_lives (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null
    check (channel_id ~ '^UC[a-zA-Z0-9_-]{22}$'),
  video_id text
    check (video_id is null or video_id ~ '^[a-zA-Z0-9_-]{11}$'),
  display_name text not null,
  description text,
  thumbnail_url text,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id)
);

comment on table public.recommended_lives is
  'Backend-managed YouTube lives/channels recommended by BizEye admins.';

comment on column public.recommended_lives.channel_id is
  'YouTube channel ID. Channel lookup and management must happen through authenticated backend admin routes.';

create index if not exists recommended_lives_enabled_order_idx
on public.recommended_lives(sort_order, display_name)
where enabled = true;

create index if not exists recommended_lives_created_by_idx
on public.recommended_lives(created_by);

drop trigger if exists recommended_lives_set_updated_at on public.recommended_lives;
create trigger recommended_lives_set_updated_at
before update on public.recommended_lives
for each row execute function public.set_updated_at();

insert into public.recommended_lives (
  channel_id,
  display_name,
  description,
  sort_order,
  enabled
)
values
  (
    'UCvgSmIdI92W4KnP15fJwfwA',
    'ACF',
    'Canal inicial para acompanhar lives e conteudo recorrente.',
    10,
    true
  ),
  (
    'UCwRM1SXROyxSSJqrOTQzILw',
    'Tonimec',
    'Exemplo pronto para entrar na tela Watch sem configurar nada.',
    20,
    true
  ),
  (
    'UCP9uupJdJnpOEJzTtigLPOg',
    'EEBrasil',
    'Canal fixo para resolver live ativa pelo backend quando necessario.',
    30,
    true
  ),
  (
    'UCZiYbVptd3PVPf4f6eR6UaQ',
    'CazeTV',
    'Canal sugerido para acompanhar transmissoes ao vivo via resolver do backend.',
    40,
    true
  )
on conflict (channel_id) do update
set
  display_name = excluded.display_name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  enabled = excluded.enabled,
  updated_at = now();

alter table public.recommended_lives enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.recommended_lives from anon;
    revoke all on public.admin_users from anon;
    revoke all on public.admin_sessions from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.recommended_lives from authenticated;
    revoke all on public.admin_users from authenticated;
    revoke all on public.admin_sessions from authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.recommended_lives to service_role;
    grant select, insert, update, delete on public.admin_users to service_role;
    grant select, insert, update, delete on public.admin_sessions to service_role;
  end if;
end;
$$;
