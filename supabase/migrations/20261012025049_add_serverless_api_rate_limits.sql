create table if not exists public.api_rate_limits (
  user_id text not null,
  action text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (user_id, action, window_start)
);

create index if not exists api_rate_limits_window_start_idx
  on public.api_rate_limits (window_start);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;

comment on table public.api_rate_limits is
  'Internal fixed-window counters used by postgres.js API routes; never exposed to browser roles.';
