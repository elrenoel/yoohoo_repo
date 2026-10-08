alter table public.posts add column if not exists repost_count bigint not null default 0 check (repost_count >= 0);
alter table public.public_decks add column if not exists repost_count bigint not null default 0 check (repost_count >= 0);

create table if not exists public.reposts (
  user_id text not null references public."user"(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'public_deck')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create index if not exists reposts_target_idx on public.reposts (target_type, target_id, created_at desc);

comment on table public.reposts is 'Better Auth social reposts; target existence and authorization are enforced by application routes.';
