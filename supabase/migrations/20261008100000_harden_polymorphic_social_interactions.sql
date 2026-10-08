-- Harden the canonical polymorphic interaction tables selected in decision A.
-- This migration intentionally contains schema/security changes only. It does
-- not copy, rewrite, or delete existing interaction data.

-- These tables are written by trusted server-side code after authentication.
-- Browser-facing roles must not be able to bypass that API boundary.
alter table if exists public.likes enable row level security;
alter table if exists public.bookmarks enable row level security;
alter table if exists public.reposts enable row level security;

revoke all privileges on table public.likes from public, anon, authenticated;
revoke all privileges on table public.bookmarks from public, anon, authenticated;
revoke all privileges on table public.reposts from public, anon, authenticated;

-- Keep the migration safe on environments that already received equivalent
-- indexes through historical SQL outside the canonical migration directory.
create index if not exists likes_target_idx
  on public.likes (target_type, target_id, created_at desc);

create index if not exists bookmarks_target_idx
  on public.bookmarks (target_type, target_id);

create index if not exists bookmarks_user_created_idx
  on public.bookmarks (user_id, created_at desc);

create index if not exists reposts_target_idx
  on public.reposts (target_type, target_id, created_at desc);

-- Interaction notification rows already use the table-wide unique dedupe_key.
-- This index keeps undo cleanup by actor/type/target inexpensive.
alter table if exists public.notifications
  add column if not exists actor_id text references public."user" (id) on delete set null,
  add column if not exists target_type text,
  add column if not exists target_id text;

create index if not exists notifications_interaction_lookup_idx
  on public.notifications (actor_id, type, target_type, target_id)
  where type in ('repost', 'save');

-- One bounded row per user/action keeps the fixed-window limiter small and
-- makes each check a single indexed UPSERT. The private schema is not exposed
-- through the Data API.
create schema if not exists private;

create table if not exists private.interaction_rate_limits (
  user_id text not null references public."user" (id) on delete cascade,
  action text not null check (char_length(action) between 1 and 64),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, action)
);

alter table private.interaction_rate_limits enable row level security;

revoke all privileges on schema private from public, anon, authenticated;
revoke all privileges on table private.interaction_rate_limits
  from public, anon, authenticated;

comment on table private.interaction_rate_limits is
  'Postgres-backed fixed-window limits for authenticated interaction endpoints.';

create or replace function private.consume_interaction_rate_limit(
  p_user_id text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_allowed boolean;
begin
  if p_user_id is null
    or p_action is null
    or char_length(p_action) not between 1 and 64
    or p_limit is null
    or p_limit < 1
    or p_window_seconds is null
    or p_window_seconds < 1
  then
    return false;
  end if;

  insert into private.interaction_rate_limits as rate_limit (
    user_id,
    action,
    window_started_at,
    request_count,
    updated_at
  )
  values (
    p_user_id,
    p_action,
    v_now,
    1,
    v_now
  )
  on conflict (user_id, action) do update
  set
    window_started_at = case
      when rate_limit.window_started_at
        <= v_now - make_interval(secs => p_window_seconds)
      then v_now
      else rate_limit.window_started_at
    end,
    request_count = case
      when rate_limit.window_started_at
        <= v_now - make_interval(secs => p_window_seconds)
      then 1
      else rate_limit.request_count + 1
    end,
    updated_at = v_now
  where
    rate_limit.window_started_at
      <= v_now - make_interval(secs => p_window_seconds)
    or rate_limit.request_count < p_limit
  returning true into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;

revoke all privileges on function private.consume_interaction_rate_limit(
  text,
  text,
  integer,
  integer
) from public, anon, authenticated;

comment on function private.consume_interaction_rate_limit(
  text,
  text,
  integer,
  integer
) is
  'Atomically consumes one fixed-window interaction allowance; false means limited.';
