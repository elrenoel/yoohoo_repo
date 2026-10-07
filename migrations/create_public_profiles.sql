create table if not exists public.profiles (
  user_id text primary key references public."user"(id) on delete cascade,
  username text not null,
  display_name text not null,
  bio text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format_check
    check (username = lower(username) and username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_display_name_length_check
    check (char_length(display_name) between 1 and 50),
  constraint profiles_bio_length_check
    check (char_length(bio) <= 160),
  constraint profiles_avatar_url_length_check
    check (avatar_url is null or char_length(avatar_url) <= 2048)
);

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username));

create index if not exists profiles_created_at_idx
  on public.profiles (created_at desc);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;

comment on table public.profiles is
  'Public profile metadata for Better Auth users. All writes are authorized in the app layer.';
comment on column public.profiles.username is
  'Canonical lowercase public username validated by profiles_username_format_check.';

create or replace function private.touch_profiles_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_profiles_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function private.touch_profiles_updated_at();
