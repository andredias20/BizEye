create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

set search_path = public, extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  password_hash text not null,
  display_name text,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Backend-only admin users. Access is intended through the BizEye backend service role.';

drop trigger if exists admin_users_set_updated_at on public.admin_users;
create trigger admin_users_set_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  ip_hash text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.admin_sessions is
  'Backend-only admin sessions. Store only hashed session tokens.';

create index if not exists admin_sessions_admin_user_id_idx
on public.admin_sessions(admin_user_id);

create index if not exists admin_sessions_expires_at_idx
on public.admin_sessions(expires_at);

create index if not exists admin_sessions_active_expiry_idx
on public.admin_sessions(expires_at)
where revoked_at is null;

drop trigger if exists admin_sessions_set_updated_at on public.admin_sessions;
create trigger admin_sessions_set_updated_at
before update on public.admin_sessions
for each row execute function public.set_updated_at();

create table if not exists public.youtube_channels (
  channel_id text primary key,
  title text,
  handle text,
  thumbnail_url text,
  description text,
  last_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.youtube_channels is
  'Cached YouTube channel metadata used by the BizEye resolver.';

create index if not exists youtube_channels_handle_idx
on public.youtube_channels(handle);

drop trigger if exists youtube_channels_set_updated_at on public.youtube_channels;
create trigger youtube_channels_set_updated_at
before update on public.youtube_channels
for each row execute function public.set_updated_at();

create table if not exists public.youtube_live_resolutions (
  channel_id text primary key references public.youtube_channels(channel_id) on delete cascade,
  video_id text,
  status text not null default 'unknown'
    check (status in ('live', 'offline', 'unknown', 'quota_limited', 'error')),
  source text not null default 'unknown'
    check (source in ('cache', 'youtube', 'stale_cache', 'unknown')),
  checked_at timestamptz,
  expires_at timestamptz,
  last_live_at timestamptz,
  next_discovery_at timestamptz,
  failure_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.youtube_live_resolutions is
  'Current channelId to live videoId cache and validation state.';

create index if not exists youtube_live_resolutions_status_idx
on public.youtube_live_resolutions(status);

create index if not exists youtube_live_resolutions_expires_at_idx
on public.youtube_live_resolutions(expires_at);

create index if not exists youtube_live_resolutions_next_discovery_at_idx
on public.youtube_live_resolutions(next_discovery_at);

create index if not exists youtube_live_resolutions_live_expiry_idx
on public.youtube_live_resolutions(expires_at)
where status = 'live';

create index if not exists youtube_live_resolutions_discovery_due_idx
on public.youtube_live_resolutions(next_discovery_at)
where status in ('offline', 'unknown', 'error');

drop trigger if exists youtube_live_resolutions_set_updated_at on public.youtube_live_resolutions;
create trigger youtube_live_resolutions_set_updated_at
before update on public.youtube_live_resolutions
for each row execute function public.set_updated_at();

create table if not exists public.youtube_api_cache (
  cache_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.youtube_api_cache is
  'Short-lived JSON cache for YouTube API responses. Do not store audiovisual content.';

create index if not exists youtube_api_cache_expires_at_idx
on public.youtube_api_cache(expires_at);

drop trigger if exists youtube_api_cache_set_updated_at on public.youtube_api_cache;
create trigger youtube_api_cache_set_updated_at
before update on public.youtube_api_cache
for each row execute function public.set_updated_at();

create table if not exists public.youtube_api_calls (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null,
  quota_bucket text,
  estimated_cost integer not null default 1,
  http_status integer,
  request_hash text,
  error_code text,
  created_at timestamptz not null default now()
);

comment on table public.youtube_api_calls is
  'Audit table for estimated YouTube API usage and failures.';

create index if not exists youtube_api_calls_created_at_idx
on public.youtube_api_calls(created_at);

create index if not exists youtube_api_calls_endpoint_idx
on public.youtube_api_calls(endpoint);

create table if not exists public.youtube_watch_heartbeats (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null references public.youtube_channels(channel_id) on delete cascade,
  client_id text not null,
  screen text not null default 'watch',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, client_id)
);

comment on table public.youtube_watch_heartbeats is
  'Recent watch-screen activity used to decide which channels need live validation.';

create index if not exists youtube_watch_heartbeats_last_seen_at_idx
on public.youtube_watch_heartbeats(last_seen_at);

drop trigger if exists youtube_watch_heartbeats_set_updated_at on public.youtube_watch_heartbeats;
create trigger youtube_watch_heartbeats_set_updated_at
before update on public.youtube_watch_heartbeats
for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.youtube_channels enable row level security;
alter table public.youtube_live_resolutions enable row level security;
alter table public.youtube_api_cache enable row level security;
alter table public.youtube_api_calls enable row level security;
alter table public.youtube_watch_heartbeats enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on
      public.admin_users,
      public.admin_sessions,
      public.youtube_channels,
      public.youtube_live_resolutions,
      public.youtube_api_cache,
      public.youtube_api_calls,
      public.youtube_watch_heartbeats
    from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on
      public.admin_users,
      public.admin_sessions,
      public.youtube_channels,
      public.youtube_live_resolutions,
      public.youtube_api_cache,
      public.youtube_api_calls,
      public.youtube_watch_heartbeats
    from authenticated;
  end if;
end;
$$;
