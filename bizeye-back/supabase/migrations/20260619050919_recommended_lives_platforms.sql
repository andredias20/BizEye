set search_path = public, extensions;

alter table public.recommended_lives
  add column if not exists platform text not null default 'youtube',
  add column if not exists chat_identifier text;

alter table public.recommended_lives
  drop constraint if exists recommended_lives_platform_check;

alter table public.recommended_lives
  add constraint recommended_lives_platform_check
  check (platform in ('youtube', 'kick', 'twitch'));

alter table public.recommended_lives
  drop constraint if exists recommended_lives_channel_id_check;

alter table public.recommended_lives
  drop constraint if exists recommended_lives_identifier_format_check;

alter table public.recommended_lives
  add constraint recommended_lives_identifier_format_check
  check (
    (platform = 'youtube' and channel_id ~ '^UC[a-zA-Z0-9_-]{22}$')
    or (platform in ('kick', 'twitch') and length(btrim(channel_id)) > 0)
  );

alter table public.recommended_lives
  drop constraint if exists recommended_lives_channel_id_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.recommended_lives'::regclass
      and conname = 'recommended_lives_platform_channel_id_key'
  ) then
    alter table public.recommended_lives
      add constraint recommended_lives_platform_channel_id_key unique (platform, channel_id);
  end if;
end;
$$;

comment on column public.recommended_lives.platform is
  'Recommendation platform. Existing YouTube rows default to youtube; Kick and Twitch use channel_id as their normalized public identifier.';

comment on column public.recommended_lives.channel_id is
  'Normalized platform identifier. YouTube keeps a UC channel ID; Kick and Twitch store their public slug/login.';

comment on column public.recommended_lives.chat_identifier is
  'Optional chat resolver hint such as Kick chatroom:<id> or Twitch channel:<login>.';
