create table if not exists public.likes (
  user_id text not null references public."user"(id) on delete cascade,
  target_type text not null check (target_type in ('post','public_deck')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id,target_type,target_id)
);
create index if not exists likes_target_idx on public.likes(target_type,target_id,created_at desc);

create table if not exists public.bookmarks (
  user_id text not null references public."user"(id) on delete cascade,
  target_type text not null check (target_type in ('post','public_deck')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id,target_type,target_id)
);
create index if not exists bookmarks_user_created_idx on public.bookmarks(user_id,created_at desc);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post','public_deck')),
  target_id uuid not null,
  author_id text not null references public."user"(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete set null,
  body text not null check (char_length(body) between 1 and 1000),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists comments_target_created_idx on public.comments(target_type,target_id,created_at);
create index if not exists comments_author_idx on public.comments(author_id);
create index if not exists comments_parent_idx on public.comments(parent_id);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(), reporter_id text not null references public."user"(id) on delete cascade,
  target_type text not null check (target_type in ('post','public_deck','comment','user')),
  target_id text not null, reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open','reviewed','dismissed')),
  created_at timestamptz not null default now(), unique(reporter_id,target_type,target_id)
);
create index if not exists reports_status_created_idx on public.reports(status,created_at);

alter table public.posts add column if not exists like_count bigint not null default 0 check (like_count>=0);
alter table public.posts add column if not exists comment_count bigint not null default 0 check (comment_count>=0);
alter table public.public_decks add column if not exists like_count bigint not null default 0 check (like_count>=0);
alter table public.public_decks add column if not exists comment_count bigint not null default 0 check (comment_count>=0);
alter table public.notifications add column if not exists actor_id text references public."user"(id) on delete set null;
alter table public.notifications add column if not exists target_type text;
alter table public.notifications add column if not exists target_id text;
create index if not exists notifications_user_unread_created_idx on public.notifications(user_id,read_at,created_at desc);
create index if not exists notifications_actor_idx on public.notifications(actor_id);

alter table public.likes enable row level security;
alter table public.bookmarks enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;
comment on table public.likes is 'Better Auth social likes; server-only, authorized in application routes.';
comment on table public.bookmarks is 'Better Auth bookmarks; server-only, authorized in application routes.';
comment on table public.comments is 'Public-content comments; all writes authorized in application routes.';
comment on table public.reports is 'Moderation reports; server-only and never exposed directly.';
