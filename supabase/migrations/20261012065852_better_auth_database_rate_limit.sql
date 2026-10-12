create table if not exists public.rate_limit (
  id text primary key,
  key text not null unique,
  count bigint not null default 0,
  last_request bigint not null
);

create index if not exists rate_limit_last_request_idx
  on public.rate_limit (last_request);

alter table public.rate_limit enable row level security;
revoke all on table public.rate_limit from public, anon, authenticated;
