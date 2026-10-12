create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id text not null references public."user"(id) on delete cascade,
  slug text not null,
  title text not null default '',
  excerpt text not null default '',
  body_md text not null default '',
  embedded_public_deck_id uuid references public.public_decks(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint posts_slug_format_check check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint posts_title_length_check check (char_length(title) <= 120),
  constraint posts_excerpt_length_check check (char_length(excerpt) <= 300),
  constraint posts_body_length_check check (char_length(body_md) <= 50000),
  constraint posts_published_fields_check check (status = 'draft' or (published_at is not null and char_length(title) > 0 and char_length(body_md) > 0))
);

create unique index if not exists posts_slug_uidx on public.posts(slug);
create index if not exists posts_author_status_published_idx on public.posts(author_id, status, published_at desc) where deleted_at is null;
create index if not exists posts_public_feed_idx on public.posts(published_at desc) where status = 'published' and deleted_at is null;
create index if not exists posts_embedded_deck_idx on public.posts(embedded_public_deck_id) where embedded_public_deck_id is not null;

alter table public.posts enable row level security;
revoke all on table public.posts from anon, authenticated;

comment on column public.posts.deleted_at is 'Soft-delete marker. Deleted posts remain recoverable in the database but are excluded from every application query.';

create or replace function private.touch_posts_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
revoke all on function private.touch_posts_updated_at() from public, anon, authenticated;
drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at before update on public.posts for each row execute function private.touch_posts_updated_at();
