create table if not exists public.follows (
  follower_id text not null references public."user"(id) on delete cascade,
  following_id text not null references public."user"(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self_check check (follower_id <> following_id)
);

create index if not exists follows_following_idx on public.follows(following_id);
create index if not exists follows_follower_created_idx on public.follows(follower_id, created_at desc);

alter table public.follows enable row level security;
revoke all on table public.follows from anon, authenticated;

comment on table public.follows is 'Better Auth social graph. All access is authorized in the application layer.';
